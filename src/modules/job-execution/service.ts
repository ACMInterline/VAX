import "server-only";

import { z } from "zod";
import type { PermissionCode } from "@/modules/identity-access/policy";
import {
  JobAuthorizationError,
  requireJobAssignment,
  requireJobCancellation,
  requireStaffAssetHistoryRead,
  type JobActor,
} from "./policy";
import { generateJobReference } from "./reference";
import type { JobExecutionRepository } from "./repository";
import type {
  JobCreationResult,
  JobItemMutationResult,
  JobMutationResult,
  JobStatus,
} from "./types";
import {
  assignJobTeamSchema,
  cancelJobSchema,
  cleaningPassportRouteSchema,
  completeJobItemTreatmentSchema,
  completeJobSchema,
  confirmJobItemTreatmentPlanSchema,
  createJobFromBookingSchema,
  jobListSchema,
  jobReferenceSchema,
  jobVersionCommandSchema,
  recordJobItemInspectionSchema,
  startJobItemTreatmentSchema,
} from "./validation";

export type JobExecutionServiceFailureCode =
  | "INVALID_REQUEST"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "REQUIRES_REVIEW"
  | "INCOMPLETE"
  | "TEMPORARILY_UNAVAILABLE";

export class JobExecutionServiceError extends Error {
  readonly code: JobExecutionServiceFailureCode;

  constructor(code: JobExecutionServiceFailureCode) {
    super(code);
    this.name = "JobExecutionServiceError";
    this.code = code;
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new JobExecutionServiceError("INVALID_REQUEST");
  }
  return parsed.data;
}

async function repositoryOperation<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch {
    throw new JobExecutionServiceError("TEMPORARILY_UNAVAILABLE");
  }
}

function requireCoarsePermissions(
  actor: JobActor | null,
  required: readonly PermissionCode[],
): JobActor {
  if (!actor) {
    throw new JobAuthorizationError("AUTHENTICATION_REQUIRED");
  }
  if (actor.status !== "ACTIVE" || actor.roles.size === 0) {
    throw new JobAuthorizationError("ACCOUNT_UNAVAILABLE");
  }
  if (!required.every((permission) => actor.permissions.has(permission))) {
    throw new JobAuthorizationError("PERMISSION_DENIED");
  }
  return actor;
}

const jobReadPermissions = [
  "OPERATIONS_READ",
  "SCHEDULE_READ",
  "FIELD_JOBS_READ",
] as const satisfies readonly PermissionCode[];

const jobUpdatePermissions = [
  ...jobReadPermissions,
  "FIELD_JOBS_UPDATE",
] as const satisfies readonly PermissionCode[];

function requireCoarseJobRead(actor: JobActor | null): JobActor {
  return requireCoarsePermissions(actor, jobReadPermissions);
}

function requireCoarseJobUpdate(actor: JobActor | null): JobActor {
  return requireCoarsePermissions(actor, jobUpdatePermissions);
}

export type JobCreationServiceResult =
  | Readonly<{
      status: "CREATED" | "EXISTING";
      jobReference: string;
      jobStatus: JobStatus;
    }>
  | Readonly<{ status: "REVIEW_REQUIRED" | "INELIGIBLE" }>;

type SafeJobMutationResult = Extract<
  JobMutationResult,
  { status: "CHANGED" | "NO_CHANGE" }
>;
type SafeJobItemMutationResult = Extract<
  JobItemMutationResult,
  { status: "CHANGED" | "NO_CHANGE" }
>;

function safeCreationResult(
  result: JobCreationResult,
): JobCreationServiceResult | "RETRY_REFERENCE" {
  switch (result.status) {
    case "CREATED":
    case "EXISTING":
      return {
        status: result.status,
        jobReference: result.jobReference,
        jobStatus: result.jobStatus,
      };
    case "REVIEW_REQUIRED":
    case "INELIGIBLE":
      return { status: result.status };
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new JobExecutionServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
    case "REFERENCE_CONFLICT":
      return "RETRY_REFERENCE";
  }
  throw new JobExecutionServiceError("TEMPORARILY_UNAVAILABLE");
}

function safeMutationResult(result: JobMutationResult): SafeJobMutationResult {
  switch (result.status) {
    case "CHANGED":
    case "NO_CHANGE":
      return result;
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new JobExecutionServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
    case "CONFLICT":
      throw new JobExecutionServiceError("CONFLICT");
    case "INVALID_TRANSITION":
      throw new JobExecutionServiceError("INVALID_TRANSITION");
    case "REQUIRES_REVIEW":
      throw new JobExecutionServiceError("REQUIRES_REVIEW");
    case "INCOMPLETE":
      throw new JobExecutionServiceError("INCOMPLETE");
  }
  throw new JobExecutionServiceError("TEMPORARILY_UNAVAILABLE");
}

function safeItemMutationResult(
  result: JobItemMutationResult,
): SafeJobItemMutationResult {
  switch (result.status) {
    case "CHANGED":
    case "NO_CHANGE":
      return result;
    case "NOT_FOUND_OR_FORBIDDEN":
      throw new JobExecutionServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
    case "CONFLICT":
      throw new JobExecutionServiceError("CONFLICT");
    case "INVALID_TRANSITION":
      throw new JobExecutionServiceError("INVALID_TRANSITION");
    case "REQUIRES_REVIEW":
      throw new JobExecutionServiceError("REQUIRES_REVIEW");
    case "INCOMPLETE":
      throw new JobExecutionServiceError("INCOMPLETE");
  }
  throw new JobExecutionServiceError("TEMPORARILY_UNAVAILABLE");
}

async function createWithReferenceRetry(
  repository: JobExecutionRepository,
  actorProfileId: string,
  input: z.infer<typeof createJobFromBookingSchema>,
): Promise<JobCreationServiceResult> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const result = await repositoryOperation(() =>
      repository.createJob(actorProfileId, {
        ...input,
        jobReference: generateJobReference(),
      }),
    );
    const safe = safeCreationResult(result);
    if (safe !== "RETRY_REFERENCE") return safe;
  }
  throw new JobExecutionServiceError("CONFLICT");
}

export function createJobExecutionService(repository: JobExecutionRepository) {
  async function transitionJob(
    actor: JobActor | null,
    input: unknown,
    targetStatus: "EN_ROUTE" | "ARRIVED" | "IN_PROGRESS",
  ) {
    const authorizedActor = requireCoarseJobUpdate(actor);
    const parsed = parse(jobVersionCommandSchema, input);
    const result = await repositoryOperation(() =>
      repository.transitionJob(
        authorizedActor.profileId,
        parsed,
        targetStatus,
      ),
    );
    return safeMutationResult(result);
  }

  return {
    async createJobFromBooking(actor: JobActor | null, input: unknown) {
      requireJobAssignment(actor);
      const parsed = parse(createJobFromBookingSchema, input);
      return createWithReferenceRetry(repository, actor!.profileId, parsed);
    },

    async listJobs(actor: JobActor | null, input: unknown) {
      const authorizedActor = requireCoarseJobRead(actor);
      const parsed = parse(jobListSchema, input);
      return repositoryOperation(() =>
        repository.listJobs(authorizedActor.profileId, parsed),
      );
    },

    async getJob(actor: JobActor | null, input: unknown) {
      const authorizedActor = requireCoarseJobRead(actor);
      const { jobReference } = parse(
        z.object({ jobReference: jobReferenceSchema }).strict(),
        input,
      );
      const job = await repositoryOperation(() =>
        repository.getJob(authorizedActor.profileId, jobReference),
      );
      if (!job) {
        throw new JobExecutionServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return job;
    },

    async assignTeam(actor: JobActor | null, input: unknown) {
      requireJobAssignment(actor);
      const parsed = parse(assignJobTeamSchema, input);
      const result = await repositoryOperation(() =>
        repository.assignTeam(actor!.profileId, parsed),
      );
      return safeMutationResult(result);
    },

    markEnRoute(actor: JobActor | null, input: unknown) {
      return transitionJob(actor, input, "EN_ROUTE");
    },

    markArrived(actor: JobActor | null, input: unknown) {
      return transitionJob(actor, input, "ARRIVED");
    },

    startWork(actor: JobActor | null, input: unknown) {
      return transitionJob(actor, input, "IN_PROGRESS");
    },

    async recordInspection(actor: JobActor | null, input: unknown) {
      const authorizedActor = requireCoarseJobUpdate(actor);
      const parsed = parse(recordJobItemInspectionSchema, input);
      const result = await repositoryOperation(() =>
        repository.recordInspection(authorizedActor.profileId, parsed),
      );
      return safeItemMutationResult(result);
    },

    async confirmTreatmentPlan(actor: JobActor | null, input: unknown) {
      const authorizedActor = requireCoarseJobUpdate(actor);
      const parsed = parse(confirmJobItemTreatmentPlanSchema, input);
      const result = await repositoryOperation(() =>
        repository.confirmTreatmentPlan(authorizedActor.profileId, parsed),
      );
      return safeItemMutationResult(result);
    },

    async startTreatment(actor: JobActor | null, input: unknown) {
      const authorizedActor = requireCoarseJobUpdate(actor);
      const parsed = parse(startJobItemTreatmentSchema, input);
      const result = await repositoryOperation(() =>
        repository.startTreatment(authorizedActor.profileId, parsed),
      );
      return safeItemMutationResult(result);
    },

    async completeTreatment(actor: JobActor | null, input: unknown) {
      const authorizedActor = requireCoarseJobUpdate(actor);
      const parsed = parse(completeJobItemTreatmentSchema, input);
      const result = await repositoryOperation(() =>
        repository.completeTreatment(authorizedActor.profileId, parsed),
      );
      return safeItemMutationResult(result);
    },

    async completeJob(actor: JobActor | null, input: unknown) {
      const authorizedActor = requireCoarseJobUpdate(actor);
      const parsed = parse(completeJobSchema, input);
      const result = await repositoryOperation(() =>
        repository.completeJob(authorizedActor.profileId, parsed),
      );
      return safeMutationResult(result);
    },

    async cancelJob(actor: JobActor | null, input: unknown) {
      requireJobCancellation(actor);
      const parsed = parse(cancelJobSchema, input);
      const result = await repositoryOperation(() =>
        repository.cancelJob(actor!.profileId, parsed),
      );
      return safeMutationResult(result);
    },

    async getCustomerPassport(actor: JobActor | null, input: unknown) {
      // The repository freshly proves the exact active customer/property/asset
      // link; this service gate establishes only the coarse account authority.
      requireCoarsePermissions(actor, ["OWN_CUSTOMER_DATA_READ"]);
      const parsed = parse(cleaningPassportRouteSchema, input);
      const passport = await repositoryOperation(() =>
        repository.getCustomerPassport(actor!.profileId, parsed),
      );
      if (!passport) {
        throw new JobExecutionServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return passport;
    },

    async getStaffAssetHistory(actor: JobActor | null, input: unknown) {
      requireStaffAssetHistoryRead(actor);
      const parsed = parse(cleaningPassportRouteSchema, input);
      const history = await repositoryOperation(() =>
        repository.getStaffAssetHistory(actor!.profileId, parsed),
      );
      if (!history) {
        throw new JobExecutionServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      }
      return history;
    },
  };
}

export type JobExecutionService = ReturnType<
  typeof createJobExecutionService
>;
