import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { FinanceFormAction } from "./action-state";
import {
  CreateInvoiceDraftForm,
  InvoiceLifecycleForms,
  PaymentOperationsList,
  RecordPaymentForm,
} from "./mutation-forms";

const action: FinanceFormAction = async () => ({ status: "SUCCESS" });

describe("finance mutation forms", () => {
  it("renders bilingual staff-controlled invoice actions without client-owned totals", () => {
    const html = renderToStaticMarkup(
      <>
        <CreateInvoiceDraftForm action={action} locale="en" />
        <InvoiceLifecycleForms
          cancelAction={action}
          issueAllowed
          invoiceReference="INV-0123456789ABCDEF01234567"
          issueAction={action}
          locale="en"
          status="READY_TO_ISSUE"
          version={2}
        />
        <RecordPaymentForm
          action={action}
          idempotencyKey="10000000-0000-4000-8000-000000000001"
          invoiceReference="INV-0123456789ABCDEF01234567"
          locale="en"
          receivedAt="2026-08-26T12:00:00.000Z"
        />
      </>,
    );

    expect(html).toContain("New draft from booking");
    expect(html).toContain("current immutable snapshot");
    expect(html).toContain("Record as unconfirmed");
    expect(html).toContain('name="issueConfirmed"');
    expect(html).toContain('name="idempotencyKey"');
    expect(html).not.toContain('name="customerId"');
    expect(html).not.toContain('name="grossAmountMinorUnits"');
    expect(html).not.toContain('name="status"');
  });

  it("keeps a Job-gated immutable draft reachable for a later staff issue retry", () => {
    const html = renderToStaticMarkup(
      <InvoiceLifecycleForms
        cancelAction={action}
        issueAllowed
        invoiceReference="INV-0123456789ABCDEF01234567"
        issueAction={action}
        locale="en"
        status="DRAFT"
        version={2}
      />,
    );

    expect(html).toContain('name="issueConfirmed"');
    expect(html).toContain("current immutable snapshot");
  });

  it("keeps confirmation, allocation and reversal as distinct Bulgarian controls", () => {
    const html = renderToStaticMarkup(
      <PaymentOperationsList
        actions={{ allocate: action, confirm: action, reverse: action }}
        idempotencyKeys={{
          "PAY-0123456789ABCDEF01234567": {
            allocate: "20000000-0000-4000-8000-000000000002",
            reverse: "30000000-0000-4000-8000-000000000003",
          },
        }}
        locale="bg"
        payments={[
          {
            paymentReference: "PAY-0123456789ABCDEF01234567",
            status: "CONFIRMED",
            method: "BANK_TRANSFER",
            currency: "EUR",
            amountMinorUnits: 12_000,
            allocatedAmountMinorUnits: 5_000,
            unappliedAmountMinorUnits: 7_000,
            receivedAt: new Date("2026-08-26T12:00:00.000Z"),
            createdAt: new Date("2026-08-26T12:00:00.000Z"),
            version: 3,
          },
        ]}
      />,
    );

    expect(html).toContain("Разпредели към фактура");
    expect(html).toContain("Сторнирай записаното плащане");
    expect(html).toContain('name="invoiceReference"');
    expect(html).toContain('name="reasonCategory"');
    expect(html).not.toContain("Потвърди плащането");
  });
});
