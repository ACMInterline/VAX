import { createHash } from "node:crypto";
import {
  attelierAppointmentWindows,
  attelierServiceAreas,
  attelierWorkingHourPolicy,
} from "@/modules/availability-engine/attelier-config";
import {
  attelierB2bPriceBook,
  attelierDurationModel,
  attelierResidentialPriceBook,
} from "@/modules/commercial-engine/attelier-config";
import { publicBrand } from "@/config/public-site";
import { marketingClaimRegistry } from "@/content/public-site/claims";
import {
  cleaningItemTypes,
  services,
  treatmentLevels,
} from "@/modules/service-catalogue/catalogue";
import { getVaxEnvironment } from "@/operations/environment";
import type { ConfigurationReferenceSnapshot } from "./readiness";

export const attelierAuthoritySourceReference =
  "ATTELIER_OWNER_DIRECTIVE_2026_09_05" as const;
export const attelierStagingResolverId =
  "ATTELIER_EXACT_CODE_CONFIGURATION" as const;
export const attelierStagingResolverVersion = "1" as const;
export const attelierAuthorityEffectiveFrom = new Date(
  "2026-09-05T00:00:00.000Z",
);

type ExactConfiguration = Readonly<{
  authorityKey: string;
  subjectType: string;
  subjectCode: string;
  subjectVersion: number;
  value: unknown;
}>;

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalValue(entry)]),
    );
  }
  return value;
}

export function exactConfigurationSha256(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalValue(value)))
    .digest("hex");
}

const exactConfigurations = [
  {
    authorityKey: "BRAND_IDENTITY",
    subjectType: "BRAND_IDENTITY",
    subjectCode: "ATTELIER_BRAND_V1",
    subjectVersion: 1,
    value: {
      name: publicBrand.name,
      descriptorEn: "Textile Care",
      descriptorBg: "Професионална грижа за текстила",
      registeredTrademarkClaim: false,
    },
  },
  {
    authorityKey: "PUBLIC_CLAIMS",
    subjectType: "PUBLIC_CLAIM_CATALOG",
    subjectCode: "ATTELIER_PUBLIC_CLAIMS_V1",
    subjectVersion: 1,
    value: marketingClaimRegistry.map((claim) => ({
      id: claim.id,
      status: claim.status,
      publicationWording: claim.publicationWording,
    })),
  },
  {
    authorityKey: "SERVICE_SCOPE",
    subjectType: "SERVICE_CATALOG",
    subjectCode: "ATTELIER_LAUNCH_SERVICE_SCOPE_V1",
    subjectVersion: 1,
    value: {
      serviceCodes: services.map((service) => service.code),
      defaultDelivery: "ON_SITE_WHERE_TECHNICALLY_APPROPRIATE",
      biologicalContamination: "DECLINE_OR_REFER",
    },
  },
  {
    authorityKey: "ITEM_TAXONOMY_SCOPE",
    subjectType: "ITEM_TAXONOMY",
    subjectCode: "ATTELIER_LAUNCH_ITEM_SCOPE_V1",
    subjectVersion: 1,
    value: cleaningItemTypes.map((item) => item.code),
  },
  {
    authorityKey: "MATERIAL_SPECIALIST_SCOPE",
    subjectType: "MATERIAL_POLICY_CATALOG",
    subjectCode: "ATTELIER_MATERIAL_SAFETY_V1",
    subjectVersion: 1,
    value: {
      delicateOrUncertain: "ASSESSMENT_REQUIRED",
      preservationPriority: true,
      unsafeIntervention: "STOP_REFER_OR_DECLINE",
      stainRemovalGuarantee: false,
    },
  },
  {
    authorityKey: "DRYING_REUSE_GUIDANCE",
    subjectType: "DRYING_GUIDANCE_CATALOG",
    subjectCode: "ATTELIER_DRYING_GUIDANCE_V1",
    subjectVersion: 1,
    value: {
      methodObjective: "LOW_RESIDUAL_MOISTURE",
      universalDryingPromise: false,
      qualifiedGuidance:
        "Several hours may be appropriate depending on material, treatment and environment; the technician provides item-specific guidance.",
    },
  },
  {
    authorityKey: "DURATION_MODEL",
    subjectType: "DURATION_MODEL",
    subjectCode: attelierDurationModel.code,
    subjectVersion: attelierDurationModel.version,
    value: attelierDurationModel,
  },
  {
    authorityKey: "WORKING_HOURS",
    subjectType: "WORKING_HOURS",
    subjectCode: attelierWorkingHourPolicy.code,
    subjectVersion: attelierWorkingHourPolicy.version,
    value: attelierWorkingHourPolicy,
  },
  {
    authorityKey: "APPOINTMENT_WINDOWS",
    subjectType: "APPOINTMENT_WINDOWS",
    subjectCode: "ATTELIER_APPOINTMENT_WINDOWS_V1",
    subjectVersion: 1,
    value: attelierAppointmentWindows,
  },
  {
    authorityKey: "SOFIA_SERVICE_ZONES",
    subjectType: "SOFIA_SERVICE_ZONE_CATALOG",
    subjectCode: "ATTELIER_SERVICE_ZONES_V1",
    subjectVersion: 1,
    value: attelierServiceAreas,
  },
  {
    authorityKey: "TRAVEL_PARKING_ROUTING",
    subjectType: "TRAVEL_PARKING_ROUTING",
    subjectCode: "ATTELIER_ACCESS_POLICY_V1",
    subjectVersion: 1,
    value: {
      normalAccess: "INCLUDED",
      paidParking: "DOCUMENTED_COST_NO_MARKUP",
      stairs: "NO_STANDARD_SURCHARGE",
      lightFurnitureMovement: "INCLUDED_WHEN_SAFE",
      majorRemovalOrDisassembly: "EXCLUDED",
      unsafeAccess: "MAY_DECLINE",
      exceptionalCost: "DISCLOSE_BEFORE_CONFIRMATION",
      automaticRouting: false,
    },
  },
  {
    authorityKey: "JOB_OPERATING_POLICY",
    subjectType: "JOB_OPERATING_POLICY",
    subjectCode: "ATTELIER_JOB_POLICY_V1",
    subjectVersion: 1,
    value: {
      arrivalToleranceMinutes: { sofia: 15, zoneCAndD: 30 },
      inspectionRequired: true,
      unsafeTreatment: "STOP_REFER_OR_DECLINE",
      scopeChange: "STAFF_APPROVAL_REQUIRED",
      concernWindowHours: 48,
      refundDecision: "MANAGEMENT",
      statutoryRightsLimited: false,
    },
  },
  {
    authorityKey: "PASSPORT_MAINTENANCE_POLICY",
    subjectType: "PASSPORT_MAINTENANCE_POLICY",
    subjectCode: "ATTELIER_PASSPORT_MAINTENANCE_V1",
    subjectVersion: 1,
    value: {
      cleaningPassport: "CUSTOMER_FEATURE",
      automaticBooking: false,
      advisoryMonths: {
        lowUseResidential: [12, 18],
        normalResidential: [6, 12],
        highUseResidential: [4, 6],
        intensiveOrPetHousehold: [3, 6],
        moderateCommercial: [3, 6],
        highTrafficCommercial: [1, 3],
      },
      specialist: "CONDITION_AND_MATERIAL_BASED",
    },
  },
  {
    authorityKey: "AUTH_PROVIDER_RISK",
    subjectType: "AUTH_PROVIDER_RISK_ASSESSMENT",
    subjectCode: "NEON_AUTH_INITIAL_OPERATIONS_V1",
    subjectVersion: 1,
    value: {
      provider: "NEON_AUTH",
      decision: "ACCEPTED_FOR_INITIAL_ATTELIER_OPERATIONS",
      limitationsRemainDocumented: true,
    },
  },
  {
    authorityKey: "MONITORING_OWNERSHIP",
    subjectType: "MONITORING_OWNERSHIP",
    subjectCode: "ATTELIER_MONITORING_POLICY_V1",
    subjectVersion: 1,
    value: {
      coverage: "BUSINESS_HOURS",
      primaryRecipient: "OWNER_ADMIN",
      severities: ["CRITICAL", "IMPORTANT", "INFORMATIONAL"],
      uptimeSlaClaim: false,
    },
  },
] as const satisfies readonly ExactConfiguration[];

const pendingConfigurations = [
  {
    authorityKey: "TREATMENT_PRODUCT_POLICY",
    subjectType: "TREATMENT_PRODUCT_CATALOG",
    subjectCode: "ATTELIER_TREATMENT_PRODUCT_POLICY_V1",
    subjectVersion: 1,
    value: {
      treatmentLevels: treatmentLevels.map((level) => ({
        code: level.code,
        label: level.label,
      })),
      defaultTreatment: "DEEP_CLEAN",
      technicianConfirmationRequired: true,
      intendedProductEcosystem: "GENUINE_VAX_PRODUCTS",
      actualProductRecordsVerified: false,
      manufacturerEvidenceVerified: false,
    },
  },
  {
    authorityKey: "RESIDENTIAL_PRICE_BOOK",
    subjectType: "PRICE_BOOK",
    subjectCode: attelierResidentialPriceBook.code,
    subjectVersion: attelierResidentialPriceBook.version,
    value: attelierResidentialPriceBook,
  },
  {
    authorityKey: "B2B_PRICE_BOOK",
    subjectType: "PRICE_BOOK",
    subjectCode: attelierB2bPriceBook.code,
    subjectVersion: attelierB2bPriceBook.version,
    value: attelierB2bPriceBook,
  },
  {
    authorityKey: "TIMING_SURCHARGES",
    subjectType: "TIMING_SURCHARGE_CATALOG",
    subjectCode: "ATTELIER_TIMING_SURCHARGES_V1",
    subjectVersion: 1,
    value: attelierResidentialPriceBook.rules.filter(
      (rule) => rule.type === "TIMING_MODIFIER",
    ),
  },
  {
    authorityKey: "QUOTE_BOOKING_TERMS",
    subjectType: "QUOTE_BOOKING_TERMS",
    subjectCode: "ATTELIER_QUOTE_BOOKING_TERMS_V1",
    subjectVersion: 1,
    value: {
      quoteValidityDays: 7,
      bookingRequires: ["QUOTE_ACCEPTANCE", "FRESH_AVAILABILITY"],
      deposits: {
        zoneAAndB: "NORMALLY_NONE",
        zoneC: "MAY_BE_REQUIRED",
        zoneDPercentage: 30,
        largeOrSpecialPercentage: 30,
        b2b: "QUOTED",
      },
      cancellation: "FREE_MORE_THAN_24_HOURS",
      reschedule: "ONE_FREE_UP_TO_12_HOURS_SUBJECT_TO_AVAILABILITY",
      latePenalty: "INACTIVE_PENDING_LEGAL_REVIEW",
    },
  },
  {
    authorityKey: "TEAM_CAPACITY",
    subjectType: "TEAM_CAPACITY",
    subjectCode: "ATTELIER_CAPACITY_TARGET_V1",
    subjectVersion: 1,
    value: {
      operationalStaffTarget: 4,
      normalTeamTarget: 2,
      peoplePerTeam: 2,
      maximumNormalSimultaneousJobs: 2,
      soloOperation: false,
      actualStaffVerified: false,
    },
  },
  {
    authorityKey: "EQUIPMENT_INVENTORY",
    subjectType: "EQUIPMENT_INVENTORY",
    subjectCode: "ATTELIER_EQUIPMENT_REQUIREMENT_V1",
    subjectVersion: 1,
    value: {
      independentPrimaryEquipmentSetsRequired: 2,
      actualInventoryVerified: false,
      manufacturerModelsAsserted: false,
      serialNumbersAsserted: false,
    },
  },
  {
    authorityKey: "AUTH_SESSION_POLICY",
    subjectType: "AUTH_SESSION_POLICY",
    subjectCode: "ATTELIER_AUTH_SESSION_POLICY_V1",
    subjectVersion: 1,
    value: {
      providerManagedSessions: true,
      suspendedUsersFailClosed: true,
      providerLimitationsRemainDocumented: true,
      maximumLifetimeVerified: false,
      providerRevocationVerified: false,
    },
  },
  {
    authorityKey: "RECOVERY_OBJECTIVES",
    subjectType: "RECOVERY_OBJECTIVES",
    subjectCode: "ATTELIER_RECOVERY_OBJECTIVES_V1",
    subjectVersion: 1,
    value: {
      rpoMinutes: 24 * 60,
      rtoBusinessMinutes: 4 * 60,
      portableBackupObjectiveMinutes: 24 * 60,
      restoreRehearsal: "QUARTERLY",
      backupRetentionApproved: false,
      serviceLevelAgreement: false,
    },
  },
  {
    authorityKey: "PAYMENT_TERMS",
    subjectType: "PAYMENT_TERMS",
    subjectCode: "ATTELIER_PAYMENT_TERMS_V1",
    subjectVersion: 1,
    value: {
      residentialTiming: "AFTER_COMPLETION",
      residentialMethods: ["CASH", "BANK_TRANSFER"],
      cardOrPaymentLink: "FUTURE",
      b2bDueDays: { newCustomer: [0, 7], establishedMaximum: 14, exception: 30 },
      bankDetailsConfigured: false,
    },
  },
  {
    authorityKey: "FINANCE_FISCAL_POLICY",
    subjectType: "FINANCE_FISCAL_POLICY",
    subjectCode: "ATTELIER_FINANCE_BOUNDARY_V1",
    subjectVersion: 1,
    value: {
      customerPricesAvailableForStaging: true,
      sellerIdentityVerified: false,
      vatStatusVerified: false,
      statutoryInvoiceAuthority: false,
      paymentIntegrationEnabled: false,
    },
  },
] as const satisfies readonly ExactConfiguration[];

export const attelierExactConfigurationDefinitions = exactConfigurations.map(
  (configuration) => ({
    ...configuration,
    contentSha256: exactConfigurationSha256(configuration.value),
  }),
);

export const attelierPendingConfigurationDefinitions = pendingConfigurations.map(
  (configuration) => ({
    ...configuration,
    contentSha256: exactConfigurationSha256(configuration.value),
  }),
);

export function resolveAttelierStagingConfigurationReferences(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): readonly ConfigurationReferenceSnapshot[] {
  if (getVaxEnvironment(environment) !== "staging") return [];
  return attelierExactConfigurationDefinitions.map((configuration) => ({
    resolverId: attelierStagingResolverId,
    resolverVersion: attelierStagingResolverVersion,
    subjectType: configuration.subjectType,
    subjectCode: configuration.subjectCode,
    subjectVersion: configuration.subjectVersion,
    contentSha256: configuration.contentSha256,
    environmentScope: "STAGING",
    status: "ACTIVE",
    provisional: false,
    unresolvedManualReview: false,
    effectiveFrom: attelierAuthorityEffectiveFrom,
    effectiveUntil: null,
    supersededAt: null,
    supersededByReference: null,
  }));
}

export function attelierExactConfigurationForAuthority(authorityKey: string) {
  return attelierExactConfigurationDefinitions.find(
    (configuration) => configuration.authorityKey === authorityKey,
  );
}
