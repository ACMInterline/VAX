import { describe, expect, it, vi } from "vitest";
import type { PermissionCode } from "@/modules/identity-access/policy";
import { FinanceAuthorizationError, type FinanceActor } from "./policy";
import { createFinanceService, type FinanceRepository } from "./service";

function actor(permissions: readonly PermissionCode[]): FinanceActor {
  return {
    profileId: "00000000-0000-4000-8000-000000000001",
    status: "ACTIVE",
    roles: new Set(["ADMIN"]),
    permissions: new Set(permissions),
  };
}

function repository(): FinanceRepository {
  return {
    createInvoiceDraft: vi.fn().mockResolvedValue({
      status: "CREATED",
      invoiceReference: "INV-0123456789ABCDEF01234567",
    }),
    issueInvoice: vi.fn().mockResolvedValue({
      status: "ISSUED",
      invoiceReference: "INV-0123456789ABCDEF01234567",
      invoiceNumber: "DEV-INV-000001",
    }),
    cancelDraftInvoice: vi.fn().mockResolvedValue({ status: "UPDATED" }),
    recordPayment: vi.fn().mockResolvedValue({
      status: "CREATED",
      paymentReference: "PAY-0123456789ABCDEF01234567",
    }),
    confirmPayment: vi.fn().mockResolvedValue({ status: "UPDATED" }),
    allocatePayment: vi.fn().mockResolvedValue({ status: "UPDATED" }),
    reversePayment: vi.fn().mockResolvedValue({ status: "UPDATED" }),
    dashboard: vi.fn(),
    listStaffInvoices: vi.fn(),
    getStaffInvoice: vi.fn(),
    listCustomerInvoices: vi.fn().mockResolvedValue([]),
    getCustomerInvoice: vi.fn(),
    listPayments: vi.fn(),
  };
}

describe("finance service", () => {
  it("derives invoice identity and environment outside client input", async () => {
    const repo = repository();
    const service = createFinanceService(repo, { environmentScope: "PRODUCTION" });
    await service.createInvoiceDraft(
      actor(["FINANCE_READ", "FINANCE_MANAGE"]),
      {
        bookingReference: "BKG-0123456789ABCDEF01234567",
        customerVisibleNote: null,
        internalNote: null,
        manualAdjustmentRequested: false,
      },
    );
    const createInput = vi.mocked(repo.createInvoiceDraft).mock.calls[0]?.[1];
    expect(createInput?.invoiceReference).toMatch(/^INV-[A-F0-9]{24}$/);

    await service.issueInvoice(actor(["FINANCE_READ", "INVOICE_ISSUE"]), {
      invoiceReference: "INV-0123456789ABCDEF01234567",
      expectedVersion: 1,
      issueConfirmed: true,
    });
    expect(vi.mocked(repo.issueInvoice).mock.calls[0]?.[1].environmentScope).toBe(
      "PRODUCTION",
    );
  });

  it("rejects role labels without the operation permission", async () => {
    const service = createFinanceService(repository());
    await expect(
      service.issueInvoice(actor(["FINANCE_READ"]), {
        invoiceReference: "INV-0123456789ABCDEF01234567",
        expectedVersion: 1,
        issueConfirmed: true,
      }),
    ).rejects.toBeInstanceOf(FinanceAuthorizationError);
  });

  it("maps repository selectors to a non-disclosing service error", async () => {
    const repo = repository();
    vi.mocked(repo.issueInvoice).mockResolvedValue({
      status: "NOT_FOUND_OR_FORBIDDEN",
    });
    const service = createFinanceService(repo);
    await expect(
      service.issueInvoice(actor(["FINANCE_READ", "INVOICE_ISSUE"]), {
        invoiceReference: "INV-0123456789ABCDEF01234567",
        expectedVersion: 1,
        issueConfirmed: true,
      }),
    ).rejects.toMatchObject({
      code: "RECORD_NOT_FOUND_OR_FORBIDDEN",
    });
  });

  it("keeps payment recording separate from confirmation", async () => {
    const repo = repository();
    const service = createFinanceService(repo);
    await service.recordPayment(actor(["FINANCE_READ", "PAYMENT_RECORD"]), {
      invoiceReference: "INV-0123456789ABCDEF01234567",
      amountMinorUnits: 5_000,
      method: "CARD_MANUAL_REFERENCE",
      receivedAt: new Date("2026-08-26T10:00:00.000Z"),
      externalReference: "manual-terminal-reference",
      internalNote: null,
      idempotencyKey: "00000000-0000-4000-8000-000000000001",
    });
    const input = vi.mocked(repo.recordPayment).mock.calls[0]?.[1];
    expect(input).not.toHaveProperty("status");
    expect(input?.paymentReference).toMatch(/^PAY-[A-F0-9]{24}$/);
  });

  it("derives overdue and dashboard dates from the Sofia civil day", async () => {
    const repo = repository();
    const service = createFinanceService(repo, {
      clock: () => new Date("2026-01-01T22:30:00.000Z"),
    });

    await service.dashboard(actor(["FINANCE_READ"]));

    expect(repo.dashboard).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000001",
      "2026-01-02",
    );
  });
});
