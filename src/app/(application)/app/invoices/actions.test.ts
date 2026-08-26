import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationBoundaryError } from "@/auth/principal-policy";
import { FinanceServiceError } from "@/modules/finance-invoicing/service";

const doubles = vi.hoisted(() => {
  const service = {
    createInvoiceDraft: vi.fn(),
    issueInvoice: vi.fn(),
    cancelDraftInvoice: vi.fn(),
    recordPayment: vi.fn(),
    confirmPayment: vi.fn(),
    allocatePayment: vi.fn(),
    reversePayment: vi.fn(),
  };
  return {
    service,
    requireAuthenticatedUser: vi.fn(),
    isAuthAttemptAllowed: vi.fn(),
    revalidatePath: vi.fn(),
    repositoryFactory: vi.fn(() => ({})),
    serviceFactory: vi.fn(() => service),
  };
});

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: doubles.revalidatePath }));
vi.mock("@/auth/authorization-service", () => ({
  requireAuthenticatedUser: doubles.requireAuthenticatedUser,
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: doubles.isAuthAttemptAllowed,
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn(() => ({})) }));
vi.mock("@/modules/finance-invoicing/repository", () => ({
  createDatabaseFinanceRepository: doubles.repositoryFactory,
}));
vi.mock("@/modules/finance-invoicing/service", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/modules/finance-invoicing/service")
  >()),
  createFinanceService: doubles.serviceFactory,
}));

import {
  allocatePaymentAction,
  cancelDraftInvoiceAction,
  confirmPaymentAction,
  createInvoiceDraftAction,
  issueInvoiceAction,
  recordPaymentAction,
  reversePaymentAction,
} from "./actions";

const profileId = "10000000-0000-4000-8000-000000000001";
const invoiceReference = "INV-0123456789ABCDEF01234567";
const paymentReference = "PAY-0123456789ABCDEF01234567";
const bookingReference = "BKG-0123456789ABCDEF01234567";
const idempotencyKey = "20000000-0000-4000-8000-000000000001";
const initialState = { status: "IDLE" as const };

const financePermissions = new Set([
  "FINANCE_READ",
  "FINANCE_MANAGE",
  "INVOICE_ISSUE",
  "PAYMENT_RECORD",
]);

const principal = {
  profile: {
    id: profileId,
    displayName: "Finance manager",
    preferredLocale: "en" as const,
    phone: null,
    status: "ACTIVE" as const,
  },
  roles: new Set(["OWNER"]),
  permissions: financePermissions,
};

const actions = [
  createInvoiceDraftAction,
  issueInvoiceAction,
  cancelDraftInvoiceAction,
  recordPaymentAction,
  confirmPaymentAction,
  allocatePaymentAction,
  reversePaymentAction,
] as const;

function form(entries: readonly (readonly [string, string])[]): FormData {
  const formData = new FormData();
  for (const [name, value] of entries) formData.append(name, value);
  return formData;
}

function expectNoServiceMutation(): void {
  expect(
    Object.values(doubles.service).every(
      (method) => method.mock.calls.length === 0,
    ),
  ).toBe(true);
}

beforeEach(() => {
  vi.clearAllMocks();
  doubles.requireAuthenticatedUser.mockResolvedValue(principal);
  doubles.isAuthAttemptAllowed.mockResolvedValue(true);
  doubles.serviceFactory.mockReturnValue(doubles.service);
  doubles.service.createInvoiceDraft.mockResolvedValue({
    status: "CREATED",
    invoiceReference,
  });
  doubles.service.issueInvoice.mockResolvedValue({
    status: "ISSUED",
    invoiceReference,
    invoiceNumber: "DEV-INV-000001",
  });
  doubles.service.cancelDraftInvoice.mockResolvedValue({ status: "UPDATED" });
  doubles.service.recordPayment.mockResolvedValue({
    status: "CREATED",
    paymentReference,
  });
  doubles.service.confirmPayment.mockResolvedValue({ status: "UPDATED" });
  doubles.service.allocatePayment.mockResolvedValue({ status: "UPDATED" });
  doubles.service.reversePayment.mockResolvedValue({ status: "UPDATED" });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Phase 3H finance Server Action trust boundary", () => {
  it("authenticates every mutation before reading FormData", async () => {
    for (const action of actions) {
      doubles.requireAuthenticatedUser.mockRejectedValueOnce(
        new AuthenticationBoundaryError("AUTHENTICATION_REQUIRED"),
      );
      const submitted = new FormData();
      const getAll = vi.spyOn(submitted, "getAll");
      const keys = vi.spyOn(submitted, "keys");

      await expect(action(initialState, submitted)).resolves.toEqual({
        status: "ERROR",
        message: "Нямате достъп до тази операция.",
      });
      expect(getAll).not.toHaveBeenCalled();
      expect(keys).not.toHaveBeenCalled();
    }

    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expectNoServiceMutation();
  });

  it("authorizes every operation before rate-limiting or parsing client input", async () => {
    doubles.requireAuthenticatedUser.mockResolvedValue({
      ...principal,
      permissions: new Set(["FINANCE_READ"]),
    });

    for (const action of actions) {
      const submitted = new FormData();
      const getAll = vi.spyOn(submitted, "getAll");
      const keys = vi.spyOn(submitted, "keys");

      await expect(action(initialState, submitted)).resolves.toEqual({
        status: "ERROR",
        message: "You do not have access to this operation.",
      });
      expect(getAll).not.toHaveBeenCalled();
      expect(keys).not.toHaveBeenCalled();
    }

    expect(doubles.isAuthAttemptAllowed).not.toHaveBeenCalled();
    expectNoServiceMutation();
  });

  it("rate-limits every authorized operation before parsing client input", async () => {
    doubles.isAuthAttemptAllowed.mockResolvedValue(false);

    for (const action of actions) {
      const submitted = new FormData();
      const getAll = vi.spyOn(submitted, "getAll");
      const keys = vi.spyOn(submitted, "keys");

      await expect(action(initialState, submitted)).resolves.toEqual({
        status: "ERROR",
        message: "Too many attempts. Wait and try again.",
      });
      expect(getAll).not.toHaveBeenCalled();
      expect(keys).not.toHaveBeenCalled();
    }

    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledTimes(actions.length);
    expect(doubles.isAuthAttemptAllowed).toHaveBeenCalledWith(
      "FINANCE_MUTATION",
      profileId,
    );
    expectNoServiceMutation();
  });

  it("passes only strict scalar, integer-minor-unit inputs to each service method", async () => {
    const receivedAt = "2026-08-26T10:00:00.000Z";

    const draft = await createInvoiceDraftAction(
      initialState,
      form([
        ["bookingReference", bookingReference],
        ["customerVisibleNote", "Customer note"],
        ["internalNote", "Internal note"],
      ]),
    );
    expect(doubles.service.createInvoiceDraft).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        bookingReference,
        customerVisibleNote: "Customer note",
        internalNote: "Internal note",
        manualAdjustmentRequested: false,
      },
    );
    expect(draft).toEqual({
      status: "SUCCESS",
      message: "The invoice draft was created.",
      invoiceReference,
    });

    const issued = await issueInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["expectedVersion", "3"],
        ["issueConfirmed", "true"],
      ]),
    );
    expect(doubles.service.issueInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      { invoiceReference, expectedVersion: 3, issueConfirmed: true },
    );
    expect(issued).toEqual({
      status: "SUCCESS",
      message: "The invoice was issued.",
      invoiceReference,
    });

    await cancelDraftInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["expectedVersion", "4"],
        ["reason", "Duplicate draft"],
      ]),
    );
    expect(doubles.service.cancelDraftInvoice).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      { invoiceReference, expectedVersion: 4, reason: "Duplicate draft" },
    );

    const recorded = await recordPaymentAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["amountMinorUnits", "12500"],
        ["method", "BANK_TRANSFER"],
        ["receivedAt", receivedAt],
        ["externalReference", "bank-reference"],
        ["internalNote", "Matched by staff"],
        ["idempotencyKey", idempotencyKey],
      ]),
    );
    expect(doubles.service.recordPayment).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        invoiceReference,
        amountMinorUnits: 12_500,
        method: "BANK_TRANSFER",
        receivedAt: new Date(receivedAt),
        externalReference: "bank-reference",
        internalNote: "Matched by staff",
        idempotencyKey,
      },
    );
    expect(recorded).toEqual({
      status: "SUCCESS",
      message: "The payment was recorded and awaits confirmation.",
      invoiceReference,
      paymentReference,
    });

    await confirmPaymentAction(
      initialState,
      form([
        ["paymentReference", paymentReference],
        ["expectedVersion", "2"],
        ["evidenceConfirmed", "true"],
      ]),
    );
    expect(doubles.service.confirmPayment).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      { paymentReference, expectedVersion: 2, evidenceConfirmed: true },
    );

    await allocatePaymentAction(
      initialState,
      form([
        ["paymentReference", paymentReference],
        ["invoiceReference", invoiceReference],
        ["amountMinorUnits", "9900"],
        ["idempotencyKey", idempotencyKey],
      ]),
    );
    expect(doubles.service.allocatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        paymentReference,
        invoiceReference,
        amountMinorUnits: 9_900,
        idempotencyKey,
      },
    );

    await reversePaymentAction(
      initialState,
      form([
        ["paymentReference", paymentReference],
        ["expectedVersion", "3"],
        ["reasonCategory", "BANK_RETURN"],
        ["reasonNote", "Bank returned the transfer"],
        ["idempotencyKey", idempotencyKey],
      ]),
    );
    expect(doubles.service.reversePayment).toHaveBeenCalledWith(
      expect.objectContaining({ profileId }),
      {
        paymentReference,
        expectedVersion: 3,
        reasonCategory: "BANK_RETURN",
        reasonNote: "Bank returned the transfer",
        idempotencyKey,
      },
    );

    expect(doubles.revalidatePath).toHaveBeenCalledWith("/app/finance");
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      `/app/invoices/${invoiceReference}`,
    );
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      `/app/payments/${paymentReference}`,
    );
  });

  it("truthfully reports persisted review-required invoice drafts", async () => {
    doubles.service.createInvoiceDraft.mockResolvedValueOnce({
      status: "FINANCE_REVIEW_REQUIRED",
      invoiceReference,
      reasonCodes: ["QUOTE_PROVENANCE_INVALID"],
    });

    const persisted = await createInvoiceDraftAction(
      initialState,
      form([["bookingReference", bookingReference]]),
    );

    expect(persisted).toEqual({
      status: "SUCCESS",
      message: "The invoice draft was created and requires finance review.",
      invoiceReference,
    });
    expect(JSON.stringify(persisted)).not.toContain("QUOTE_PROVENANCE_INVALID");
    expect(doubles.revalidatePath).toHaveBeenCalledWith(
      `/app/invoices/${invoiceReference}`,
    );

    doubles.service.createInvoiceDraft.mockResolvedValueOnce({
      status: "FINANCE_REVIEW_REQUIRED",
      reasonCodes: ["JOB_COMPLETION_REQUIRED"],
    });
    const notPersisted = await createInvoiceDraftAction(
      initialState,
      form([["bookingReference", bookingReference]]),
    );
    expect(notPersisted).toEqual({
      status: "ERROR",
      message: "Finance review is required. No automatic change was made.",
    });
    expect(notPersisted).not.toHaveProperty("invoiceReference");

    doubles.requireAuthenticatedUser.mockResolvedValueOnce({
      ...principal,
      profile: { ...principal.profile, preferredLocale: "bg" },
    });
    doubles.service.createInvoiceDraft.mockResolvedValueOnce({
      status: "FINANCE_REVIEW_REQUIRED",
      invoiceReference,
      reasonCodes: ["VAT_STATE_UNRESOLVED"],
    });
    const localized = await createInvoiceDraftAction(
      initialState,
      form([["bookingReference", bookingReference]]),
    );
    expect(localized).toEqual({
      status: "SUCCESS",
      message:
        "Черновата на фактурата е създадена и изисква финансов преглед.",
      invoiceReference,
    });
    expect(JSON.stringify(localized)).not.toContain("VAT_STATE_UNRESOLVED");
  });

  it("rejects duplicate scalar fields and non-integer minor units", async () => {
    const duplicate = await issueInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["invoiceReference", "INV-FEDCBA9876543210FEDCBA98"],
        ["expectedVersion", "1"],
        ["issueConfirmed", "true"],
      ]),
    );
    expect(duplicate.status).toBe("ERROR");
    expect(duplicate.fieldErrors?.invoiceReference).toBeDefined();
    expect(doubles.service.issueInvoice).not.toHaveBeenCalled();

    const decimalAmount = await recordPaymentAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["amountMinorUnits", "12.50"],
        ["method", "CASH"],
        ["receivedAt", "2026-08-26T10:00:00.000Z"],
        ["idempotencyKey", idempotencyKey],
      ]),
    );
    expect(decimalAmount.status).toBe("ERROR");
    expect(decimalAmount.fieldErrors?.amountMinorUnits).toBeDefined();
    expect(doubles.service.recordPayment).not.toHaveBeenCalled();
  });

  it("rejects future payment receipt timestamps before service access", async () => {
    const result = await recordPaymentAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["amountMinorUnits", "5000"],
        ["method", "BANK_TRANSFER"],
        ["receivedAt", "2099-01-01T00:00:00.000Z"],
        ["idempotencyKey", idempotencyKey],
      ]),
    );

    expect(result.status).toBe("ERROR");
    expect(result.fieldErrors?.receivedAt).toBeDefined();
    expect(doubles.service.recordPayment).not.toHaveBeenCalled();
  });

  it("rejects mass-assignment fields for every finance mutation", async () => {
    const attempts = [
      {
        action: createInvoiceDraftAction,
        service: doubles.service.createInvoiceDraft,
        entries: [
          ["bookingReference", bookingReference],
          ["grossAmountMinorUnits", "1"],
        ],
      },
      {
        action: issueInvoiceAction,
        service: doubles.service.issueInvoice,
        entries: [
          ["invoiceReference", invoiceReference],
          ["expectedVersion", "1"],
          ["issueConfirmed", "true"],
          ["invoiceNumber", "PROD-INV-000001"],
        ],
      },
      {
        action: cancelDraftInvoiceAction,
        service: doubles.service.cancelDraftInvoice,
        entries: [
          ["invoiceReference", invoiceReference],
          ["expectedVersion", "1"],
          ["reason", "Duplicate"],
          ["auditEventType", "INVOICE_CANCELLED"],
        ],
      },
      {
        action: recordPaymentAction,
        service: doubles.service.recordPayment,
        entries: [
          ["invoiceReference", invoiceReference],
          ["amountMinorUnits", "5000"],
          ["method", "CASH"],
          ["receivedAt", "2026-08-26T10:00:00.000Z"],
          ["idempotencyKey", idempotencyKey],
          ["customerId", profileId],
        ],
      },
      {
        action: confirmPaymentAction,
        service: doubles.service.confirmPayment,
        entries: [
          ["paymentReference", paymentReference],
          ["expectedVersion", "1"],
          ["evidenceConfirmed", "true"],
          ["status", "CONFIRMED"],
        ],
      },
      {
        action: allocatePaymentAction,
        service: doubles.service.allocatePayment,
        entries: [
          ["paymentReference", paymentReference],
          ["invoiceReference", invoiceReference],
          ["amountMinorUnits", "5000"],
          ["idempotencyKey", idempotencyKey],
          ["currency", "EUR"],
        ],
      },
      {
        action: reversePaymentAction,
        service: doubles.service.reversePayment,
        entries: [
          ["paymentReference", paymentReference],
          ["expectedVersion", "1"],
          ["reasonCategory", "ENTRY_ERROR"],
          ["reasonNote", "Incorrect entry"],
          ["idempotencyKey", idempotencyKey],
          ["safeMetadata", "{}"],
        ],
      },
    ] as const;

    for (const attempt of attempts) {
      const result = await attempt.action(initialState, form(attempt.entries));
      expect(result.status).toBe("ERROR");
      expect(attempt.service).not.toHaveBeenCalled();
    }
  });

  it("derives production invoice-number scope outside submitted data", async () => {
    vi.stubEnv("NODE_ENV", "production");

    await issueInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["expectedVersion", "1"],
        ["issueConfirmed", "true"],
      ]),
    );

    expect(doubles.serviceFactory).toHaveBeenCalledWith(expect.anything(), {
      environmentScope: "PRODUCTION",
    });
    expect(doubles.service.issueInvoice).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.objectContaining({ environmentScope: expect.anything() }),
    );
  });

  it("treats an already-issued invoice retry as an idempotent success", async () => {
    doubles.service.issueInvoice.mockResolvedValueOnce({
      status: "EXISTING",
      invoiceReference,
      invoiceNumber: "DEV-INV-000001",
    });

    const result = await issueInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["expectedVersion", "1"],
        ["issueConfirmed", "true"],
      ]),
    );

    expect(result).toEqual({
      status: "SUCCESS",
      message: "This step was already recorded.",
      invoiceReference,
    });
    expect(result).not.toHaveProperty("invoiceNumber");
  });

  it("returns generic localized errors without leaking internal details", async () => {
    doubles.service.issueInvoice.mockRejectedValueOnce(
      new Error("invoice_number_unique database detail"),
    );
    const unavailable = await issueInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["expectedVersion", "1"],
        ["issueConfirmed", "true"],
      ]),
    );
    expect(unavailable).toEqual({
      status: "ERROR",
      message: "The operation cannot be completed right now.",
    });
    expect(JSON.stringify(unavailable)).not.toContain("invoice_number_unique");
    expect(JSON.stringify(unavailable)).not.toContain("database detail");

    doubles.service.issueInvoice.mockResolvedValueOnce({
      status: "FINANCE_REVIEW_REQUIRED",
      invoiceReference,
      reasonCodes: ["QUOTE_PROVENANCE_INVALID"],
    });
    const review = await issueInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["expectedVersion", "1"],
        ["issueConfirmed", "true"],
      ]),
    );
    expect(review).toEqual({
      status: "ERROR",
      message: "Finance review is required. No automatic change was made.",
    });
    expect(JSON.stringify(review)).not.toContain("QUOTE_PROVENANCE_INVALID");

    doubles.service.issueInvoice.mockRejectedValueOnce(
      new FinanceServiceError("RECORD_NOT_FOUND_OR_FORBIDDEN"),
    );
    const hiddenSelector = await issueInvoiceAction(
      initialState,
      form([
        ["invoiceReference", invoiceReference],
        ["expectedVersion", "1"],
        ["issueConfirmed", "true"],
      ]),
    );
    expect(hiddenSelector).toEqual({
      status: "ERROR",
      message: "You do not have access to this operation.",
    });
    expect(JSON.stringify(hiddenSelector)).not.toContain("NOT_FOUND");
  });
});
