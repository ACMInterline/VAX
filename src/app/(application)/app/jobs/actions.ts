"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  requireAuthenticatedUser,
  type AuthenticatedPrincipal,
} from "@/auth/authorization-service";
import { isAuthAttemptAllowed } from "@/auth/enforce-rate-limit";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import type { AuthLocale } from "@/auth/validation";
import type { JobActionState } from "@/components/job-execution";
import { getDatabase } from "@/db/client";
import {
  JobAuthorizationError,
  requireJobAssignment,
  requireJobCancellation,
  type JobActor,
} from "@/modules/job-execution/policy";
import { createDatabaseJobExecutionRepository } from "@/modules/job-execution/repository";
import {
  createJobExecutionService,
  JobExecutionServiceError,
  type JobExecutionService,
} from "@/modules/job-execution/service";
import {
  assignJobTeamSchema,
  cancelJobSchema,
  completeJobItemTreatmentSchema,
  completeJobSchema,
  confirmJobItemTreatmentPlanSchema,
  createJobFromBookingSchema,
  jobVersionCommandSchema,
  recordJobItemInspectionSchema,
  startJobItemTreatmentSchema,
} from "@/modules/job-execution/validation";

const progressOperationSchema = z.enum([
  "START_TRAVEL",
  "MARK_ARRIVED",
  "START_WORK",
]);

const messages = {
  bg: {
    invalid: "Проверете задължителните полета и опитайте отново.",
    unavailable: "Операцията не може да бъде завършена в момента.",
    denied: "Нямате достъп до тази операция.",
    limited: "Твърде много опити. Изчакайте и опитайте отново.",
    conflict: "Записът е променен. Презаредете страницата и опитайте отново.",
    review: "Необходим е служебен преглед. Не е направена автоматична промяна.",
    incomplete: "Задачата не може да продължи, докато липсващите данни не бъдат попълнени.",
    created: "Работната задача е създадена.",
    existing: "За тази резервация вече има работна задача.",
    changed: "Промяната е записана.",
    noChange: "Тази стъпка вече е записана.",
  },
  en: {
    invalid: "Check the required fields and try again.",
    unavailable: "The operation cannot be completed right now.",
    denied: "You do not have access to this operation.",
    limited: "Too many attempts. Wait and try again.",
    conflict: "The record changed. Reload the page and try again.",
    review: "Staff review is required. No automatic change was made.",
    incomplete: "The job cannot continue until the missing evidence is recorded.",
    created: "The field job was created.",
    existing: "A field job already exists for this booking.",
    changed: "The change was recorded.",
    noChange: "This step was already recorded.",
  },
} as const;

function actorFromPrincipal(principal: AuthenticatedPrincipal): JobActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

function service(): JobExecutionService {
  return createJobExecutionService(
    createDatabaseJobExecutionRepository(getDatabase()),
  );
}

function scalar(formData: FormData, name: string): unknown {
  const values = formData.getAll(name);
  if (values.length === 0) return undefined;
  if (values.length !== 1 || typeof values[0] !== "string") return values;
  return values[0];
}

function integer(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return Number.NaN;
  }
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
}

function nullableInteger(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (value === undefined || value === "") return null;
  return integer(formData, name);
}

function integerList(formData: FormData, name: string): unknown {
  const values = formData.getAll(name);
  return values.map((value) => {
    if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
      return Number.NaN;
    }
    const parsed = Number(value.trim());
    return Number.isSafeInteger(parsed) ? parsed : Number.NaN;
  });
}

function checked(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  if (value === undefined) return false;
  return value === "true" ? true : value;
}

function nullableText(formData: FormData, name: string): unknown {
  const value = scalar(formData, name);
  return value === undefined || (typeof value === "string" && value.trim() === "")
    ? null
    : value;
}

function rejectUnexpectedFields(
  formData: FormData,
  allowedFields: ReadonlySet<string>,
): Readonly<Record<string, true>> {
  for (const name of formData.keys()) {
    if (!allowedFields.has(name) && !name.startsWith("$ACTION_")) {
      return { unexpectedField: true };
    }
  }
  return {};
}

function fieldName(issue: z.core.$ZodIssue): string {
  const [first, second] = issue.path;
  if (first === "observedMeasurement" && typeof second === "string") {
    return second;
  }
  return typeof first === "string" ? first : "_form";
}

function parseInput<T>(
  schema: z.ZodType<T>,
  input: unknown,
  locale: AuthLocale,
): { data: T } | { failure: JobActionState } {
  const parsed = schema.safeParse(input);
  if (parsed.success) return { data: parsed.data };
  const fieldErrors: Record<string, string[]> = {};
  for (const issue of parsed.error.issues) {
    (fieldErrors[fieldName(issue)] ??= []).push(messages[locale].invalid);
  }
  return {
    failure: {
      status: "ERROR",
      message: messages[locale].invalid,
      fieldErrors,
    },
  };
}

function failureState(error: unknown, locale: AuthLocale): JobActionState {
  const content = messages[locale];
  if (
    error instanceof AuthenticationBoundaryError ||
    error instanceof JobAuthorizationError
  ) {
    return { status: "ERROR", message: content.denied };
  }
  if (error instanceof JobExecutionServiceError) {
    switch (error.code) {
      case "INVALID_REQUEST":
        return { status: "ERROR", message: content.invalid };
      case "CONFLICT":
      case "INVALID_TRANSITION":
        return { status: "ERROR", message: content.conflict };
      case "REQUIRES_REVIEW":
        return { status: "ERROR", message: content.review };
      case "INCOMPLETE":
        return { status: "ERROR", message: content.incomplete };
      case "RECORD_NOT_FOUND_OR_FORBIDDEN":
        return { status: "ERROR", message: content.denied };
      case "TEMPORARILY_UNAVAILABLE":
        return { status: "ERROR", message: content.unavailable };
    }
  }
  return { status: "ERROR", message: content.unavailable };
}

type MutationAuthority = "ASSIGN" | "CANCEL" | "UPDATE";

function requireMutationAuthority(
  actor: JobActor,
  authority: MutationAuthority,
): void {
  if (authority === "ASSIGN") {
    requireJobAssignment(actor);
    return;
  }
  if (authority === "CANCEL") {
    requireJobCancellation(actor);
    return;
  }
  const required = [
    "OPERATIONS_READ",
    "SCHEDULE_READ",
    "FIELD_JOBS_READ",
    "FIELD_JOBS_UPDATE",
  ] as const;
  if (
    actor.status !== "ACTIVE" ||
    actor.roles.size === 0 ||
    required.some((permission) => !actor.permissions.has(permission))
  ) {
    throw new JobAuthorizationError("PERMISSION_DENIED");
  }
}

async function authenticatedMutationContext(
  authority: MutationAuthority,
): Promise<
  | Readonly<{ actor: JobActor; locale: AuthLocale }>
  | JobActionState
> {
  let locale: AuthLocale = "bg";
  try {
    const principal = await requireAuthenticatedUser();
    locale = principal.profile.preferredLocale;
    const actor = actorFromPrincipal(principal);
    requireMutationAuthority(actor, authority);
    if (!(await isAuthAttemptAllowed("JOB_MUTATION", principal.profile.id))) {
      return { status: "ERROR", message: messages[locale].limited };
    }
    return { actor, locale };
  } catch (error) {
    return failureState(error, locale);
  }
}

function revalidateJob(jobReference: string): void {
  revalidatePath("/app/jobs");
  revalidatePath(`/app/jobs/${jobReference}`);
}

function mutationSuccess(
  status: "CHANGED" | "NO_CHANGE",
  locale: AuthLocale,
): JobActionState {
  return {
    status: "SUCCESS",
    message:
      status === "CHANGED"
        ? messages[locale].changed
        : messages[locale].noChange,
  };
}

export async function createJobFromBookingAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("ASSIGN");
  if ("status" in context) return context;
  const parsed = parseInput(
    createJobFromBookingSchema,
    {
      bookingReference: scalar(formData, "bookingReference"),
      expectedBookingVersion: integer(formData, "expectedBookingVersion"),
      ...rejectUnexpectedFields(
        formData,
        new Set(["bookingReference", "expectedBookingVersion"]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().createJobFromBooking(context.actor, parsed.data);
    if (result.status !== "CREATED" && result.status !== "EXISTING") {
      return { status: "ERROR", message: messages[context.locale].review };
    }
    revalidateJob(result.jobReference);
    return {
      status: "SUCCESS",
      message:
        result.status === "CREATED"
          ? messages[context.locale].created
          : messages[context.locale].existing,
    };
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function assignJobTeamAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("ASSIGN");
  if ("status" in context) return context;
  const parsed = parseInput(
    assignJobTeamSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      operationsTeamId: integer(formData, "operationsTeamId"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      ...rejectUnexpectedFields(
        formData,
        new Set(["jobReference", "operationsTeamId", "expectedJobVersion"]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().assignTeam(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function progressJobAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("UPDATE");
  if ("status" in context) return context;
  const operation = progressOperationSchema.safeParse(
    scalar(formData, "operation"),
  );
  const parsed = parseInput(
    jobVersionCommandSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      ...rejectUnexpectedFields(
        formData,
        new Set(["jobReference", "expectedJobVersion", "operation"]),
      ),
    },
    context.locale,
  );
  if (!operation.success || "failure" in parsed) {
    return "failure" in parsed
      ? parsed.failure
      : { status: "ERROR", message: messages[context.locale].invalid };
  }
  try {
    const jobs = service();
    const result =
      operation.data === "START_TRAVEL"
        ? await jobs.markEnRoute(context.actor, parsed.data)
        : operation.data === "MARK_ARRIVED"
          ? await jobs.markArrived(context.actor, parsed.data)
          : await jobs.startWork(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function recordJobItemInspectionAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("UPDATE");
  if ("status" in context) return context;
  const issueTypeIds = integerList(formData, "issueTypeIds");
  const riskFlagIds = integerList(formData, "riskFlagIds");
  const issuesAcknowledged = checked(formData, "noKnownIssuesAcknowledged");
  const risksAcknowledged = checked(formData, "noKnownRisksAcknowledged");
  const unexpected = rejectUnexpectedFields(
    formData,
    new Set([
      "jobReference",
      "jobItemId",
      "expectedJobVersion",
      "expectedJobItemVersion",
      "observedCleaningItemTypeId",
      "measurementModeId",
      "quantity",
      "areaHundredthsM2",
      "seatCount",
      "sides",
      "observedConditionLevelId",
      "confirmedFibreMaterialId",
      "confirmedSurfaceConstructionId",
      "existingDamageObserved",
      "existingDamageNotes",
      "colourfastnessConcern",
      "moistureSensitivity",
      "unsafeContaminationObserved",
      "unsafeStructuralConditionObserved",
      "technicianNotes",
      "issueTypeIds",
      "riskFlagIds",
      "noKnownIssuesAcknowledged",
      "noKnownRisksAcknowledged",
    ]),
  );
  if (
    (Array.isArray(issueTypeIds) && issueTypeIds.length > 0) ===
      (issuesAcknowledged === true) ||
    (Array.isArray(riskFlagIds) && riskFlagIds.length > 0) ===
      (risksAcknowledged === true)
  ) {
    return { status: "ERROR", message: messages[context.locale].invalid };
  }
  const parsed = parseInput(
    recordJobItemInspectionSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      jobItemId: scalar(formData, "jobItemId"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      expectedJobItemVersion: integer(formData, "expectedJobItemVersion"),
      observedCleaningItemTypeId: integer(
        formData,
        "observedCleaningItemTypeId",
      ),
      observedMeasurement: {
        measurementModeId: integer(formData, "measurementModeId"),
        quantity: integer(formData, "quantity"),
        areaHundredthsM2: nullableInteger(formData, "areaHundredthsM2"),
        seatCount: nullableInteger(formData, "seatCount"),
        sides: nullableInteger(formData, "sides"),
      },
      observedConditionLevelId: integer(
        formData,
        "observedConditionLevelId",
      ),
      confirmedFibreMaterialId: integer(
        formData,
        "confirmedFibreMaterialId",
      ),
      confirmedSurfaceConstructionId: integer(
        formData,
        "confirmedSurfaceConstructionId",
      ),
      existingDamageObserved: checked(formData, "existingDamageObserved"),
      existingDamageNotes: nullableText(formData, "existingDamageNotes"),
      colourfastnessConcern: checked(formData, "colourfastnessConcern"),
      moistureSensitivity: checked(formData, "moistureSensitivity"),
      unsafeContaminationObserved: checked(
        formData,
        "unsafeContaminationObserved",
      ),
      unsafeStructuralConditionObserved: checked(
        formData,
        "unsafeStructuralConditionObserved",
      ),
      technicianNotes: nullableText(formData, "technicianNotes"),
      issues: Array.isArray(issueTypeIds)
        ? issueTypeIds.map((issueTypeId) => ({
            issueTypeId,
            technicianNote: null,
          }))
        : issueTypeIds,
      risks: Array.isArray(riskFlagIds)
        ? riskFlagIds.map((riskFlagId) => ({
            riskFlagId,
            technicianNote: null,
          }))
        : riskFlagIds,
      ...unexpected,
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().recordInspection(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function confirmJobItemTreatmentPlanAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("UPDATE");
  if ("status" in context) return context;
  if (checked(formData, "safetyAcknowledged") !== true) {
    return {
      status: "ERROR",
      message: messages[context.locale].invalid,
      fieldErrors: { safetyAcknowledged: [messages[context.locale].invalid] },
    };
  }
  const parsed = parseInput(
    confirmJobItemTreatmentPlanSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      jobItemId: scalar(formData, "jobItemId"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      expectedJobItemVersion: integer(formData, "expectedJobItemVersion"),
      sourceInspectionId: scalar(formData, "sourceInspectionId"),
      decision: scalar(formData, "decision"),
      treatmentLevelId: nullableInteger(formData, "treatmentLevelId"),
      mechanicalActionLevelId: nullableInteger(
        formData,
        "mechanicalActionLevelId",
      ),
      treatmentApproachId: nullableInteger(formData, "treatmentApproachId"),
      addonIds: integerList(formData, "addonIds"),
      cleaningProductId: nullableInteger(formData, "cleaningProductId"),
      technicianRationale: scalar(formData, "technicianRationale"),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "jobReference",
          "jobItemId",
          "expectedJobVersion",
          "expectedJobItemVersion",
          "sourceInspectionId",
          "decision",
          "treatmentLevelId",
          "mechanicalActionLevelId",
          "treatmentApproachId",
          "addonIds",
          "cleaningProductId",
          "technicianRationale",
          "safetyAcknowledged",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().confirmTreatmentPlan(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function startJobItemTreatmentAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("UPDATE");
  if ("status" in context) return context;
  if (scalar(formData, "operation") !== "START_TREATMENT") {
    return { status: "ERROR", message: messages[context.locale].invalid };
  }
  const parsed = parseInput(
    startJobItemTreatmentSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      jobItemId: scalar(formData, "jobItemId"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      expectedJobItemVersion: integer(formData, "expectedJobItemVersion"),
      treatmentPlanId: scalar(formData, "treatmentPlanId"),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "jobReference",
          "jobItemId",
          "expectedJobVersion",
          "expectedJobItemVersion",
          "treatmentPlanId",
          "operation",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().startTreatment(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function completeJobItemTreatmentAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("UPDATE");
  if ("status" in context) return context;
  const parsed = parseInput(
    completeJobItemTreatmentSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      jobItemId: scalar(formData, "jobItemId"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      expectedJobItemVersion: integer(formData, "expectedJobItemVersion"),
      treatmentExecutionId: scalar(formData, "treatmentExecutionId"),
      expectedTreatmentExecutionVersion: integer(
        formData,
        "expectedTreatmentExecutionVersion",
      ),
      performedTreatmentLevelId: integer(
        formData,
        "performedTreatmentLevelId",
      ),
      performedMechanicalActionLevelId: integer(
        formData,
        "performedMechanicalActionLevelId",
      ),
      performedTreatmentApproachId: integer(
        formData,
        "performedTreatmentApproachId",
      ),
      performedAddonIds: integerList(formData, "performedAddonIds"),
      cleaningProductId: nullableInteger(formData, "cleaningProductId"),
      technicianNotes: nullableText(formData, "technicianNotes"),
      resultClassification: scalar(formData, "resultClassification"),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "jobReference",
          "jobItemId",
          "expectedJobVersion",
          "expectedJobItemVersion",
          "treatmentExecutionId",
          "expectedTreatmentExecutionVersion",
          "performedTreatmentLevelId",
          "performedMechanicalActionLevelId",
          "performedTreatmentApproachId",
          "performedAddonIds",
          "cleaningProductId",
          "technicianNotes",
          "resultClassification",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().completeTreatment(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function completeJobAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("UPDATE");
  if ("status" in context) return context;
  if (checked(formData, "completionAcknowledged") !== true) {
    return {
      status: "ERROR",
      message: messages[context.locale].invalid,
      fieldErrors: {
        completionAcknowledged: [messages[context.locale].invalid],
      },
    };
  }
  const parsed = parseInput(
    completeJobSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      internalCompletionNotes: scalar(formData, "internalCompletionNotes"),
      customerVisibleCompletionNotes: nullableText(
        formData,
        "customerVisibleCompletionNotes",
      ),
      customerVisibleCareNotes: nullableText(
        formData,
        "customerVisibleCareNotes",
      ),
      maintenanceRecommendations: [],
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "jobReference",
          "expectedJobVersion",
          "internalCompletionNotes",
          "customerVisibleCompletionNotes",
          "customerVisibleCareNotes",
          "completionAcknowledged",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().completeJob(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    revalidatePath("/app/my-properties");
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}

export async function cancelJobAction(
  _previousState: JobActionState,
  formData: FormData,
): Promise<JobActionState> {
  const context = await authenticatedMutationContext("CANCEL");
  if ("status" in context) return context;
  const parsed = parseInput(
    cancelJobSchema,
    {
      jobReference: scalar(formData, "jobReference"),
      expectedJobVersion: integer(formData, "expectedJobVersion"),
      reasonCategory: scalar(formData, "reasonCategory"),
      reasonText: nullableText(formData, "reasonText"),
      ...rejectUnexpectedFields(
        formData,
        new Set([
          "jobReference",
          "expectedJobVersion",
          "reasonCategory",
          "reasonText",
        ]),
      ),
    },
    context.locale,
  );
  if ("failure" in parsed) return parsed.failure;
  try {
    const result = await service().cancelJob(context.actor, parsed.data);
    revalidateJob(result.jobReference);
    return mutationSuccess(result.status, context.locale);
  } catch (error) {
    return failureState(error, context.locale);
  }
}
