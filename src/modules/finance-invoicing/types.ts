import type { JsonObject } from "@/modules/request-quote/types";

export const financeEnvironmentScopes = [
  "DEVELOPMENT",
  "STAGING",
  "PRODUCTION",
] as const;
export type FinanceEnvironmentScope =
  (typeof financeEnvironmentScopes)[number];

export const invoiceTypes = ["STANDARD", "PROFORMA"] as const;
export type InvoiceType = (typeof invoiceTypes)[number];

export const invoiceStoredStatuses = [
  "DRAFT",
  "READY_TO_ISSUE",
  "ISSUED",
  "PARTIALLY_PAID",
  "PAID",
  "CANCELLED",
] as const;
export type InvoiceStoredStatus = (typeof invoiceStoredStatuses)[number];
export type InvoiceDisplayStatus = InvoiceStoredStatus | "OVERDUE";

export const invoiceEligibilityModes = [
  "BOOKING_ACCEPTED",
  "JOB_COMPLETION_REQUIRED",
] as const;
export type InvoiceEligibilityMode = (typeof invoiceEligibilityModes)[number];

export const paymentTermsCodes = [
  "PAY_ON_COMPLETION",
  "PAY_ON_INVOICE",
  "PREPAYMENT",
  "CUSTOM",
] as const;
export type PaymentTermsCode = (typeof paymentTermsCodes)[number];

export const paymentMethods = [
  "BANK_TRANSFER",
  "CASH",
  "CARD_MANUAL_REFERENCE",
  "OTHER",
] as const;
export type PaymentMethod = (typeof paymentMethods)[number];

export const paymentStatuses = [
  "RECORDED",
  "CONFIRMED",
  "REVERSED",
] as const;
export type PaymentStatus = (typeof paymentStatuses)[number];

export const financeReviewReasonCodes = [
  "COMMERCIAL_PROVENANCE_INCOMPLETE",
  "COMMERCIAL_TOTALS_INCONSISTENT",
  "CUSTOMER_BILLING_PROFILE_MISSING",
  "CUSTOMER_BILLING_PROFILE_UNAPPROVED",
  "SELLER_LEGAL_PROFILE_MISSING",
  "SELLER_LEGAL_PROFILE_UNAPPROVED",
  "VAT_STATE_UNRESOLVED",
  "INVOICE_POLICY_MISSING",
  "NUMBERING_POLICY_MISSING",
  "JOB_COMPLETION_REQUIRED",
  "JOB_SCOPE_DIFFERENCE",
  "MANUAL_ADJUSTMENT_REQUESTED",
] as const;
export type FinanceReviewReasonCode =
  (typeof financeReviewReasonCodes)[number];

export type InvoiceLineSnapshot = Readonly<{
  descriptionBg: string;
  descriptionEn: string;
  quantity: number;
  measurementSnapshot: JsonObject;
  netAmountMinorUnits: number;
  vatRateBasisPoints: number;
  vatAmountMinorUnits: number;
  grossAmountMinorUnits: number;
  sortOrder: number;
}>;

export type InvoiceSummary = Readonly<{
  invoiceReference: string;
  invoiceNumber: string | null;
  type: InvoiceType;
  status: InvoiceDisplayStatus;
  customerDisplayName: string;
  bookingReference: string;
  issueDate: string | null;
  dueDate: string | null;
  currency: "EUR";
  grossAmountMinorUnits: number;
  paidAmountMinorUnits: number;
  outstandingAmountMinorUnits: number;
  createdAt: Date;
  version: number;
}>;

export type CustomerInvoiceDetail = InvoiceSummary &
  Readonly<{
    quoteReference: string;
    customerSnapshot: JsonObject;
    sellerSnapshot: JsonObject;
    termsSnapshot: JsonObject;
    customerVisibleNote: string | null;
    items: readonly InvoiceLineSnapshot[];
    paymentInstructions: string | null;
  }>;

export type StaffInvoiceDetail = CustomerInvoiceDetail &
  Readonly<{
    eligibilityMode: InvoiceEligibilityMode;
    jobReference: string | null;
    reviewReasonCodes: readonly FinanceReviewReasonCode[];
    commercialSnapshot: JsonObject;
    provenanceSnapshot: JsonObject;
    internalNote: string | null;
    auditTimeline: readonly FinanceAuditItem[];
  }>;

export type PaymentSummary = Readonly<{
  paymentReference: string;
  status: PaymentStatus;
  method: PaymentMethod;
  currency: "EUR";
  amountMinorUnits: number;
  allocatedAmountMinorUnits: number;
  unappliedAmountMinorUnits: number;
  receivedAt: Date;
  createdAt: Date;
  version: number;
}>;

export type FinanceAuditItem = Readonly<{
  eventType: string;
  source: "STAFF" | "SYSTEM";
  safeMetadata: JsonObject;
  createdAt: Date;
}>;

export type FinanceDashboard = Readonly<{
  draftInvoices: number;
  issuedUnpaidInvoices: number;
  partiallyPaidInvoices: number;
  overdueInvoices: number;
  paidInvoices: number;
  unappliedPayments: number;
  invoicedGrossMinorUnits: number;
  paidMinorUnits: number;
  outstandingMinorUnits: number;
  overdueMinorUnits: number;
  currency: "EUR";
}>;

export type FinanceRepositoryResult =
  | Readonly<{
      status: "CREATED" | "EXISTING" | "ISSUED" | "UPDATED" | "NO_CHANGE";
      invoiceReference?: string;
      invoiceNumber?: string;
      paymentReference?: string;
    }>
  | Readonly<{
      status: "FINANCE_REVIEW_REQUIRED";
      invoiceReference?: string;
      reasonCodes: readonly FinanceReviewReasonCode[];
    }>
  | Readonly<{
      status:
        | "NOT_FOUND_OR_FORBIDDEN"
        | "CONFLICT"
        | "REFERENCE_CONFLICT"
        | "INVALID_TRANSITION"
        | "IDEMPOTENCY_CONFLICT";
    }>;

export type CreateInvoiceDraftInput = Readonly<{
  bookingReference: string;
  invoiceReference: string;
  customerVisibleNote: string | null;
  internalNote: string | null;
  manualAdjustmentRequested: false;
  environmentScope: FinanceEnvironmentScope;
}>;

export type IssueInvoiceInput = Readonly<{
  invoiceReference: string;
  expectedVersion: number;
  issueConfirmed: true;
  environmentScope: FinanceEnvironmentScope;
}>;

export type CancelInvoiceInput = Readonly<{
  invoiceReference: string;
  expectedVersion: number;
  reason: string;
}>;

export type RecordPaymentInput = Readonly<{
  invoiceReference: string;
  paymentReference: string;
  amountMinorUnits: number;
  method: PaymentMethod;
  receivedAt: Date;
  externalReference: string | null;
  internalNote: string | null;
  idempotencyKey: string;
}>;

export type ConfirmPaymentInput = Readonly<{
  paymentReference: string;
  expectedVersion: number;
  evidenceConfirmed: true;
}>;

export type AllocatePaymentInput = Readonly<{
  paymentReference: string;
  invoiceReference: string;
  amountMinorUnits: number;
  idempotencyKey: string;
}>;

export type ReversePaymentInput = Readonly<{
  paymentReference: string;
  expectedVersion: number;
  reasonCategory: "DUPLICATE" | "BANK_RETURN" | "ENTRY_ERROR" | "OTHER";
  reasonNote: string;
  idempotencyKey: string;
}>;

export type StaffInvoiceListInput = Readonly<{
  search?: string;
  status?: InvoiceStoredStatus | "OVERDUE";
  limit: number;
  offset: number;
}>;

export type StaffInvoicePage = Readonly<{
  items: readonly InvoiceSummary[];
  total: number;
  limit: number;
  offset: number;
}>;
