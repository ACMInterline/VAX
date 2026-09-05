import { getBusinessAuthorityDefinition } from "./registry";
import type { AuthorityType } from "./types";
import type { AuthorityProposalInput, AuthorityValue } from "./validation";
import {
  attelierAuthorityEffectiveFrom,
  attelierAuthoritySourceReference,
  attelierExactConfigurationDefinitions,
  attelierPendingConfigurationDefinitions,
} from "./attelier-staging-config";

export type AttelierStagingAuthorityPlanItem = Readonly<{
  proposal: AuthorityProposalInput;
  approvalAuthorityTypes: readonly AuthorityType[];
  expectedStatus: "APPROVED_FOR_STAGING" | "UNDER_REVIEW";
}>;

function proposal(
  authorityKey: string,
  value: AuthorityValue,
  summary: string,
): AuthorityProposalInput {
  const definition = getBusinessAuthorityDefinition(authorityKey);
  if (!definition) throw new Error(`Unknown ATTELIER authority: ${authorityKey}`);
  return {
    authorityKey,
    environmentScope: "STAGING",
    value,
    sourceReference: attelierAuthoritySourceReference,
    safeEvidenceSummary: summary,
    internalNotes:
      "Prospective ATTELIER staging authority only. Historical commercial and operational records remain immutable. Production is not authorized.",
    effectiveFrom: attelierAuthorityEffectiveFrom,
    effectiveUntil: null,
  };
}

function configurationReference(
  configuration: Readonly<{
    subjectType: string;
    subjectCode: string;
    subjectVersion: number;
    contentSha256: string;
  }>,
): Extract<AuthorityValue, { kind: "CONFIG_REFERENCE" }> {
  return {
    kind: "CONFIG_REFERENCE",
    subjectType: configuration.subjectType,
    subjectCode: configuration.subjectCode,
    subjectVersion: configuration.subjectVersion,
    contentSha256: configuration.contentSha256,
  };
}

const approvedConfigurationItems = attelierExactConfigurationDefinitions.map(
  (configuration): AttelierStagingAuthorityPlanItem => {
    const definition = getBusinessAuthorityDefinition(configuration.authorityKey);
    if (!definition) {
      throw new Error(`Unknown ATTELIER authority: ${configuration.authorityKey}`);
    }
    return {
      proposal: proposal(
        configuration.authorityKey,
        configurationReference(configuration),
        `Exact ATTELIER staging configuration for ${configuration.authorityKey}.`,
      ),
      approvalAuthorityTypes: definition.requiredAuthorityTypes,
      expectedStatus: "APPROVED_FOR_STAGING",
    };
  },
);

const pendingApprovalTypes: Readonly<Record<string, readonly AuthorityType[]>> = {
  TREATMENT_PRODUCT_POLICY: ["OWNER", "OPERATIONS"],
  RESIDENTIAL_PRICE_BOOK: ["OWNER"],
  B2B_PRICE_BOOK: ["OWNER"],
  TIMING_SURCHARGES: ["OWNER"],
  QUOTE_BOOKING_TERMS: ["OWNER"],
  TEAM_CAPACITY: ["OWNER"],
  EQUIPMENT_INVENTORY: ["OWNER"],
  AUTH_SESSION_POLICY: ["OWNER"],
  RECOVERY_OBJECTIVES: ["OWNER"],
  PAYMENT_TERMS: ["OWNER"],
  FINANCE_FISCAL_POLICY: ["OWNER"],
};

const pendingConfigurationItems = attelierPendingConfigurationDefinitions.map(
  (configuration): AttelierStagingAuthorityPlanItem => ({
    proposal: proposal(
      configuration.authorityKey,
      configurationReference(configuration),
      `ATTELIER staging proposal for ${configuration.authorityKey}; required external or operational evidence remains missing.`,
    ),
    approvalAuthorityTypes:
      pendingApprovalTypes[configuration.authorityKey] ?? [],
    expectedStatus: "UNDER_REVIEW",
  }),
);

const retentionRules = [
  ["AUTH_SECURITY", null],
  ["CRM", 5 * 365],
  ["ANONYMOUS_REQUESTS", 365],
  ["QUOTES", 2 * 365],
  ["BOOKINGS", 5 * 365],
  ["JOBS", 5 * 365],
  ["PASSPORT", null],
  ["FINANCE", null],
  ["COMMUNICATIONS_DOCUMENTS", null],
] as const;

const directItems: readonly AttelierStagingAuthorityPlanItem[] = [
  {
    proposal: proposal(
      "AVAILABILITY_POLICY",
      {
        kind: "POLICY_SET",
        entries: [
          {
            code: "QUOTE_MODE",
            decision: "ASSESSMENT_REQUIRED",
            numericValue: null,
            unit: null,
          },
          {
            code: "BOOKING_MODE",
            decision: "STAFF_CONFIRMATION_REQUIRED",
            numericValue: null,
            unit: null,
          },
        ],
      },
      "Quotes and bookings require staff assessment and fresh availability confirmation.",
    ),
    approvalAuthorityTypes: ["OWNER", "OPERATIONS"],
    expectedStatus: "APPROVED_FOR_STAGING",
  },
  {
    proposal: proposal(
      "VAT_TAX_STATUS",
      {
        kind: "DECISION",
        decisionCode: "REVIEW_REQUIRED",
        detailsBg: "ДДС статусът остава непотвърден до определяне на юридическото лице и счетоводен преглед.",
        detailsEn:
          "VAT status remains unresolved pending legal-entity selection and Accountant review.",
      },
      "Owner confirms that VAT status is unresolved; no statutory tax treatment may be inferred.",
    ),
    approvalAuthorityTypes: ["OWNER"],
    expectedStatus: "UNDER_REVIEW",
  },
  {
    proposal: proposal(
      "PRIVACY_RETENTION",
      {
        kind: "RETENTION_POLICY",
        automaticDeletionEnabled: false,
        rules: retentionRules.map(([category, retentionDays]) => ({
          category,
          status: "OWNER_PROPOSED" as const,
          retentionDays,
          erasureException: "LEGAL_REVIEW_REQUIRED" as const,
        })),
      },
      "Owner-proposed retention targets are recorded without enabling automatic deletion; Legal review remains required.",
    ),
    approvalAuthorityTypes: ["OWNER"],
    expectedStatus: "UNDER_REVIEW",
  },
];

export const attelierStagingAuthorityPlan = [
  ...approvedConfigurationItems,
  ...directItems,
  ...pendingConfigurationItems,
] as const satisfies readonly AttelierStagingAuthorityPlanItem[];

export const attelierApprovedStagingAuthorityKeys =
  attelierStagingAuthorityPlan
    .filter((item) => item.expectedStatus === "APPROVED_FOR_STAGING")
    .map((item) => item.proposal.authorityKey);

export const attelierPendingStagingAuthorityKeys = attelierStagingAuthorityPlan
  .filter((item) => item.expectedStatus === "UNDER_REVIEW")
  .map((item) => item.proposal.authorityKey);
