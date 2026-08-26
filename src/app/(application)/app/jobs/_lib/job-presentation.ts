import type { AuthLocale } from "@/auth/validation";
import type {
  CustomerCleaningPassport,
  JobOption,
  StaffAssetHistory,
  TechnicianJobDetail as TechnicianJobDetailView,
  TechnicianJobListItem,
  TreatmentExecutionFormOptions,
  TreatmentPlanFormOptions,
} from "@/components/job-execution";
import type {
  CleaningPassportPage,
  JobPage,
  StaffCleaningPassportEntry,
  StaffJobDetail,
  TechnicianJobDetail,
} from "@/modules/job-execution/types";

export type JobReferenceData = Readonly<{
  services: readonly JobOption[];
  cleaningItemTypes: readonly JobOption[];
  measurementModes: readonly JobOption[];
  conditions: readonly JobOption[];
  materials: readonly JobOption[];
  constructions: readonly JobOption[];
  issues: readonly JobOption[];
  risks: readonly JobOption[];
  treatmentLevels: readonly JobOption[];
  mechanicalActions: readonly JobOption[];
  treatmentApproaches: readonly JobOption[];
  addons: readonly JobOption[];
  products: readonly JobOption[];
}>;

export type JobRouteOptions = JobReferenceData &
  Readonly<{
    teams: readonly JobOption[];
  }>;

function label(
  options: readonly JobOption[],
  id: number | null,
): string | null {
  if (id === null) return null;
  return options.find((option) => option.id === String(id))?.label ?? null;
}

function labels(options: readonly JobOption[], ids: readonly number[]) {
  return ids.flatMap((id) => {
    const value = label(options, id);
    return value ? [value] : [];
  });
}

function plannedReportedIssueIds(value: unknown): readonly number[] {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return [];
  }
  const reportedIssues = (value as Record<string, unknown>).reportedIssues;
  if (!Array.isArray(reportedIssues)) return [];

  const issueIds = new Set<number>();
  for (const reportedIssue of reportedIssues) {
    if (
      typeof reportedIssue !== "object" ||
      reportedIssue === null ||
      Array.isArray(reportedIssue)
    ) {
      continue;
    }
    const issueTypeId = (reportedIssue as Record<string, unknown>).issueTypeId;
    if (
      typeof issueTypeId === "number" &&
      Number.isSafeInteger(issueTypeId) &&
      issueTypeId > 0 &&
      issueTypeId <= 2_147_483_647
    ) {
      issueIds.add(issueTypeId);
    }
  }
  return [...issueIds];
}

function formatMeasurement(
  locale: AuthLocale,
  input: Readonly<{
    quantity: number;
    areaHundredthsM2: number | null;
    seatCount: number | null;
    sides: 1 | 2 | null;
  }>,
): string {
  const values = [
    locale === "bg"
      ? `Количество: ${input.quantity}`
      : `Quantity: ${input.quantity}`,
  ];
  if (input.areaHundredthsM2 !== null) {
    values.push(
      `${new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-GB").format(input.areaHundredthsM2 / 100)} m²`,
    );
  }
  if (input.seatCount !== null) {
    values.push(
      locale === "bg"
        ? `${input.seatCount} места`
        : `${input.seatCount} seats`,
    );
  }
  if (input.sides !== null) {
    values.push(
      locale === "bg"
        ? `${input.sides} ${input.sides === 1 ? "страна" : "страни"}`
        : `${input.sides} ${input.sides === 1 ? "side" : "sides"}`,
    );
  }
  return values.join(" · ");
}

export function presentJobPage(
  page: JobPage,
  locale: AuthLocale,
): readonly TechnicianJobListItem[] {
  return page.items.map((job) => ({
    reference: job.jobReference,
    status: job.status,
    scheduledStart: job.scheduledStart,
    plannedDurationMinutes:
      job.scheduledStart && job.scheduledEnd
        ? Math.max(
            0,
            Math.round(
              (job.scheduledEnd.valueOf() - job.scheduledStart.valueOf()) /
                60_000,
            ),
          )
        : null,
    customerDisplayName: job.customerDisplayName,
    propertyLabel: job.propertyLabel,
    serviceAddress: job.propertyAddress,
    accessInstructions: job.accessInstructions,
    assignedTeamLabel: job.assignedTeamName,
    itemLabels: [
      locale === "bg"
        ? `${job.itemCount} обекта`
        : `${job.itemCount} ${job.itemCount === 1 ? "item" : "items"}`,
    ],
    reviewReasons: job.manualReviewRequired
      ? [
          locale === "bg"
            ? "Задачата не е готова за изпълнение."
            : "This job is not ready for execution.",
        ]
      : [],
  }));
}

function methodLabel(
  values: readonly (string | null)[],
): string | null {
  const available = values.filter((value): value is string => Boolean(value));
  return available.length > 0 ? available.join(" · ") : null;
}

export function presentJobDetail(
  job: StaffJobDetail | TechnicianJobDetail,
  references: JobReferenceData,
  locale: AuthLocale,
): TechnicianJobDetailView {
  const reviewReasons = job.manualReviewRequired
    ? [
        locale === "bg"
          ? "Изисква се преглед от оторизиран служител преди изпълнение."
          : "Authorized staff review is required before execution.",
      ]
    : [];

  return {
    reference: job.jobReference,
    status: job.status,
    version: job.version,
    scheduledStart: job.scheduledStart,
    plannedDurationMinutes: job.plannedDurationMinutes,
    customerDisplayName: job.customerDisplayName,
    propertyLabel: job.property.label,
    serviceAddress: job.property.address,
    assignedTeamLabel: job.assignedTeamName,
    visitContact: job.visitContact
      ? {
          name: job.visitContact.contactName,
          phone: job.visitContact.phone,
        }
      : null,
    accessInstructions: job.property.accessNotes,
    parkingInstructions: job.property.parkingNotes,
    customerServiceNotes: job.customerServiceNotes,
    reviewReasons,
    items: job.items.map((item) => {
      const plannedItemLabel =
        locale === "bg" ? item.planned.descriptionBg : item.planned.descriptionEn;
      const inspection = item.inspection;
      const plan = item.treatmentPlan;
      const execution = item.treatmentExecution;
      return {
        id: item.id,
        status: item.status,
        planned: {
          serviceLabel:
            label(references.services, item.planned.serviceId) ?? plannedItemLabel,
          itemLabel: plannedItemLabel,
          quantityLabel: String(item.planned.measurement.quantity),
          measurementLabel: formatMeasurement(locale, item.planned.measurement),
          reportedConditionLabel: label(
            references.conditions,
            item.planned.plannedConditionLevelId,
          ),
          reportedMaterialLabel: label(
            references.materials,
            item.planned.plannedFibreMaterialId,
          ),
          reportedConstructionLabel: label(
            references.constructions,
            item.planned.plannedSurfaceConstructionId,
          ),
          reportedIssueLabels: labels(
            references.issues,
            plannedReportedIssueIds(item.planned.treatmentAssumptions),
          ),
          requestedAddonLabels: labels(
            references.addons,
            item.planned.quotedAddonIds,
          ),
          customerDescription: item.planned.customerDescription || null,
        },
        observed: inspection
          ? {
              inspectedAt: inspection.inspectedAt,
              conditionLabel:
                label(references.conditions, inspection.observedConditionLevelId) ??
                inspection.observedConditionCode,
              materialLabel: label(
                references.materials,
                inspection.confirmedFibreMaterialId,
              ),
              constructionLabel: label(
                references.constructions,
                inspection.confirmedSurfaceConstructionId,
              ),
              measurementLabel: formatMeasurement(
                locale,
                inspection.observedMeasurement,
              ),
              issueLabels: labels(
                references.issues,
                inspection.issues.map((issue) => issue.issueTypeId),
              ),
              riskLabels: labels(
                references.risks,
                inspection.risks.map((risk) => risk.riskFlagId),
              ),
            }
          : null,
        confirmedTreatment: plan
          ? {
              confirmedAt: plan.confirmedAt,
              decision: plan.decision,
              methodLabel: methodLabel([
                label(references.treatmentLevels, plan.treatmentLevelId),
                label(references.mechanicalActions, plan.mechanicalActionLevelId),
                label(references.treatmentApproaches, plan.treatmentApproachId),
              ]),
              addonLabels: labels(references.addons, plan.addonIds),
              productLabel: label(references.products, plan.cleaningProductId),
            }
          : null,
        performed:
          execution && execution.resultClassification
            ? {
                startedAt: execution.startedAt,
                completedAt: execution.completedAt,
                resultClassification: execution.resultClassification,
                methodLabel: methodLabel([
                  label(
                    references.treatmentLevels,
                    execution.performedTreatmentLevelId,
                  ),
                  label(
                    references.mechanicalActions,
                    execution.performedMechanicalActionLevelId,
                  ),
                  label(
                    references.treatmentApproaches,
                    execution.performedTreatmentApproachId,
                  ),
                ]),
                addonLabels: labels(
                  references.addons,
                  execution.performedAddonIds,
                ),
                productLabel: label(
                  references.products,
                  execution.cleaningProductId,
                ),
                customerVisibleSummary: null,
                careInstructions: null,
              }
            : null,
      };
    }),
  };
}

export function treatmentExecutionOptions(
  references: JobReferenceData,
): TreatmentExecutionFormOptions {
  return {
    treatmentLevels: references.treatmentLevels,
    mechanicalActions: references.mechanicalActions,
    treatmentApproaches: references.treatmentApproaches,
    addons: references.addons,
    products: references.products,
  };
}

export function treatmentPlanOptions(
  references: JobReferenceData,
  quotedAddonIds: readonly number[],
): TreatmentPlanFormOptions {
  const quotedAddons = new Set(quotedAddonIds.map(String));
  return {
    ...treatmentExecutionOptions(references),
    addons: references.addons.filter((addon) => quotedAddons.has(addon.id)),
  };
}

export function presentCustomerPassport(
  passport: CleaningPassportPage,
  propertyLabel: string,
): CustomerCleaningPassport {
  return {
    assetLabel: passport.assetLabel,
    propertyLabel,
    entries: passport.entries,
  };
}

export function presentStaffAssetHistory(
  history: Readonly<{
    assetLabel: string;
    entries: readonly StaffCleaningPassportEntry[];
  }>,
  propertyLabel: string,
): StaffAssetHistory {
  return {
    assetLabel: history.assetLabel,
    propertyLabel,
    entries: history.entries.map((entry) => ({
      id: entry.id,
      jobReference: entry.jobReference,
      completedAt: entry.completedAt,
      serviceDescription: entry.serviceDescription,
      observedConditionSummary: entry.observedConditionSummary,
      treatmentSummary: entry.treatmentSummary,
      resultClassification: entry.resultClassification,
      inspectionIssueSummary: entry.inspectionIssueSummary,
      inspectionRiskSummary: entry.inspectionRiskSummary,
      careRecommendation: entry.careRecommendation,
      maintenanceRecommendation: entry.maintenanceRecommendation,
    })),
  };
}
