import type { AccountStatus } from "@/modules/identity-access/authorization";
import type {
  ApplicationRoleCode,
  PermissionCode,
} from "@/modules/identity-access/policy";

export const communicationEventTypes = [
  "QUOTE_ISSUED",
  "BOOKING_CONFIRMED",
  "BOOKING_RESCHEDULED",
  "BOOKING_CANCELLED",
  "JOB_COMPLETED",
  "INVOICE_ISSUED",
  "PAYMENT_CONFIRMED",
  "PAYMENT_REVERSED",
  "MANUAL_STAFF_MESSAGE",
] as const;
export type CommunicationEventType = (typeof communicationEventTypes)[number];

export const communicationSourceTypes = [
  "QUOTE",
  "BOOKING",
  "JOB",
  "INVOICE",
  "PAYMENT",
  "MANUAL",
] as const;
export type CommunicationSourceType = (typeof communicationSourceTypes)[number];

export const communicationPurposes = [
  "OPERATIONAL",
  "BILLING",
  "MARKETING",
] as const;
export type CommunicationPurpose = (typeof communicationPurposes)[number];

export const communicationChannels = [
  "PORTAL",
  "EMAIL_FUTURE",
  "SMS_FUTURE",
  "MANUAL",
] as const;
export type CommunicationChannel = (typeof communicationChannels)[number];

export const communicationIntentStatuses = [
  "DRAFT",
  "READY",
  "QUEUED_FUTURE",
  "DELIVERED_LOCAL",
  "FAILED",
  "CANCELLED",
] as const;
export type CommunicationIntentStatus =
  (typeof communicationIntentStatuses)[number];

export const communicationDocumentTypes = [
  "QUOTE_SUMMARY",
  "BOOKING_CONFIRMATION",
  "JOB_COMPLETION_SUMMARY",
  "CLEANING_PASSPORT",
  "INVOICE",
  "PAYMENT_ACKNOWLEDGEMENT",
] as const;
export type CommunicationDocumentType =
  (typeof communicationDocumentTypes)[number];

export type CommunicationLocale = "bg" | "en";

export type CommunicationsActor = Readonly<{
  profileId: string;
  status: AccountStatus;
  roles: ReadonlySet<ApplicationRoleCode>;
  permissions: ReadonlySet<PermissionCode>;
}>;

export type CanonicalCommunicationTemplate = Readonly<{
  templateKey: string;
  version: number;
  locale: CommunicationLocale;
  documentType: CommunicationDocumentType;
  titleTemplate: string;
  bodyTemplate: string;
  variablesContract: readonly string[];
}>;

export type CommunicationTemplateRecord = CanonicalCommunicationTemplate &
  Readonly<{
    status: "ACTIVE";
  }>;

export type DocumentFact = Readonly<{
  key: string;
  label: string;
  value: string;
}>;

export type DocumentLineItem = Readonly<{
  description: string;
  quantity: number;
  amountMinorUnits?: number;
  currency?: "EUR";
}>;

export type DocumentTotals = Readonly<{
  currency: "EUR";
  netAmountMinorUnits?: number;
  vatAmountMinorUnits?: number;
  grossAmountMinorUnits: number;
  paidAmountMinorUnits?: number;
  outstandingAmountMinorUnits?: number;
}>;

export type DocumentContentSnapshot = Readonly<{
  schemaVersion: 1;
  rendererVersion: 1;
  eventType: CommunicationEventType;
  sourceReference: string;
  locale: CommunicationLocale;
  title: string;
  body: string;
  facts: readonly DocumentFact[];
  lineItems: readonly DocumentLineItem[];
  totals: DocumentTotals | null;
  notices: readonly string[];
}>;

export type SourceAuditIdentity = Readonly<{
  businessAuditEventId: string | null;
  bookingAuditEventId: string | null;
  jobAuditEventId: string | null;
  financeAuditEventId: string | null;
}>;

export type SourceRecordIdentity = Readonly<{
  sourceType: Exclude<CommunicationSourceType, "MANUAL">;
  sourceId: string;
  sourceReference: string;
  sourceVersion: number;
  customerId: string;
  bookingOccupancyId: string | null;
}> &
  SourceAuditIdentity;

export type ResolvedCommunicationSource = SourceRecordIdentity &
  Readonly<{
    eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">;
    purpose: Exclude<CommunicationPurpose, "MARKETING">;
    localeHint: CommunicationLocale;
    occurredAt: Date;
    templateKey: string;
    documentType: CommunicationDocumentType;
    variables: Readonly<Record<string, string>>;
    facts: readonly DocumentFact[];
    lineItems: readonly DocumentLineItem[];
    totals: DocumentTotals | null;
    notices: readonly string[];
    sourcePayload: Readonly<Record<string, unknown>>;
    projectionPayload: Readonly<Record<string, unknown>>;
  }>;

export type SelectedContactSnapshot = Readonly<{
  contactId: string;
  contactName: string;
  email: string | null;
  phone: string | null;
  locale: CommunicationLocale;
  version: number;
}>;

export type CommunicationPreferences = Readonly<{
  portalEnabled: boolean;
  emailFutureEnabled: boolean;
  smsFutureEnabled: boolean;
  operationalAllowed: boolean;
  billingAllowed: boolean;
  marketingConsent: boolean;
  preferredLocale: CommunicationLocale;
  version: number;
}>;

export type ResolvedDeliveryContext = Readonly<{
  preferences: CommunicationPreferences;
  contact: SelectedContactSnapshot | null;
  locale: CommunicationLocale;
  template: CommunicationTemplateRecord;
}>;

export type CreateCommunicationCommand = Readonly<{
  eventType: Exclude<CommunicationEventType, "MANUAL_STAFF_MESSAGE">;
  sourceReference: string;
  documentType: CommunicationDocumentType;
  channel: Exclude<CommunicationChannel, "MANUAL">;
  contactId: string | null;
  idempotencyKey: string;
  communicationReference: string;
  documentReference: string;
  deliveryReference: string;
  historyReference: string;
}>;

export type PersistCommunicationInput = CreateCommunicationCommand &
  Readonly<{
    actorProfileId: string;
    source: ResolvedCommunicationSource;
    template: CommunicationTemplateRecord;
    contact: SelectedContactSnapshot | null;
    locale: CommunicationLocale;
    intentStatus: "DELIVERED_LOCAL" | "QUEUED_FUTURE";
    content: DocumentContentSnapshot;
    checksumSha256: string;
    idempotencyFingerprint: string;
  }>;

export type CommunicationMutationResult =
  | Readonly<{
      status: "CREATED" | "EXISTING";
      communicationReference: string;
      documentReference: string;
      intentStatus: "DELIVERED_LOCAL" | "QUEUED_FUTURE";
    }>
  | Readonly<{
      status:
        | "NOT_FOUND_OR_FORBIDDEN"
        | "PREFERENCE_BLOCKED"
        | "REVIEW_REQUIRED"
        | "REFERENCE_CONFLICT"
        | "IDEMPOTENCY_CONFLICT";
    }>;

export type StaffCommunicationSummary = Readonly<{
  communicationReference: string;
  documentReference: string | null;
  eventType: CommunicationEventType;
  documentType: CommunicationDocumentType | null;
  sourceReference: string;
  channel: CommunicationChannel;
  locale: CommunicationLocale;
  status: CommunicationIntentStatus;
  title: string | null;
  createdAt: Date;
}>;

export type StaffCommunicationPage = Readonly<{
  items: readonly StaffCommunicationSummary[];
  total: number;
  limit: number;
  offset: number;
}>;

export type CustomerHistorySummary = Readonly<{
  historyReference: string;
  communicationReference: string;
  documentReference: string;
  eventType: CommunicationEventType;
  documentType: CommunicationDocumentType;
  locale: CommunicationLocale;
  title: string;
  visibleAt: Date;
  superseded: boolean;
}>;

export type CustomerDocumentDetail = Readonly<{
  documentReference: string;
  documentType: CommunicationDocumentType;
  locale: CommunicationLocale;
  status: "FINAL" | "SUPERSEDED";
  checksumSha256: string;
  finalizedAt: Date;
  content: DocumentContentSnapshot;
}>;

export type StaffCommunicationDetail = StaffCommunicationSummary &
  Readonly<{
    sourceType: Exclude<CommunicationSourceType, "MANUAL">;
    sourceVersion: number;
    purpose: Exclude<CommunicationPurpose, "MARKETING">;
    templateKey: string;
    templateVersion: number;
    contactSelected: boolean;
    checksumSha256: string | null;
    documentStatus: "FINAL" | "SUPERSEDED" | null;
    finalizedAt: Date | null;
  }>;

export type UpdateCommunicationPreferencesInput = Readonly<{
  portalEnabled: boolean;
  emailFutureEnabled: boolean;
  smsFutureEnabled: boolean;
  operationalAllowed: boolean;
  billingAllowed: boolean;
  marketingConsent: boolean;
  preferredLocale: CommunicationLocale;
  expectedVersion: number;
}>;

export type PreferencesMutationResult =
  | Readonly<{ status: "UPDATED"; version: number }>
  | Readonly<{ status: "CONFLICT" | "NOT_FOUND_OR_FORBIDDEN" }>;
