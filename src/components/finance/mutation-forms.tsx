"use client";

import { useActionState, useId } from "react";
import type { AuthLocale } from "@/auth/validation";
import { ApplicationActionStatus } from "@/components/application/action-status";
import {
  initialFinanceActionState,
  type FinanceFormAction,
} from "./action-state";
import type { InvoiceDisplayStatus, PaymentSummary } from "@/modules/finance-invoicing/types";

const copy = {
  bg: {
    createTitle: "Нова чернова от резервация",
    bookingReference: "Референция на резервацията",
    customerNote: "Бележка за клиента (по избор)",
    internalNote: "Вътрешна финансова бележка (по избор)",
    create: "Създай чернова",
    issueTitle: "Издаване",
    issueConfirm: "Потвърждавам издаването с текущите неизменни данни",
    issue: "Издай фактура",
    cancelTitle: "Отмяна на чернова",
    cancelReason: "Причина",
    cancel: "Отмени черновата",
    paymentTitle: "Запиши получено плащане",
    amount: "Сума в евроцентове",
    method: "Метод",
    receivedAt: "Получено на (ISO дата и час с часова зона)",
    externalReference: "Външна референция (по избор)",
    record: "Запиши като непотвърдено",
    paymentsTitle: "Записани плащания",
    emptyPayments: "Няма записани плащания.",
    allocated: "Разпределено",
    unapplied: "Неразпределено",
    confirmEvidence: "Проверих доказателството за получаване",
    confirm: "Потвърди плащането",
    allocateTitle: "Разпредели към фактура",
    invoiceReference: "Референция на фактурата",
    allocate: "Разпредели",
    reverseTitle: "Сторнирай записаното плащане",
    reverseReason: "Причина за сторниране",
    reverseCategory: "Категория",
    reverse: "Сторнирай",
    pending: "Обработва се…",
  },
  en: {
    createTitle: "New draft from booking",
    bookingReference: "Booking reference",
    customerNote: "Customer-visible note (optional)",
    internalNote: "Internal finance note (optional)",
    create: "Create draft",
    issueTitle: "Issue",
    issueConfirm: "I confirm issue from the current immutable snapshot",
    issue: "Issue invoice",
    cancelTitle: "Cancel draft",
    cancelReason: "Reason",
    cancel: "Cancel draft",
    paymentTitle: "Record received payment",
    amount: "Amount in euro cents",
    method: "Method",
    receivedAt: "Received at (ISO date-time with time zone)",
    externalReference: "External reference (optional)",
    record: "Record as unconfirmed",
    paymentsTitle: "Recorded payments",
    emptyPayments: "No payments have been recorded.",
    allocated: "Allocated",
    unapplied: "Unapplied",
    confirmEvidence: "I checked evidence that the money was received",
    confirm: "Confirm payment",
    allocateTitle: "Allocate to invoice",
    invoiceReference: "Invoice reference",
    allocate: "Allocate",
    reverseTitle: "Reverse recorded payment",
    reverseReason: "Reversal reason",
    reverseCategory: "Category",
    reverse: "Reverse",
    pending: "Processing…",
  },
} as const;

function SubmitButton({
  idle,
  pending,
  pendingLabel,
}: {
  idle: string;
  pending: boolean;
  pendingLabel: string;
}) {
  return (
    <button className="crm-form__submit" type="submit" disabled={pending}>
      {pending ? pendingLabel : idle}
    </button>
  );
}

export function CreateInvoiceDraftForm({
  action,
  locale,
}: {
  action: FinanceFormAction;
  locale: AuthLocale;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialFinanceActionState,
  );
  const id = useId();
  const content = copy[locale];
  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate>
      <h2>{content.createTitle}</h2>
      <ApplicationActionStatus state={state} />
      <div className="crm-form__field">
        <label htmlFor={`${id}-booking`}>{content.bookingReference}</label>
        <input
          id={`${id}-booking`}
          name="bookingReference"
          required
          pattern="BKG-[A-F0-9]{24}"
          autoComplete="off"
        />
      </div>
      <div className="crm-form__field">
        <label htmlFor={`${id}-customer-note`}>{content.customerNote}</label>
        <textarea id={`${id}-customer-note`} name="customerVisibleNote" maxLength={1000} />
      </div>
      <div className="crm-form__field">
        <label htmlFor={`${id}-internal-note`}>{content.internalNote}</label>
        <textarea id={`${id}-internal-note`} name="internalNote" maxLength={1000} />
      </div>
      <SubmitButton idle={content.create} pending={pending} pendingLabel={content.pending} />
    </form>
  );
}

export function InvoiceLifecycleForms({
  cancelAction,
  issueAllowed,
  invoiceReference,
  issueAction,
  locale,
  status,
  version,
}: {
  cancelAction: FinanceFormAction;
  issueAllowed: boolean;
  invoiceReference: string;
  issueAction: FinanceFormAction;
  locale: AuthLocale;
  status: InvoiceDisplayStatus;
  version: number;
}) {
  const [issueState, issueFormAction, issuePending] = useActionState(
    issueAction,
    initialFinanceActionState,
  );
  const [cancelState, cancelFormAction, cancelPending] = useActionState(
    cancelAction,
    initialFinanceActionState,
  );
  const id = useId();
  const content = copy[locale];
  if (status !== "DRAFT" && status !== "READY_TO_ISSUE") return null;

  return (
    <div className="crm-card-grid" data-print-hidden="true">
      {issueAllowed ? (
        <form className="crm-form" action={issueFormAction} aria-busy={issuePending}>
          <h2>{content.issueTitle}</h2>
          <input type="hidden" name="invoiceReference" value={invoiceReference} />
          <input type="hidden" name="expectedVersion" value={version} />
          <ApplicationActionStatus state={issueState} />
          <label>
            <input type="checkbox" name="issueConfirmed" value="true" required />
            {content.issueConfirm}
          </label>
          <SubmitButton idle={content.issue} pending={issuePending} pendingLabel={content.pending} />
        </form>
      ) : null}
      <form className="crm-form" action={cancelFormAction} aria-busy={cancelPending}>
        <h2>{content.cancelTitle}</h2>
        <input type="hidden" name="invoiceReference" value={invoiceReference} />
        <input type="hidden" name="expectedVersion" value={version} />
        <ApplicationActionStatus state={cancelState} />
        <div className="crm-form__field">
          <label htmlFor={`${id}-cancel-reason`}>{content.cancelReason}</label>
          <textarea id={`${id}-cancel-reason`} name="reason" required maxLength={500} />
        </div>
        <SubmitButton idle={content.cancel} pending={cancelPending} pendingLabel={content.pending} />
      </form>
    </div>
  );
}

export function RecordPaymentForm({
  action,
  idempotencyKey,
  invoiceReference,
  locale,
  receivedAt,
}: {
  action: FinanceFormAction;
  idempotencyKey: string;
  invoiceReference: string;
  locale: AuthLocale;
  receivedAt: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialFinanceActionState,
  );
  const id = useId();
  const content = copy[locale];
  return (
    <form className="crm-form" action={formAction} aria-busy={pending} noValidate data-print-hidden="true">
      <h2>{content.paymentTitle}</h2>
      <input type="hidden" name="invoiceReference" value={invoiceReference} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <ApplicationActionStatus state={state} />
      <div className="crm-form__field">
        <label htmlFor={`${id}-amount`}>{content.amount}</label>
        <input id={`${id}-amount`} name="amountMinorUnits" type="number" min={1} step={1} required />
      </div>
      <div className="crm-form__field">
        <label htmlFor={`${id}-method`}>{content.method}</label>
        <select id={`${id}-method`} name="method" defaultValue="BANK_TRANSFER" required>
          <option value="BANK_TRANSFER">BANK_TRANSFER</option>
          <option value="CASH">CASH</option>
          <option value="CARD_MANUAL_REFERENCE">CARD_MANUAL_REFERENCE</option>
          <option value="OTHER">OTHER</option>
        </select>
      </div>
      <div className="crm-form__field">
        <label htmlFor={`${id}-received`}>{content.receivedAt}</label>
        <input id={`${id}-received`} name="receivedAt" type="text" defaultValue={receivedAt} required />
      </div>
      <div className="crm-form__field">
        <label htmlFor={`${id}-external`}>{content.externalReference}</label>
        <input id={`${id}-external`} name="externalReference" maxLength={160} />
      </div>
      <div className="crm-form__field">
        <label htmlFor={`${id}-internal`}>{content.internalNote}</label>
        <textarea id={`${id}-internal`} name="internalNote" maxLength={1000} />
      </div>
      <SubmitButton idle={content.record} pending={pending} pendingLabel={content.pending} />
    </form>
  );
}

type PaymentActions = Readonly<{
  allocate: FinanceFormAction;
  confirm: FinanceFormAction;
  reverse: FinanceFormAction;
}>;

function PaymentOperationsCard({
  actions,
  allocateIdempotencyKey,
  locale,
  payment,
  reversalIdempotencyKey,
}: {
  actions: PaymentActions;
  allocateIdempotencyKey: string;
  locale: AuthLocale;
  payment: PaymentSummary;
  reversalIdempotencyKey: string;
}) {
  const [confirmState, confirmAction, confirmPending] = useActionState(
    actions.confirm,
    initialFinanceActionState,
  );
  const [allocateState, allocateAction, allocatePending] = useActionState(
    actions.allocate,
    initialFinanceActionState,
  );
  const [reverseState, reverseAction, reversePending] = useActionState(
    actions.reverse,
    initialFinanceActionState,
  );
  const id = useId();
  const content = copy[locale];
  const money = new Intl.NumberFormat(locale === "bg" ? "bg-BG" : "en-IE", {
    style: "currency",
    currency: "EUR",
  });

  return (
    <article className="crm-management-card">
      <h3>{payment.paymentReference}</h3>
      <p>{payment.status}</p>
      <dl className="crm-card__details">
        <div><dt>{content.amount}</dt><dd>{money.format(payment.amountMinorUnits / 100)}</dd></div>
        <div><dt>{content.allocated}</dt><dd>{money.format(payment.allocatedAmountMinorUnits / 100)}</dd></div>
        <div><dt>{content.unapplied}</dt><dd>{money.format(payment.unappliedAmountMinorUnits / 100)}</dd></div>
      </dl>
      {payment.status === "RECORDED" ? (
        <form className="crm-form" action={confirmAction} aria-busy={confirmPending}>
          <input type="hidden" name="paymentReference" value={payment.paymentReference} />
          <input type="hidden" name="expectedVersion" value={payment.version} />
          <ApplicationActionStatus state={confirmState} />
          <label>
            <input type="checkbox" name="evidenceConfirmed" value="true" required />
            {content.confirmEvidence}
          </label>
          <SubmitButton idle={content.confirm} pending={confirmPending} pendingLabel={content.pending} />
        </form>
      ) : null}
      {payment.status === "CONFIRMED" && payment.unappliedAmountMinorUnits > 0 ? (
        <form className="crm-form" action={allocateAction} aria-busy={allocatePending}>
          <h4>{content.allocateTitle}</h4>
          <input type="hidden" name="paymentReference" value={payment.paymentReference} />
          <input type="hidden" name="idempotencyKey" value={allocateIdempotencyKey} />
          <ApplicationActionStatus state={allocateState} />
          <div className="crm-form__field">
            <label htmlFor={`${id}-invoice`}>{content.invoiceReference}</label>
            <input id={`${id}-invoice`} name="invoiceReference" pattern="INV-[A-F0-9]{24}" required />
          </div>
          <div className="crm-form__field">
            <label htmlFor={`${id}-allocation`}>{content.amount}</label>
            <input id={`${id}-allocation`} name="amountMinorUnits" type="number" min={1} max={payment.unappliedAmountMinorUnits} step={1} required />
          </div>
          <SubmitButton idle={content.allocate} pending={allocatePending} pendingLabel={content.pending} />
        </form>
      ) : null}
      {payment.status !== "REVERSED" ? (
        <form className="crm-form" action={reverseAction} aria-busy={reversePending}>
          <h4>{content.reverseTitle}</h4>
          <input type="hidden" name="paymentReference" value={payment.paymentReference} />
          <input type="hidden" name="expectedVersion" value={payment.version} />
          <input type="hidden" name="idempotencyKey" value={reversalIdempotencyKey} />
          <ApplicationActionStatus state={reverseState} />
          <div className="crm-form__field">
            <label htmlFor={`${id}-category`}>{content.reverseCategory}</label>
            <select id={`${id}-category`} name="reasonCategory" defaultValue="ENTRY_ERROR">
              <option value="DUPLICATE">DUPLICATE</option>
              <option value="ENTRY_ERROR">ENTRY_ERROR</option>
              <option value="BANK_RETURN">BANK_RETURN</option>
              <option value="OTHER">OTHER</option>
            </select>
          </div>
          <div className="crm-form__field">
            <label htmlFor={`${id}-reason`}>{content.reverseReason}</label>
            <textarea id={`${id}-reason`} name="reasonNote" required maxLength={500} />
          </div>
          <SubmitButton idle={content.reverse} pending={reversePending} pendingLabel={content.pending} />
        </form>
      ) : null}
    </article>
  );
}

export function PaymentOperationsList({
  actions,
  idempotencyKeys,
  locale,
  payments,
}: {
  actions: PaymentActions;
  idempotencyKeys: Readonly<Record<string, Readonly<{ allocate: string; reverse: string }>>>;
  locale: AuthLocale;
  payments: readonly PaymentSummary[];
}) {
  const content = copy[locale];
  return (
    <section data-print-hidden="true" aria-labelledby="finance-payments-heading">
      <h2 id="finance-payments-heading">{content.paymentsTitle}</h2>
      {payments.length === 0 ? <p>{content.emptyPayments}</p> : (
        <div className="crm-card-grid">
          {payments.map((payment) => {
            const keys = idempotencyKeys[payment.paymentReference];
            if (!keys) return null;
            return (
              <PaymentOperationsCard
                key={payment.paymentReference}
                actions={actions}
                allocateIdempotencyKey={keys.allocate}
                locale={locale}
                payment={payment}
                reversalIdempotencyKey={keys.reverse}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}
