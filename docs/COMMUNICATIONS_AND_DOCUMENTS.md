# Communications and Documents

## Scope and source boundary

Phase 3I adds an application-owned, provider-neutral foundation for turning an
already-recorded business event into a customer-safe, immutable document and
publishing that document in the authenticated VAX portal. It does not change
the authority or lifecycle of Quotes, Bookings, schedule revisions, Jobs,
Invoices or Payments.

The supplied Phase 3I brief attachment is incomplete. It ends in section 20
immediately after the words `and explicitly defer`. This implementation and
document cover only the requirements visible before that truncation. No claim
is made about requirements that may have followed the missing text.

The implemented flow is deliberately explicit:

> immutable business event → staff materialization → communication intent →
> customer-safe render snapshot → final document → local portal publication →
> customer history

Nothing observes a domain table and silently sends or publishes a message.
Authorized staff must select an eligible, immutable source event and request
materialization. The repository then revalidates the complete source,
authorization, template, preference and customer graph before inserting the
communication records atomically.

## Implemented delivery boundary

`PORTAL` is the only implemented delivery channel. A successful portal
publication means that VAX atomically created:

- a `DELIVERED_LOCAL` communication intent;
- a final immutable HTML/print document snapshot;
- one completed `PORTAL_LOCAL` delivery attempt;
- one `PORTAL_PUBLISHED` local delivery result;
- one customer communication-history entry; and
- sanitized communication audit events.

`DELIVERED_LOCAL` means published inside the authenticated VAX application. It
does not mean that the customer opened or read the document, that an external
provider accepted it, or that email, SMS, postal or payment delivery occurred.

The schema reserves `EMAIL_FUTURE`, `SMS_FUTURE` and `MANUAL` vocabulary so a
later provider adapter does not need to reinterpret historical portal rows.
Email and SMS default off, have no adapter, create no external attempt/result,
and are not exposed by the current staff Server Action. Manual staff messages
are likewise not exposed by the current materialization service. No simulated
provider success is recorded.

## Eligible source events and document types

Phase 3I consumes existing owning audit events; it does not introduce a second
generic business-event store.

| Immutable event | Source authority | Document type |
| --- | --- | --- |
| `QUOTE_ISSUED` | Exact issued Quote, frozen items and matching `business_audit_events` row | `QUOTE_SUMMARY` |
| `BOOKING_CONFIRMED` | Booking plus the exact current confirmed occupancy and matching Booking audit row | `BOOKING_CONFIRMATION` |
| `BOOKING_RESCHEDULED` | Booking plus the exact replacement occupancy version and matching Booking audit row | `BOOKING_CONFIRMATION` |
| `BOOKING_CANCELLED` | Cancelled Booking and matching Booking audit row | `BOOKING_CONFIRMATION` |
| `JOB_COMPLETED` | Completed Job and matching Job audit row | `JOB_COMPLETION_SUMMARY` |
| `JOB_COMPLETED` | Eligible customer-safe Cleaning Passport entries from the completed Job | `CLEANING_PASSPORT` |
| `INVOICE_ISSUED` | Exact issued Invoice, frozen items/snapshots and matching finance audit row | `INVOICE` |
| `PAYMENT_CONFIRMED` | Exact confirmed Payment version and matching finance audit row | `PAYMENT_ACKNOWLEDGEMENT` |
| `PAYMENT_REVERSED` | Exact reversed Payment version and matching finance audit row | `PAYMENT_ACKNOWLEDGEMENT` |

Every lookup requires the event type, source reference, source version and
owning audit record to agree. Booking confirmation and reschedule also require
the exact occupancy revision. Missing, stale, malformed or inconsistent
provenance returns a staff-review result; VAX does not refresh CRM data,
renormalize a request, reprice work, recalculate duration, repair a schedule or
reinterpret a financial event.

## Customer-safe source projections

Documents are built from allowlisted projections, not from serialized domain
rows or arbitrary JSON supplied by the browser.

- Quote documents use issued commercial evidence and frozen customer-safe line
  descriptions. Property access notes, coordinates, request free text,
  estimate internals and staff notes are excluded.
- Booking documents use the exact appointment revision for confirmed or
  rescheduled service. A later mutable Booking view cannot rewrite an earlier
  document.
- Job summaries use completed execution evidence and customer-visible results.
  Cleaning Passports use only eligible customer-safe Passport entries, never
  internal technician notes or unperformed work.
- Invoice documents use the issued Invoice and frozen legal/commercial/line
  snapshots rather than current CRM or price configuration.
- Payment acknowledgements describe only the VAX Payment state. They are not
  bank/provider verification, proof of funds movement, a fiscal receipt or an
  automatic refund confirmation.

The intent stores a minimal source snapshot containing the source checksum,
owning audit-event type, source reference/version, event and document type.
The final document stores a separately validated customer-safe content
snapshot. This separation prevents sensitive source evidence from becoming a
customer document accidentally.

## Locale, contacts and preferences

Document locale is durable `bg` or `en`; it is never inferred from browser
language. Resolution is:

1. the exact active selected contact's locale for a future contact channel;
2. the customer's saved communication-preference locale; or
3. the immutable source/customer locale captured by the source projection.

Portal publication has no recipient contact because access is through the
customer account. A future email/SMS intent must reference an active contact
belonging to the same customer, contain the required email address or phone
number, and copy a versioned contact snapshot. Email equality never establishes
ownership or authorization.

`customer_communication_preferences` keeps channel, purpose and marketing
choices distinct:

- portal, operational and billing communication default on;
- future email and SMS default off;
- marketing consent defaults off; and
- the database prohibits an automated marketing intent in this phase.

Customers may update only their own preferences using optimistic versioning.
Changing a current preference never mutates a final document, delivery result
or prior history entry.

## Templates and rendering

Phase 3I seeds version 1 Bulgarian and English templates for every implemented
event/document pair. Templates use plain text plus an explicit array of
allowlisted placeholder names. The renderer:

- rejects an inactive or mismatched template;
- requires the template contract, used placeholders and supplied variables to
  match exactly;
- rejects unknown, missing, duplicate or malformed placeholders;
- performs no code evaluation; and
- produces a strictly validated structured content snapshot.

One active version per template key and locale is permitted. Referenced
versions remain historical authority. A later correction must use a new
template/document version and explicit supersession rather than edit a final
document.

ATTELIER finalization adds distinct `attelier_payment_confirmed` and
`attelier_payment_reversed` template keys, each at version 1 in BG/EN. New
payment materialization selects these identities and ATTELIER projection
notices. The existing 18 canonical templates, including the four legacy VAX
payment variants, remain byte-identical under their historical keys. The
insert-only canonical seed adds four rows; it does not supersede or update an
existing row. Until those new keys are seeded through the reviewed staging
operator path, materialization fails closed rather than selecting a legacy
template. No stored document is re-rendered or automatically republished.

The document checksum already binds template key/version, locale and the full
projected content. The new keys therefore identify the prospective copy without
changing source-event provenance or the stored content schema. Historical
customer reads return the persisted snapshot and checksum unchanged. Payment
acknowledgements still disclaim external-provider delivery and automatic funds
movement/refunds.

The current renderer produces server-owned `HTML_PRINT` snapshots and an
accessible print view. It stores structured content, not executable HTML. The
SHA-256 checksum binds canonicalized content to template key/version, locale
and renderer version. Object key order therefore cannot change the checksum,
while any material content or version change does.

Binary PDF generation, PDF storage, object storage and signed download URLs are
deferred. PostgreSQL stores neither a generated PDF nor another binary file.

## Data model and integrity

| Structure | Responsibility |
| --- | --- |
| `communication_templates` | Versioned bilingual plain-text templates and exact variable contracts |
| `customer_communication_preferences` | Customer channel, purpose, marketing and durable locale choices |
| `communication_intents` | Exact customer, source/audit provenance, channel, template, snapshots, lifecycle and idempotency |
| `documents` | Versioned immutable rendered content, renderer identity, checksum and supersession relationship |
| `delivery_attempts` | Append-only local portal attempt evidence |
| `delivery_results` | One append-only terminal local result per attempt |
| `customer_communication_history_entries` | Customer-visible publication timeline tied to the exact result/document |
| `communication_audit_events` | Sanitized lifecycle and preference evidence |

Random `COM-`, `DOC-`, `DEL-` and `HIS-` references carry 96 bits of entropy and
do not expose sequential database identifiers. Composite restrictive foreign
keys bind contacts and business sources to the same customer and bind the
intent, document, attempt, result and history graph to one customer. Historical
business references use `ON DELETE RESTRICT`; only actor-profile metadata may
become null.

Database checks constrain event/source/document combinations, purpose,
channel, locale, lifecycle timestamps, checksums and JSON object shape. Unique
keys prevent duplicate event/template/channel materialization and payload-bound
idempotency detects conflicting retries. Database guards protect referenced
templates and intents, final/superseded documents and append-only delivery,
history and audit rows. Deferred graph checks require each inserted delivery or
audit record to match its owning customer and lifecycle.

The current staff operation inserts the intent, final document, portal attempt,
result, customer history and audit evidence in one database statement. A
failure creates no partial published graph.

## Authorization and application surfaces

Two new application permissions are added without creating a role:

- `COMMUNICATIONS_READ`; and
- `COMMUNICATIONS_MANAGE`.

Owner and Admin receive both. Dispatcher receives both but still cannot cross
the source-domain boundary. Every staff materialization requires both
communication permissions and the source-specific conjunction:

| Source | Additional current permissions |
| --- | --- |
| Issued Quote | `CUSTOMER_RECORDS_READ` + `OPERATIONS_READ` |
| Booking event | `CUSTOMER_RECORDS_READ` + `OPERATIONS_READ` + `SCHEDULE_READ` |
| Completed Job / Passport | `CUSTOMER_RECORDS_READ` + `OPERATIONS_READ` + `FIELD_JOBS_READ` |
| Invoice or Payment | `CUSTOMER_RECORDS_READ` + `FINANCE_READ` |

The service and PostgreSQL repository both recheck the conjunction. Navigation,
a role name, a source reference or a hidden form value is never authority.

Customer history and documents require `OWN_CUSTOMER_DATA_READ` plus the exact
current active, non-revoked application-profile/customer link. Preference
updates additionally require `OWN_CUSTOMER_DATA_UPDATE` and exactly one active
linked customer. Customer routes return only final or superseded documents
with a matching local portal result; staff queues, drafts, failed/deferred
state, contact snapshots, audit data and another customer's documents remain
outside that projection.

The implemented protected surfaces are:

- `/app/communications` and its reference detail for authorized staff;
- `/app/my-communications` for a linked customer's history/preferences; and
- `/app/my-documents/[documentReference]` for the immutable customer document.

Server Actions strictly parse inputs, ignore browser-selected customer scope,
apply the bounded `COMMUNICATION_MUTATION` limiter to authorized mutations and
return localized non-enumerating errors.

## Audit and privacy boundary

The communications audit stream records allowlisted lifecycle facts such as
intent creation, rendering, finalization, local portal publication, future-
channel deferral and preference updates. Safe metadata may contain controlled
event/channel/template/version/result codes. It must not contain document
bodies, addresses, contact values, payment references, provider responses,
free-form notes, credentials or tokens.

Customer communication history is retained business evidence, not an inbox
cache. Revoking a customer identity link removes future access but does not
delete or reassign immutable documents. Retention, lawful erasure or
anonymization, export, correction, legal hold, marketing consent evidence and
shared-household/company contact authority remain production policy gates.

## Migration and environment boundary

Migration `0011_phase_3i_communications_documents.sql` is additive. It creates
only application-owned communication/document structures, supporting composite
indexes and database integrity guards. It does not rewrite migrations
`0001`–`0010`, alter `neon_auth`, seed a customer or contact, send a message,
create a provider account, store a binary PDF or touch production.

Canonical bilingual templates are code-controlled and seeded after an
authorized migration. The migration and seed may be applied only to the Neon
`development` branch through the existing development mutation interlocks.
Neon production migration and deployment are separately unauthorized.

## Explicit deferrals and production gates

Phase 3L does not reinterpret `EMAIL_FUTURE` as delivery. The staging readiness
contract is explicitly `EMAIL_DELIVERY_MODE=blocked` until an approved
test-recipient-only mail sink or sandbox exists. No external message, real
recipient, provider credential, DNS claim or delivery result was created. A
future adapter must preserve the existing immutable intent/document provenance,
record failure/retry outcomes accurately, bound resend attempts and keep the
business transaction independent from provider availability.

Phase 3I does not include:

- external email, SMS, postal or messaging-provider integration;
- provider credentials, webhooks, callbacks, retries, suppression/bounce
  handling or external delivery receipts;
- manual free-form staff messages or marketing campaigns;
- customer-open/read tracking;
- binary PDF generation/storage or a legal electronic-signature service;
- automatic materialization from historical or future domain events;
- automatic document correction, supersession UI or bulk backfill;
- browser Data API/SQL access;
- production migration or deployment; or
- a claim of GDPR, electronic-communications, invoicing, fiscal or archival
  compliance.

Before any production or external-delivery step, VAX still requires approved
contact authority and consent/suppression policy, retention and data-subject
procedures, provider selection and secrets, trusted origins, distributed rate
limiting, monitoring/recovery, reviewed RLS and least-privilege grants, delivery
reconciliation, accessibility/browser verification and a separately authorized
production migration/deployment review. The missing remainder of the truncated
Phase 3I brief must also be recovered and reconciled.
