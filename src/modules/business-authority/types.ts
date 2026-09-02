import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";

export const authorityStatuses = [
  "PROPOSED",
  "UNDER_REVIEW",
  "APPROVED_FOR_STAGING",
  "APPROVED_FOR_PRODUCTION",
  "SUPERSEDED",
  "REJECTED",
] as const;

export type AuthorityStatus = (typeof authorityStatuses)[number];

export const authorityEnvironmentScopes = [
  "DEVELOPMENT",
  "STAGING",
  "PRODUCTION",
] as const;

export type AuthorityEnvironmentScope =
  (typeof authorityEnvironmentScopes)[number];

export const authorityTypes = [
  "OWNER",
  "ACCOUNTANT",
  "LEGAL",
  "OPERATIONS",
  "TECHNICAL",
  "CONTENT_CLAIMS",
] as const;

export type AuthorityType = (typeof authorityTypes)[number];

export const authorityEvidenceClasses = [
  "OWNER_INPUT",
  "SYSTEM_VERIFIED",
  "EXTERNAL_EVIDENCE_REQUIRED",
] as const;

export type AuthorityEvidenceClass = (typeof authorityEvidenceClasses)[number];

export const authorityCategories = [
  "BRAND_CONTENT",
  "SERVICE_SCOPE",
  "PRICING",
  "VAT_TAX",
  "SELLER_LEGAL",
  "SCHEDULING",
  "TRAVEL",
  "TEAMS_EQUIPMENT",
  "AUTH",
  "PRIVACY_RETENTION",
  "EMAIL",
  "MONITORING",
  "BACKUP_RECOVERY",
  "FINANCE_FISCAL",
  "DATABASE",
  "DOMAIN_TLS",
  "DEPLOYMENT_AUTHORIZATION",
] as const;

export type AuthorityCategory = (typeof authorityCategories)[number];

export const authorityValueKinds = [
  "DECISION",
  "CONFIG_REFERENCE",
  "MONEY",
  "RATE",
  "DURATION_CALIBRATION",
  "TIME_WINDOWS",
  "TRAVEL_POLICY",
  "RETENTION_POLICY",
  "INVOICE_NUMBERING",
  "ENDPOINTS",
  "PROVIDER_DECISION",
  "SCOPE_DECISIONS",
  "CLAIM_DECISIONS",
  "POLICY_SET",
  "BUSINESS_CONTACT",
  "DEPLOYMENT_AUTHORIZATION",
] as const;

export type AuthorityValueKind = (typeof authorityValueKinds)[number];

export const authorityEventTypes = [
  "AUTHORITY_PROPOSED",
  "AUTHORITY_SUBMITTED_FOR_REVIEW",
  "AUTHORITY_APPROVAL_RECORDED",
  "AUTHORITY_APPROVED",
  "AUTHORITY_REJECTED",
  "AUTHORITY_SUPERSEDED",
] as const;

export type AuthorityEventType = (typeof authorityEventTypes)[number];

export type BusinessAuthorityActor = Readonly<{
  profileId: string;
  status: "ACTIVE" | "SUSPENDED" | "DISABLED";
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
}>;

export type AuthorityDefinition = Readonly<{
  key: string;
  category: AuthorityCategory;
  labelBg: string;
  labelEn: string;
  descriptionBg: string;
  descriptionEn: string;
  evidenceClass: AuthorityEvidenceClass;
  requiredAuthorityTypes: readonly AuthorityType[];
  allowedValueKinds: readonly AuthorityValueKind[];
  allowedDecisionCodes?: readonly string[];
  readinessValueKinds?: readonly AuthorityValueKind[];
  readinessDecisionCodes?: readonly string[];
  highRisk: boolean;
  productionRequired: boolean;
  blockerCode: string;
}>;

export type BusinessAuthorityRecord = Readonly<{
  id: string;
  /** Database-derived digest of every immutable record-content field. */
  contentHash: string;
  authorityKey: string;
  category: AuthorityCategory;
  version: number;
  recordVersion: number;
  environmentScope: AuthorityEnvironmentScope;
  status: AuthorityStatus;
  evidenceClass: AuthorityEvidenceClass;
  requiredAuthorityTypes: readonly AuthorityType[];
  value: unknown;
  sourceReference: string | null;
  safeEvidenceSummary: string | null;
  internalNotes: string | null;
  effectiveFrom: Date;
  effectiveUntil: Date | null;
  proposedByProfileId: string | null;
  approvedByProfileId: string | null;
  approvedAt: Date | null;
  supersededAt: Date | null;
  supersededById: string | null;
  createdAt: Date;
  updatedAt: Date;
}>;

export type BusinessAuthorityEvent = Readonly<{
  id: string;
  authorityRecordId: string;
  eventType: AuthorityEventType;
  previousStatus: AuthorityStatus | null;
  nextStatus: AuthorityStatus;
  decisionAuthorityType: AuthorityType | null;
  actorProfileId: string | null;
  evidenceReference: string | null;
  safeEvidenceSummary: string | null;
  correlationId: string;
  safeMetadata: Readonly<Record<string, unknown>>;
  occurredAt: Date;
}>;

export const readinessMatrixStatuses = [
  "PASS",
  "OWNER_APPROVAL_REQUIRED",
  "ACCOUNTANT_APPROVAL_REQUIRED",
  "LEGAL_REVIEW_REQUIRED",
  "PROVIDER_LIMITATION",
  "TECHNICAL_BLOCKER",
  "NOT_AUTHORIZED",
] as const;

export type ReadinessMatrixStatus = (typeof readinessMatrixStatuses)[number];
