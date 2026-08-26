import { z, ZodError } from "zod";
import {
  requireCustomerInvoiceRead,
  requireInvoiceIssue,
  requirePaymentRecord,
  requirePaymentReversal,
  requireStaffFinanceManage,
  requireStaffFinanceRead,
  type FinanceActor,
} from "./policy";
import { generateInvoiceReference, generatePaymentReference } from "./reference";
import type {
  AllocatePaymentInput,
  CancelInvoiceInput,
  ConfirmPaymentInput,
  CreateInvoiceDraftInput,
  CustomerInvoiceDetail,
  FinanceDashboard,
  FinanceRepositoryResult,
  InvoiceSummary,
  IssueInvoiceInput,
  PaymentSummary,
  RecordPaymentInput,
  ReversePaymentInput,
  StaffInvoiceDetail,
  StaffInvoiceListInput,
  StaffInvoicePage,
} from "./types";
import {
  allocatePaymentSchema,
  cancelDraftInvoiceSchema,
  confirmPaymentSchema,
  createInvoiceDraftSchema,
  invoiceListSchema,
  invoiceReferenceSchema,
  issueInvoiceSchema,
  recordPaymentSchema,
  reversePaymentSchema,
} from "./validation";

export type FinanceRepository = Readonly<{
  createInvoiceDraft(
    actorProfileId: string,
    input: CreateInvoiceDraftInput,
  ): Promise<FinanceRepositoryResult>;
  issueInvoice(
    actorProfileId: string,
    input: IssueInvoiceInput,
  ): Promise<FinanceRepositoryResult>;
  cancelDraftInvoice(
    actorProfileId: string,
    input: CancelInvoiceInput,
  ): Promise<FinanceRepositoryResult>;
  recordPayment(
    actorProfileId: string,
    input: RecordPaymentInput,
  ): Promise<FinanceRepositoryResult>;
  confirmPayment(
    actorProfileId: string,
    input: ConfirmPaymentInput,
  ): Promise<FinanceRepositoryResult>;
  allocatePayment(
    actorProfileId: string,
    input: AllocatePaymentInput,
  ): Promise<FinanceRepositoryResult>;
  reversePayment(
    actorProfileId: string,
    input: ReversePaymentInput,
  ): Promise<FinanceRepositoryResult>;
  dashboard(actorProfileId: string, today: string): Promise<FinanceDashboard>;
  listStaffInvoices(
    actorProfileId: string,
    input: StaffInvoiceListInput,
    today: string,
  ): Promise<StaffInvoicePage>;
  getStaffInvoice(
    actorProfileId: string,
    invoiceReference: string,
    today: string,
  ): Promise<StaffInvoiceDetail | null>;
  listCustomerInvoices(
    actorProfileId: string,
    today: string,
  ): Promise<readonly InvoiceSummary[]>;
  getCustomerInvoice(
    actorProfileId: string,
    invoiceReference: string,
    today: string,
  ): Promise<CustomerInvoiceDetail | null>;
  listPayments(actorProfileId: string): Promise<readonly PaymentSummary[]>;
}>;

export type FinanceServiceFailureCode =
  | "INVALID_REQUEST"
  | "RECORD_NOT_FOUND_OR_FORBIDDEN"
  | "CONFLICT"
  | "INVALID_TRANSITION"
  | "TEMPORARILY_UNAVAILABLE";

export class FinanceServiceError extends Error {
  readonly code: FinanceServiceFailureCode;

  constructor(code: FinanceServiceFailureCode) {
    super(code);
    this.name = "FinanceServiceError";
    this.code = code;
  }
}

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  try {
    return schema.parse(input);
  } catch (error) {
    if (error instanceof ZodError) throw new FinanceServiceError("INVALID_REQUEST");
    throw error;
  }
}

async function operation<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof FinanceServiceError) throw error;
    throw new FinanceServiceError("TEMPORARILY_UNAVAILABLE");
  }
}

function checkedResult(result: FinanceRepositoryResult): FinanceRepositoryResult {
  if (result.status === "NOT_FOUND_OR_FORBIDDEN") {
    throw new FinanceServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
  }
  if (result.status === "REFERENCE_CONFLICT") return result;
  if (result.status === "CONFLICT" || result.status === "IDEMPOTENCY_CONFLICT") {
    throw new FinanceServiceError("CONFLICT");
  }
  if (result.status === "INVALID_TRANSITION") {
    throw new FinanceServiceError("INVALID_TRANSITION");
  }
  return result;
}

function todaySofia(clock: () => Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Sofia",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(clock());
  const value = (type: "year" | "month" | "day") =>
    parts.find((part) => part.type === type)?.value;
  const year = value("year");
  const month = value("month");
  const day = value("day");
  if (!year || !month || !day) {
    throw new FinanceServiceError("TEMPORARILY_UNAVAILABLE");
  }
  return `${year}-${month}-${day}`;
}

export function createFinanceService(
  repository: FinanceRepository,
  options: Readonly<{
    environmentScope?: "DEVELOPMENT" | "PRODUCTION";
    clock?: () => Date;
  }> = {},
) {
  const environmentScope = options.environmentScope ?? "DEVELOPMENT";
  const clock = options.clock ?? (() => new Date());

  return {
    async createInvoiceDraft(actor: FinanceActor | null, input: unknown) {
      requireStaffFinanceManage(actor);
      const parsed = parse(createInvoiceDraftSchema, input);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = checkedResult(
          await operation(() =>
            repository.createInvoiceDraft(actor!.profileId, {
              ...parsed,
              invoiceReference: generateInvoiceReference(),
              environmentScope,
            }),
          ),
        );
        if (result.status !== "REFERENCE_CONFLICT") return result;
      }
      throw new FinanceServiceError("CONFLICT");
    },

    async issueInvoice(actor: FinanceActor | null, input: unknown) {
      requireInvoiceIssue(actor);
      const parsed = parse(issueInvoiceSchema, input);
      return checkedResult(
        await operation(() =>
          repository.issueInvoice(actor!.profileId, {
            ...parsed,
            environmentScope,
          }),
        ),
      );
    },

    async cancelDraftInvoice(actor: FinanceActor | null, input: unknown) {
      requireStaffFinanceManage(actor);
      const parsed = parse(cancelDraftInvoiceSchema, input);
      return checkedResult(
        await operation(() =>
          repository.cancelDraftInvoice(actor!.profileId, parsed),
        ),
      );
    },

    async recordPayment(actor: FinanceActor | null, input: unknown) {
      requirePaymentRecord(actor);
      const parsed = parse(recordPaymentSchema, input);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const result = checkedResult(
          await operation(() =>
            repository.recordPayment(actor!.profileId, {
              ...parsed,
              paymentReference: generatePaymentReference(),
            }),
          ),
        );
        if (result.status !== "REFERENCE_CONFLICT") return result;
      }
      throw new FinanceServiceError("CONFLICT");
    },

    async confirmPayment(actor: FinanceActor | null, input: unknown) {
      requirePaymentRecord(actor);
      const parsed = parse(confirmPaymentSchema, input);
      return checkedResult(
        await operation(() => repository.confirmPayment(actor!.profileId, parsed)),
      );
    },

    async allocatePayment(actor: FinanceActor | null, input: unknown) {
      requirePaymentRecord(actor);
      const parsed = parse(allocatePaymentSchema, input);
      return checkedResult(
        await operation(() => repository.allocatePayment(actor!.profileId, parsed)),
      );
    },

    async reversePayment(actor: FinanceActor | null, input: unknown) {
      requirePaymentReversal(actor);
      const parsed = parse(reversePaymentSchema, input);
      return checkedResult(
        await operation(() => repository.reversePayment(actor!.profileId, parsed)),
      );
    },

    async dashboard(actor: FinanceActor | null) {
      requireStaffFinanceRead(actor);
      return operation(() => repository.dashboard(actor!.profileId, todaySofia(clock)));
    },

    async listInvoices(actor: FinanceActor | null, input: unknown) {
      requireStaffFinanceRead(actor);
      const parsed = parse(invoiceListSchema, input);
      return operation(() =>
        repository.listStaffInvoices(actor!.profileId, parsed, todaySofia(clock)),
      );
    },

    async getInvoice(actor: FinanceActor | null, input: unknown) {
      requireStaffFinanceRead(actor);
      const invoiceReference = parse(
        invoiceReferenceSchema,
        (input as { invoiceReference?: unknown })?.invoiceReference,
      );
      const record = await operation(() =>
        repository.getStaffInvoice(actor!.profileId, invoiceReference, todaySofia(clock)),
      );
      if (!record) throw new FinanceServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      return record;
    },

    async listMyInvoices(actor: FinanceActor | null) {
      requireCustomerInvoiceRead(actor);
      return operation(() =>
        repository.listCustomerInvoices(actor!.profileId, todaySofia(clock)),
      );
    },

    async getMyInvoice(actor: FinanceActor | null, input: unknown) {
      requireCustomerInvoiceRead(actor);
      const invoiceReference = parse(
        invoiceReferenceSchema,
        (input as { invoiceReference?: unknown })?.invoiceReference,
      );
      const record = await operation(() =>
        repository.getCustomerInvoice(actor!.profileId, invoiceReference, todaySofia(clock)),
      );
      if (!record) throw new FinanceServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN");
      return record;
    },

    async listPayments(actor: FinanceActor | null) {
      requireStaffFinanceRead(actor);
      return operation(() => repository.listPayments(actor!.profileId));
    },
  };
}

export type FinanceService = ReturnType<typeof createFinanceService>;
