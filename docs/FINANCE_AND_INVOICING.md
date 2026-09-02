# Finance and Invoicing

## Purpose and Phase 3H boundary

Phase 3H adds a controlled finance ledger after the accepted commercial and
operational workflow:

> immutable issued Quote → Quote Acceptance → Booking → optional completed Job
> → draft Invoice → issued Invoice → confirmed Payment → allocation → settlement

The records remain separate:

- a Quote is the reviewed commercial offer;
- a Booking is the accepted commercial and operational commitment;
- a Job records actual field execution;
- an Invoice is a formal financial claim and customer document record;
- a Payment records money reported as received outside VAX; and
- a Payment Allocation applies confirmed money to an invoice balance.

VAX does not process money in this phase. There is no live card gateway, bank
API, payment webhook, fiscal device, accounting-system export, payroll,
inventory accounting, refund execution, full credit-note workflow, generated
PDF or production deployment.

## Financial source authority

Invoice creation consumes only immutable accepted commercial evidence. The
repository locks and verifies the exact Quote Acceptance, Booking, Booking
items, issued Quote and Quote items. It copies descriptions, measurements,
calculation evidence, currency, VAT and totals from that chain. It does not run
the current price book, normalize the Request again, recalculate duration,
refresh mutable CRM facts into the commercial scope or infer a correction from
Job execution.

Current CRM is used only to confirm the exact customer/property relationship,
current customer type and a separately versioned approved billing profile.
Current seller and invoice-policy records are configuration gates, not sources
from which accepted commercial amounts may be changed.

The invoice stores explicit source relationships plus immutable customer,
seller, commercial, terms, provenance and eligibility snapshots. Each invoice
item is tied to the exact Quote item and Booking item, and optionally to the
matching Job item. Composite restrictive foreign keys prevent a line from being
attached across a different Booking, Quote, customer or property graph.

If commercial provenance, line counts, item relationships, totals, billing
facts, seller facts, VAT state or configured eligibility cannot be reconciled
exactly, VAX returns `FINANCE_REVIEW_REQUIRED`. It does not repair, refresh,
reprice or partially issue the record.

## Finance configuration

Four versioned structures control invoice readiness:

| Structure                    | Purpose                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `customer_billing_profiles`  | Customer-specific invoice-time billing identity and address                                                            |
| `business_legal_profiles`    | Environment-scoped seller identity and customer-visible payment instructions                                           |
| `invoice_numbering_policies` | Environment/document-scoped prefix, width and serialized sequence                                                      |
| `invoice_policies`           | Environment-scoped draft/issue eligibility, payment terms, due days, currency and approved seller/numbering references |

Configuration uses `DRAFT`, `APPROVED` and `SUPERSEDED` lifecycle values.
Approval and supersession create an attributable history. An approved version
that has been used by finance history is not an ordinary editable settings row;
changed legal, VAT, numbering or terms facts require a new reviewed version.

Development configuration may be explicitly provisional. Production invoice
issue requires an approved, non-provisional production policy and numbering
policy plus an approved seller legal profile in the same environment. The
migration seeds no seller identity, registration number, VAT number, bank
account, billing profile or invoice policy. Those facts must be supplied and
approved by the owner through a later controlled process.

## Invoice eligibility and review

The invoice policy independently controls draft and issue eligibility with:

- `BOOKING_ACCEPTED`; and
- `JOB_COMPLETED`.

The allowed combinations have explicit behavior:

- `BOOKING_ACCEPTED` draft + `BOOKING_ACCEPTED` issue may create a
  `READY_TO_ISSUE` draft when every other gate is clear;
- `BOOKING_ACCEPTED` draft + `JOB_COMPLETED` issue may create an immutable
  `DRAFT` whose sole review reason is `JOB_COMPLETION_REQUIRED`; after exact Job
  completion, issue may advance it only by freshly revalidating the full
  source/item/configuration/Job graph, without updating its snapshots; and
- `JOB_COMPLETED` draft + `JOB_COMPLETED` issue blocks draft creation until the
  exact Job and item scope are complete.

The configuration cannot require Job completion for draft while allowing issue
at the earlier Booking boundary. VAX does not hard-code one legal or commercial
timing assumption.

When completion is required, the exact Job must be `COMPLETED`, every Job item
must correspond to a Booking item, and its quantity and planned measurement
must still match the immutable booked scope. Omitted, declined, referred,
unquoted or materially changed work is not automatically repriced. It remains
finance review.

Controlled review reasons cover incomplete or inconsistent commercial
provenance, missing or unapproved customer billing data, missing or unapproved
seller data, unresolved VAT, missing invoice/numbering policy, required Job
completion, Job-scope difference and a requested manual commercial adjustment.
A review-required invoice cannot be issued except for the deliberately
completion-waiting draft described above, and that exception succeeds only
when `JOB_COMPLETION_REQUIRED` was its sole reason and the issue transaction
proves every gate afresh. It never clears another reason or refreshes a
snapshot.

## Invoice model and lifecycle

`invoices` stores a random non-sequential public reference, nullable formal
number, exact source/configuration identities, customer/property ownership,
type, status, dates, integer EUR totals, settlement values, immutable snapshots,
separate internal/customer-visible notes, idempotency evidence, actors,
timestamps and an optimistic version. `invoice_items` stores the frozen
bilingual line descriptions, quantity, measurement, net/VAT/gross amounts,
VAT rate and exact source provenance.

The implemented standard-invoice lifecycle is:

```text
creation -> READY_TO_ISSUE -> ISSUED -> PARTIALLY_PAID -> PAID
         |                |
         |                +-> CANCELLED (before issue only)
         +-> DRAFT -> CANCELLED

DRAFT (sole JOB_COMPLETION_REQUIRED) -> ISSUED
                                      (only after exact fresh revalidation)
```

- `DRAFT` includes records that need finance review and the controlled
  completion-waiting record described above.
- `READY_TO_ISSUE` means the configured issue prerequisites were clear when the
  draft was created; issue still revalidates every authoritative source.
- `ISSUED` receives its immutable number, issue date and due date atomically.
- `PARTIALLY_PAID` and `PAID` are derived by controlled allocations.
- `CANCELLED` is limited to an unissued draft/readiness record.
- `OVERDUE` is a display state derived when an issued or partially paid invoice
  has an outstanding balance and its due date has passed in Sofia civil time.

The schema reserves `PROFORMA`, `CREDIT_NOTE` and `CREDITED_FUTURE` vocabulary
for compatible future work. Phase 3H creates only `STANDARD` invoices and does
not claim that a proforma is a tax invoice or implement credit-note semantics.

Invoice items are immutable from insertion. After issue, the number, dates,
source identities, customer/seller/commercial/terms/provenance snapshots, VAT
and totals are also immutable. Settlement may change only through the payment
ledger. A future correction must append a credit note or replacement document;
it must never edit issued history down.

## Money, VAT, B2C and B2B

All persisted monetary values are integer EUR minor units. VAT rates use
integer basis points. Invoice and line constraints require:

```text
line net + line VAT = line gross
sum(line net) = invoice net
sum(line VAT) = invoice VAT
invoice net + invoice VAT = invoice gross
0 <= paid <= gross
outstanding = gross - paid
```

Phase 3H does not introduce a second rounding engine. It copies the exact line
and aggregate values frozen by the issued Quote, whose Phase 2A calculation
used integer half-up cent rounding. Issue rechecks line sums and Quote/Booking
totals rather than rounding them again.

The seller snapshot records `VAT_REGISTERED`, `VAT_NOT_REGISTERED` or an
unresolved state. A registered seller preserves the accepted net- or
gross-basis calculation. A non-registered seller requires zero VAT and net
equal to gross. Unresolved or contradictory state blocks issue. A development
20% rate in an upstream price book remains provisional evidence, never a
permanent legal rate or proof of the seller's registration.

Individual/residential records retain the accepted gross-facing basis.
Business records retain the accepted net-facing basis and require an approved
billing profile with the applicable company/VAT state. User-entered VAT
identifiers remain `UNVERIFIED`; `VERIFIED_FUTURE` is structural readiness for
a later reviewed verification process, not a network validation implemented
here.

## Numbering and due dates

Formal invoice numbers are allocated only during issue. The transaction locks
the one approved numbering policy, consumes its next sequence and increments
the counter before the invoice becomes `ISSUED`. Unique constraints protect the
number itself and the `(numbering_policy_id, numbering_sequence)` pair. The
formatted sequence expands rather than truncates if it exceeds the configured
padding width. Issued numbers are never released or reused.

Prefix, padding and next sequence are environment- and document-specific
configuration. Development may use an unmistakable development prefix;
production numbering is blocked until the owner and qualified accountant have
approved a production policy. VAX does not assert that any development prefix
or sequence is legally valid.

Issue and due dates are server-owned. The issue date is the Sofia civil date;
the due date uses the approved policy's bounded due-day value. Payment terms
are frozen in the invoice snapshot as `PAY_ON_COMPLETION`, `PAY_ON_INVOICE`,
`PREPAYMENT` or `CUSTOM`. These codes do not by themselves establish legal
meaning. A `CUSTOM` policy requires an explicit later due-date decision rather
than inventing one.

## Customer and seller snapshots

An approved customer billing profile is a versioned invoice identity, separate
from mutable general CRM presentation. It supports individual and business
billing names, email, postal address, company registration identifier, VAT
identifier and controlled VAT-verification state. Values are never fabricated
from an email address or inferred solely from customer type.

The seller snapshot copies only an approved environment-matched legal profile:
legal name, registration/VAT state, registered address, contact and optional
customer-visible payment instructions. There is no dedicated bank-account
schema in Phase 3H and no seed containing bank details. Customer pages show
payment instructions only when they were explicitly approved and frozen into
the seller snapshot; otherwise they show none.

Historical invoices render from these snapshots and frozen line descriptions,
not from current CRM, seller configuration, service catalogue labels or price
rules.

## Payments and confirmation

`payments` records money received outside VAX. It stores a random reference,
customer, status, controlled method, EUR amount, allocated and generated
unallocated balances, received time, optional external reference, separate
internal note, actor, optimistic version and idempotency fingerprint.

Methods are:

- `BANK_TRANSFER`;
- `CASH`;
- `CARD_MANUAL_REFERENCE`; and
- `OTHER`.

`CARD_MANUAL_REFERENCE` means only that a staff member recorded an external
card event. It is not card processing. `CASH` is likewise a manual record and
does not claim receipt or fiscal-device compliance.

A new payment starts `RECORDED`. It cannot be allocated until an authorized
staff member explicitly confirms the supporting evidence, moving it to
`CONFIRMED`. `REVERSED` is terminal for the original payment. The application
does not call a bank or provider to verify these states.

## Allocations and settlement

`payment_allocations` is an append-only ledger. An `ALLOCATION` applies part of
one confirmed payment to one payable invoice; a `REVERSAL` compensates one
specific earlier allocation. This permits one payment to settle several
invoices and one invoice to receive several payments without changing source
payment facts.

Allocation locks the payment first and the invoice second, rechecks current
authorization and state, and derives both balances in the database transaction.
Composite keys require the same customer and currency on payment and invoice.
The write is rejected when it would exceed the payment's unallocated amount,
exceed the invoice's outstanding amount, target an unconfirmed/reversed
payment, or target a cancelled/non-payable/already-paid invoice.

A positive allocation below gross moves the invoice to `PARTIALLY_PAID`; exact
coverage moves it to `PAID`. Unallocated payment value remains visible for
staff review. Phase 3H does not create a customer-credit asset, automatically
apply excess value elsewhere or infer an overpayment/refund policy.

Payment recording and allocation use payload-bound idempotency keys. Repeating
the same key and same payload is a safe retry; reusing it for different values
is a conflict. Random reference collisions are retried only within a small
bounded application loop.

## Reversals, credit notes and refunds

Payment reversal never deletes or rewrites ledger history. It locks the
payment, then every affected invoice in deterministic order; appends one
`payment_reversals` fact; appends one compensating `REVERSAL` allocation for
each still-effective allocation; restores invoice balances/statuses; marks the
payment `REVERSED`; and writes audit evidence in one transaction. A payment can
have at most one reversal record, and each original allocation can be
compensated at most once.

This is accounting-history readiness, not money-out processing. A future refund
must coordinate an authorized bank/payment-provider action, the compensating
allocation history and finance audit. A future invoice correction must issue a
properly linked credit note and must not reduce or cancel the original issued
invoice in place. Legal tax-document and refund policy remain unimplemented.

## Authorization and application surfaces

Phase 3H adds four permission codes without adding an `ACCOUNTANT` role:

| Permission       | Purpose                                                             | Canonical roles |
| ---------------- | ------------------------------------------------------------------- | --------------- |
| `FINANCE_READ`   | Staff finance dashboard, invoice and payment reads                  | Owner, Admin    |
| `FINANCE_MANAGE` | Draft creation/cancellation and high-risk reversal conjunction      | Owner, Admin    |
| `INVOICE_ISSUE`  | Explicit invoice issue                                              | Owner, Admin    |
| `PAYMENT_RECORD` | Record, confirm and allocate payments; part of reversal conjunction | Owner, Admin    |

Payment reversal requires the exact conjunction `FINANCE_READ`,
`FINANCE_MANAGE` and `PAYMENT_RECORD`. Dispatcher and Technician receive no
finance permission.
Customer invoice access reuses `OWN_CUSTOMER_DATA_READ` plus the current exact
active identity/customer link. Navigation visibility is never authority;
repository operations repeat application-profile status and permission checks.

Staff surfaces are `/app/finance`, `/app/invoices` and
`/app/invoices/[invoiceReference]`. They provide a bounded operational
dashboard, invoice list/detail, controlled mutations, payment list and safe
finance/audit context. They are not a general ledger or profitability report.

Customer surfaces are `/app/my-invoices` and
`/app/my-invoices/[invoiceReference]`. They expose only that linked customer's
`ISSUED`, `PARTIALLY_PAID` or `PAID` invoices, frozen customer/seller blocks,
lines, VAT, dates, total, paid/outstanding amounts, display status and approved
payment instructions. Draft/review/cancelled invoices, internal notes,
commercial/provenance internals, staff audit metadata, actor identifiers,
payments and other customers are excluded.

The detail page is print-friendly and is the data/presentation foundation for a
future server-generated PDF. Printing does not create a separate persisted
document, signature, delivery event or legal-compliance assertion.

All finance Server Actions authenticate, authorize and apply the existing
`FINANCE_MUTATION` abuse-control boundary before parsing strict allowlisted
fields. Browser input never supplies customer, currency, amounts/tax totals,
seller facts, numbering, status, source snapshots, actor or audit metadata.

## Concurrency, integrity and audit

Finance writes use optimistic record versions, row locks, deterministic lock
order, transaction-safe counters, uniqueness, composite provenance keys and
database arithmetic checks. Important concurrent boundaries include:

- one live standard invoice per Booking;
- one issue and one serialized number per invoice;
- no duplicate number/sequence;
- no over-allocation of a payment or invoice under concurrent writers;
- payment-first locking for allocation/reversal races;
- payload-bound idempotent recording, allocation and reversal; and
- immutable issued invoice/configuration/append-ledger history.

`finance_audit_events` is an owned append-oriented event stream for draft,
readiness, issue, cancellation, payment recording/confirmation/allocation/
reversal and invoice settlement/review changes. Metadata is allowlisted and
uses safe references, controlled codes and integer amounts. It excludes
credentials, provider subjects, customer addresses, bank details and free-form
notes. It is separate from authentication, request/Quote, Booking and Job audit
streams.

Application authorization and database checks are complementary. Production
still requires reviewed runtime roles, least-privilege grants, row-level
security and append-only enforcement; server-mediated access is not a claim
that those deployment controls already exist.

## Privacy, development and environment boundary

Billing identities, addresses, company/VAT identifiers, invoice history,
payment facts and external payment references are sensitive customer/business
data. They must not enter URLs, logs, generic analytics, audit metadata or
technician/dispatcher projections. Internal notes must not contain credentials,
bank secrets, card data, identity documents or unrelated sensitive data.

Migration `0010_phase_3h_finance_invoicing.sql` was introduced on Neon
`development` and later carried into the isolated staging migration history
under the dedicated staging interlocks. It creates no Neon Auth object and does
not authorize browser Data API access. Development/staging integration tests
may create only synthetic finance fixtures, must create no Auth identity and
must remove transient records after verification. Production migration and
deployment remain separately unauthorized.

Phase 3N migration 0016 extends the existing seller, numbering, Invoice-policy
and Invoice environment checks with the exact `STAGING` scope. Finance Server
Actions derive `DEVELOPMENT`, `STAGING` or `PRODUCTION` only through the
explicit validated `VAX_ENVIRONMENT` boundary; hosted staging and production
fail closed when it is missing, blank or unsafe. Hosted staging is not treated
as production merely because its Next.js build uses `NODE_ENV=production`, and
`NODE_ENV` can never activate production finance policy. Payment-term due days
are structurally `DAYS` with a nonnegative integer, but Phase 3N supplies no
actual term. This compatibility change inserts or approves no seller, VAT,
payment, numbering or Invoice-policy value, and existing financial/commercial
snapshots remain unchanged.

## Compliance and production gates

This implementation does **not** claim Bulgarian or other legal, tax, fiscal,
VAT, accounting, cash-receipt, invoice-document, retention or GDPR compliance.
Before any production financial use, the owner must obtain qualified Bulgarian
accountant and legal review and approve at least:

- the seller's real legal identity, registration and VAT status;
- B2C/B2B invoice content, VAT treatment and rounding/display rules;
- invoice type, sequence, prefix, numbering continuity, correction, void and
  retention policy;
- payment terms, due-date, cash-receipt and overpayment/customer-credit policy;
- fiscal-device/NRA obligations and any required receipt integration;
- refund and credit-note legal/operational workflows;
- customer billing/VAT-number verification and lawful data retention;
- approved production seller, numbering and invoice-policy versions;
- production SMTP and trusted origins, distributed rate limiting, sanitized
  monitoring/alerting, backup/PITR and recovery rehearsal;
- reviewed production database roles, row-level security, least-privilege and
  append-only audit/ledger grants; and
- a separately authorized production migration and deployment.

Production must fail closed until approved production seller, numbering and
invoice policies exist. Development placeholders or provisional upstream
commercial/VAT values must never be promoted as operational authority.

## Deferred integrations and decisions

Later, separately scoped work may add:

- provider adapters and verified webhooks for card/bank payments;
- deposits and prepayments before a final invoice;
- an explicit customer-credit/overpayment ledger;
- legally reviewed credit notes, replacement documents and refunds;
- immutable generated PDF/document storage and delivery evidence;
- accountant-approved CSV or accounting-system exports and any applicable
  statutory format;
- broader reconciliation, write-off and exceptional correction workflows; and
- finance-specific retention, data-subject, monitoring and recovery runbooks.

None is implied by the Phase 3H schema or UI.
