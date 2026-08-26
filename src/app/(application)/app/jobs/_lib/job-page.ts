import "server-only";

import { asc, eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import type { AuthLocale } from "@/auth/validation";
import type { JobOption } from "@/components/job-execution";
import { getDatabase } from "@/db/client";
import { operationsTeams } from "@/db/schema/availability-engine";
import {
  cleaningItemTypes,
  cleaningProducts,
  conditionLevels,
  fibreMaterials,
  issueTypes,
  mechanicalActionLevels,
  measurementModes,
  riskFlags,
  serviceAddons,
  services as catalogueServices,
  surfaceConstructions,
  treatmentApproaches,
  treatmentLevels,
} from "@/db/schema/service-catalogue";
import type { JobActor } from "@/modules/job-execution/policy";
import { createDatabaseJobExecutionRepository } from "@/modules/job-execution/repository";
import {
  createJobExecutionService,
  JobExecutionServiceError,
  type JobExecutionService,
} from "@/modules/job-execution/service";
import { jobStatuses } from "@/modules/job-execution/types";
import {
  cleaningPassportRouteSchema,
  jobReferenceSchema,
} from "@/modules/job-execution/validation";
import { requireApplicationPrincipal } from "../../application-principal";
import type { JobReferenceData, JobRouteOptions } from "./job-presentation";

export type JobRouteParams = { jobReference: string };
export type PassportRouteParams = { propertyId: string; assetId: string };
export type StaffPassportRouteParams = PassportRouteParams & {
  customerId: string;
};
export type JobSearchParams = Record<
  string,
  string | string[] | undefined
>;

export type JobPageContext = Readonly<{
  actor: JobActor;
  locale: AuthLocale;
}>;

const jobRouteParamsSchema = z
  .object({ jobReference: jobReferenceSchema })
  .strict();
const staffPassportRouteSchema = cleaningPassportRouteSchema.extend({
  customerId: z.uuid(),
}).strict();
const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
      !Number.isNaN(parsed.valueOf()) &&
      parsed.toISOString().slice(0, 10) === value
    );
  });
const positiveIntegerString = z
  .string()
  .regex(/^\d{1,10}$/)
  .transform(Number)
  .refine(
    (value) => Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647,
  );
const jobSearchParamsSchema = z
  .object({
    search: z.string().trim().max(160).optional(),
    status: z.enum(jobStatuses).optional(),
    teamId: positiveIntegerString.optional(),
    scheduledFrom: dateOnlySchema.optional(),
    scheduledTo: dateOnlySchema.optional(),
    manualReview: z.enum(["true", "false"]).optional(),
    page: z
      .string()
      .regex(/^\d{1,5}$/)
      .transform(Number)
      .refine(
        (value) => Number.isSafeInteger(value) && value > 0 && value <= 4_167,
      )
      .optional(),
  })
  .strict();

function actorFromPrincipal(
  principal: Awaited<ReturnType<typeof requireApplicationPrincipal>>,
): JobActor {
  return {
    profileId: principal.profile.id,
    status: principal.profile.status,
    roles: principal.roles,
    permissions: principal.permissions,
  };
}

async function requireJobPermissions(
  required: readonly (
    | "OWN_CUSTOMER_DATA_READ"
    | "CUSTOMER_RECORDS_READ"
    | "OPERATIONS_READ"
    | "SCHEDULE_READ"
    | "FIELD_JOBS_READ"
  )[],
): Promise<JobPageContext> {
  const principal = await requireApplicationPrincipal();
  if (!required.every((permission) => principal.permissions.has(permission))) {
    redirect("/app?access=denied");
  }
  return {
    actor: actorFromPrincipal(principal),
    locale: principal.profile.preferredLocale,
  };
}

export function requireJobPageContext(): Promise<JobPageContext> {
  return requireJobPermissions([
    "OPERATIONS_READ",
    "SCHEDULE_READ",
    "FIELD_JOBS_READ",
  ]);
}

export function requireCustomerPassportPageContext(): Promise<JobPageContext> {
  return requireJobPermissions(["OWN_CUSTOMER_DATA_READ"]);
}

export function requireStaffPassportPageContext(): Promise<JobPageContext> {
  return requireJobPermissions([
    "CUSTOMER_RECORDS_READ",
    "OPERATIONS_READ",
    "FIELD_JOBS_READ",
  ]);
}

export function createJobPageService(): JobExecutionService {
  return createJobExecutionService(
    createDatabaseJobExecutionRepository(getDatabase()),
  );
}

export async function parseJobRouteParams(
  params: Promise<JobRouteParams>,
): Promise<JobRouteParams> {
  const parsed = jobRouteParamsSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parsePassportRouteParams(
  params: Promise<PassportRouteParams>,
): Promise<PassportRouteParams> {
  const parsed = cleaningPassportRouteSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseStaffPassportRouteParams(
  params: Promise<StaffPassportRouteParams>,
): Promise<StaffPassportRouteParams> {
  const parsed = staffPassportRouteSchema.safeParse(await params);
  if (!parsed.success) notFound();
  return parsed.data;
}

export async function parseJobSearchParams(
  searchParams: Promise<JobSearchParams>,
) {
  const parsed = jobSearchParamsSchema.safeParse(await searchParams);
  if (!parsed.success) notFound();
  const page = parsed.data.page ?? 1;
  const limit = 24;
  const scheduledFrom = parsed.data.scheduledFrom
    ? new Date(`${parsed.data.scheduledFrom}T00:00:00.000Z`)
    : undefined;
  const scheduledTo = parsed.data.scheduledTo
    ? new Date(
        new Date(`${parsed.data.scheduledTo}T00:00:00.000Z`).valueOf() +
          24 * 60 * 60 * 1_000,
      )
    : undefined;
  if (
    scheduledFrom &&
    scheduledTo &&
    scheduledFrom.valueOf() >= scheduledTo.valueOf()
  ) {
    notFound();
  }
  return {
    filters: {
      search: parsed.data.search || undefined,
      status: parsed.data.status,
      teamId: parsed.data.teamId,
      scheduledFrom,
      scheduledTo,
      manualReviewRequired:
        parsed.data.manualReview === undefined
          ? undefined
          : parsed.data.manualReview === "true",
      limit,
      offset: (page - 1) * limit,
    },
    page,
    values: {
      search: parsed.data.search,
      status: parsed.data.status,
      teamId: parsed.data.teamId ? String(parsed.data.teamId) : undefined,
      scheduledFrom: parsed.data.scheduledFrom,
      scheduledTo: parsed.data.scheduledTo,
      manualReview: parsed.data.manualReview,
    },
  };
}

export async function loadJobOrNotFound(
  service: JobExecutionService,
  actor: JobActor,
  jobReference: string,
) {
  try {
    return await service.getJob(actor, { jobReference });
  } catch (error) {
    if (
      error instanceof JobExecutionServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export async function loadCustomerPassportOrNotFound(
  service: JobExecutionService,
  actor: JobActor,
  input: PassportRouteParams,
) {
  try {
    return await service.getCustomerPassport(actor, input);
  } catch (error) {
    if (
      error instanceof JobExecutionServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

export async function loadStaffAssetHistoryOrNotFound(
  service: JobExecutionService,
  actor: JobActor,
  input: PassportRouteParams,
) {
  try {
    return await service.getStaffAssetHistory(actor, input);
  } catch (error) {
    if (
      error instanceof JobExecutionServiceError &&
      error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"
    ) {
      notFound();
    }
    throw error;
  }
}

function localizedOptions(
  rows: readonly Readonly<{
    id: number;
    labelBg: string;
    labelEn: string;
  }>[],
  locale: AuthLocale,
): readonly JobOption[] {
  return rows.map((row) => ({
    id: String(row.id),
    label: locale === "bg" ? row.labelBg : row.labelEn,
  }));
}

export async function loadActiveJobTeamOptions(): Promise<
  readonly JobOption[]
> {
  const rows = await getDatabase()
    .select({ id: operationsTeams.id, label: operationsTeams.name })
    .from(operationsTeams)
    .where(eq(operationsTeams.active, true))
    .orderBy(asc(operationsTeams.name));
  return rows.map((row) => ({ id: String(row.id), label: row.label }));
}

export async function loadJobRouteOptions(
  locale: AuthLocale,
): Promise<JobRouteOptions> {
  const database = getDatabase();
  const selectReference = {
    id: measurementModes.id,
    labelBg: measurementModes.labelBg,
    labelEn: measurementModes.labelEn,
  };
  const [
    teamRows,
    serviceRows,
    itemRows,
    measurementRows,
    conditionRows,
    materialRows,
    constructionRows,
    issueRows,
    riskRows,
    treatmentRows,
    mechanicalRows,
    approachRows,
    addonRows,
    productRows,
  ] = await Promise.all([
    loadActiveJobTeamOptions(),
    database
      .select({
        id: catalogueServices.id,
        labelBg: catalogueServices.labelBg,
        labelEn: catalogueServices.labelEn,
      })
      .from(catalogueServices)
      .where(eq(catalogueServices.active, true))
      .orderBy(asc(catalogueServices.sortOrder)),
    database
      .select({
        id: cleaningItemTypes.id,
        labelBg: cleaningItemTypes.labelBg,
        labelEn: cleaningItemTypes.labelEn,
      })
      .from(cleaningItemTypes)
      .where(eq(cleaningItemTypes.active, true))
      .orderBy(asc(cleaningItemTypes.sortOrder)),
    database
      .select(selectReference)
      .from(measurementModes)
      .where(eq(measurementModes.active, true))
      .orderBy(asc(measurementModes.sortOrder)),
    database
      .select({ id: conditionLevels.id, labelBg: conditionLevels.labelBg, labelEn: conditionLevels.labelEn })
      .from(conditionLevels)
      .where(eq(conditionLevels.active, true))
      .orderBy(asc(conditionLevels.sortOrder)),
    database
      .select({ id: fibreMaterials.id, labelBg: fibreMaterials.labelBg, labelEn: fibreMaterials.labelEn })
      .from(fibreMaterials)
      .where(eq(fibreMaterials.active, true))
      .orderBy(asc(fibreMaterials.sortOrder)),
    database
      .select({ id: surfaceConstructions.id, labelBg: surfaceConstructions.labelBg, labelEn: surfaceConstructions.labelEn })
      .from(surfaceConstructions)
      .where(eq(surfaceConstructions.active, true))
      .orderBy(asc(surfaceConstructions.sortOrder)),
    database
      .select({ id: issueTypes.id, labelBg: issueTypes.labelBg, labelEn: issueTypes.labelEn })
      .from(issueTypes)
      .where(eq(issueTypes.active, true))
      .orderBy(asc(issueTypes.sortOrder)),
    database
      .select({ id: riskFlags.id, labelBg: riskFlags.labelBg, labelEn: riskFlags.labelEn })
      .from(riskFlags)
      .where(eq(riskFlags.active, true))
      .orderBy(asc(riskFlags.sortOrder)),
    database
      .select({ id: treatmentLevels.id, labelBg: treatmentLevels.labelBg, labelEn: treatmentLevels.labelEn })
      .from(treatmentLevels)
      .where(eq(treatmentLevels.active, true))
      .orderBy(asc(treatmentLevels.sortOrder)),
    database
      .select({ id: mechanicalActionLevels.id, labelBg: mechanicalActionLevels.labelBg, labelEn: mechanicalActionLevels.labelEn })
      .from(mechanicalActionLevels)
      .where(eq(mechanicalActionLevels.active, true))
      .orderBy(asc(mechanicalActionLevels.sortOrder)),
    database
      .select({ id: treatmentApproaches.id, labelBg: treatmentApproaches.labelBg, labelEn: treatmentApproaches.labelEn })
      .from(treatmentApproaches)
      .where(eq(treatmentApproaches.active, true))
      .orderBy(asc(treatmentApproaches.sortOrder)),
    database
      .select({ id: serviceAddons.id, labelBg: serviceAddons.labelBg, labelEn: serviceAddons.labelEn })
      .from(serviceAddons)
      .where(eq(serviceAddons.active, true))
      .orderBy(asc(serviceAddons.sortOrder)),
    database
      .select({ id: cleaningProducts.id, label: cleaningProducts.productName })
      .from(cleaningProducts)
      .where(eq(cleaningProducts.active, true))
      .orderBy(asc(cleaningProducts.productName)),
  ]);
  return {
    teams: teamRows,
    services: localizedOptions(serviceRows, locale),
    cleaningItemTypes: localizedOptions(itemRows, locale),
    measurementModes: localizedOptions(measurementRows, locale),
    conditions: localizedOptions(conditionRows, locale),
    materials: localizedOptions(materialRows, locale),
    constructions: localizedOptions(constructionRows, locale),
    issues: localizedOptions(issueRows, locale),
    risks: localizedOptions(riskRows, locale),
    treatmentLevels: localizedOptions(treatmentRows, locale),
    mechanicalActions: localizedOptions(mechanicalRows, locale),
    treatmentApproaches: localizedOptions(approachRows, locale),
    addons: localizedOptions(addonRows, locale),
    products: productRows.map((row) => ({ id: String(row.id), label: row.label })),
  };
}

export function referenceData(options: JobRouteOptions): JobReferenceData {
  return {
    services: options.services,
    cleaningItemTypes: options.cleaningItemTypes,
    measurementModes: options.measurementModes,
    conditions: options.conditions,
    materials: options.materials,
    constructions: options.constructions,
    issues: options.issues,
    risks: options.risks,
    treatmentLevels: options.treatmentLevels,
    mechanicalActions: options.mechanicalActions,
    treatmentApproaches: options.treatmentApproaches,
    addons: options.addons,
    products: options.products,
  };
}
