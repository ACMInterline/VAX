# Quote Acceptance and Booking Engine

## Phase 3E decision and boundary

Phase 3E implements the first durable transition from reviewed commercial work
to an operational booking:

> immutable issued Quote → immutable Quote Acceptance → Booking → copied
> Booking Items → reviewed Scheduling Occupancy

The accepted issued quote is the commercial authority. Acceptance never runs a
current price book, duration model, normalization flow or CRM repair flow. It
does not reinterpret customer-reported facts, refresh staff-normalized request
facts, replace estimate evidence or silently repair a stale relationship. If
the request, CRM graph, estimate provenance, quote provenance, commercial
totals or item graph is inconsistent at acceptance time, the operation fails
closed to staff review and writes no acceptance or booking.

This phase deliberately does not implement payment, invoice, technician Job,
treatment completion, upload, message, notification delivery, recurring
maintenance, production migration or deployment.

Phase 3F now consumes this boundary downstream without changing it. One Job may
be created only from a provenance-valid Booking and the immutable issued-Quote
`acceptance_source_snapshot`. Job creation never reinterprets or refreshes the
request, estimate, Quote, acceptance or commercial evidence documented here.
Phase 3G likewise schedules only from the immutable Booking/issued-Quote chain
and an explicit staff-frozen operational requirements review. It never uses a
current request normalization, estimate recalculation, mutable CRM repair or
repricing step as schedule authority.
Phase 3H consumes the accepted commercial chain for finance without updating
the Booking, acceptance or Quote and without using execution differences to
silently change price.

## Domain separation

| Record | Authority |
| --- | --- |
| `service_requests` and request items | What was reported and the separate staff-normalized interpretation |
| `request_estimates` | One append-only price/duration calculation and its source evidence |
| `quotes` and quote items | One reviewed commercial offer frozen when issued |
| `quote_acceptances` | Explicit agreement to exactly one immutable issued quote version |
| `bookings` and booking items | The durable operational commitment and copied commercial/service evidence |
| `booking_occupancies` | A versioned operational interval for one team and optional equipment resource |
| `booking_audit_events` | Append-oriented acceptance, booking, scheduling, rescheduling, assignment, review, cancellation and occupancy-release evidence |
| Phase 3F `jobs` and Job items | Field execution scope copied from the immutable Booking/issued-Quote chain; never a Booking rewrite |
| Phase 3H Invoices and items | Financial claim copied from the exact accepted Quote/Booking lines; never a Booking reprice |

Booking creation does not change the accepted quote into a mutable order. The
quote remains `ISSUED`, and its request remains `QUOTED`. The unique acceptance
relationship is the authoritative evidence that the quote was accepted; VAX
does not add an `ACCEPTED` quote status or use the request status as a substitute
for acceptance.

## Phase 3F downstream execution boundary

A Job is not another commercial interpretation. Creation accepts only the
Booking, its copied items, the exact Quote Acceptance and the immutable
issued-Quote `acceptance_source_snapshot` as planned-scope authority. It does
not query current request or estimate rows as a fallback, rerun normalization,
pricing or duration, or refresh mutable CRM facts into the accepted scope. Any
inconsistent identity, item, version, ownership or source snapshot fails closed
with zero Job writes.

Current CRM is consulted only for active asset/property ownership integrity
and a separate purpose-limited visit-contact snapshot. It cannot replace
the issuance-time customer/property presentation or reported/normalized item
facts. Job items intentionally contain no price, tax, margin or commercial
calculation fields.

Only a current `CONFIRMED` occupancy that exactly matches the Booking's
scheduled time, team and equipment can make the Job `READY`. Otherwise an
otherwise valid Booking can produce only a non-executable `PREPARED` Job with
review reasons. Phase 3F assignment can bind that exact occupancy; it does not
implement the general scheduling/rescheduling command deferred by Phase 3E.
See `docs/JOB_EXECUTION.md`.

## Phase 3G scheduling boundary

Phase 3G implements that staff scheduling command while preserving Phase 3E
authority. Staff review freezes service location, immutable booked duration,
required team capabilities, optional required equipment capability and exact
policy versions only from the intact Booking, Booking items and issued-Quote
acceptance snapshot. If those facts cannot be reconciled without interpreting
or repairing the source chain, the Booking remains `REVIEW_REQUIRED`.

Candidate preview reuses current availability, but it is neither a hold nor an
occupancy. Exact confirmation locks and revalidates Booking version, preview
inputs, current team/equipment/capability state, working hours, travel and both
adjacent occupancies before it writes. One transaction appends the occupancy,
updates the matching Booking schedule and appends audit evidence; GiST
exclusion constraints remain the final concurrent conflict guard.

Rescheduling cancels the prior blocking occupancy and appends a linked higher
snapshot version with a controlled reason. It never edits historical
provenance or commercial values. A `READY` Job cannot be silently rebound; the
reschedule command fails closed to explicit staff Job review. See
`docs/SCHEDULING_AND_DISPATCH.md`.

## Phase 3H downstream finance boundary

An Invoice is not a mutable commercial extension of a Booking. Draft creation
locks the exact Booking, Quote Acceptance, issued Quote, Booking items and Quote
items, and copies their accepted integer amounts, VAT, bilingual descriptions,
measurements and calculation evidence. Issue repeats the complete source,
item-graph and aggregate checks. Neither operation normalizes the Request,
recalculates the Estimate, refreshes CRM commercial facts, reprices a Job
difference or modifies this Booking.

Invoice policy may allow a draft after `BOOKING_ACCEPTED` or require a completed
Job before draft and/or issue. Draft-level `JOB_COMPLETED` blocks creation.
Booking-level draft plus Job-level issue may preserve the immutable accepted
snapshot as a `DRAFT` with only `JOB_COMPLETION_REQUIRED`; later issue must
reprove the entire source/configuration/item/Job graph. When completion is
required, every completed Job item must still match its Booking item quantity
and planned measurement. Omitted, declined, referred, additional or materially
changed work does not rewrite the Booking or become an automatic Invoice
adjustment; it remains controlled finance review.

An Invoice holds restrictive composite provenance back to the same acceptance,
Booking, Quote, request, customer and property. Each Invoice item is bound to
the same Booking/Quote item pair and optionally the matching Job item. A source
mismatch, stale commercial snapshot, missing line, aggregate difference or
incomplete billing/legal/VAT gate produces no issued number. See
`docs/FINANCE_AND_INVOICING.md`.

## Eligibility and authorization

The transactional acceptance boundary rechecks all authority and provenance.
An acceptance is eligible only when:

- the exact quote reference and expected quote version identify an `ISSUED`
  quote with an issue timestamp;
- current time is at or after `valid_from` and strictly before `valid_until`;
- the source request is still `QUOTED`, linked to the same customer and
  property, and at the exact post-issue request version;
- the quote has a database-built `acceptance_source_snapshot` frozen in the
  same statement that issued it;
- locked current request facts (including separate reported/normalized item,
  issue and add-on provenance), estimate evidence, allowed CRM presentation,
  property/travel-zone semantics and quote items equal that issued snapshot
  exactly as JSONB, with no missing, extra or changed value;
- the selected estimate still satisfies the strict Phase 3D evidence contract:
  allowlisted engine input and line types, canonical price/duration inputs,
  complete versioned configuration, valid matching timestamps, internally
  consistent money/duration/flags/status, and canonical warnings/review codes;
- the customer, property and travel zone remain active, estimate/quote
  identity, price/duration evidence, exact totals and item graph remain valid;
  and
- no existing acceptance/booking has already consumed the quote.

The customer path additionally requires `OWN_CUSTOMER_DATA_UPDATE` and a
current active identity link to the exact customer. It never accepts a
client-supplied customer scope. Staff acceptance requires both
`CUSTOMER_RECORDS_MANAGE` and `OPERATIONS_MANAGE`, an allowlisted source, and a
non-blank evidence note. Anonymous acceptance is not available.

The preview state is only presentation guidance. The write statement repeats
authorization, relationship, lifecycle, validity and integrity checks while
locking the quote/request for update and the exact CRM, zone, estimate,
request-item and quote-item sources for share. Missing and forbidden targets
retain the same safe external result, and internal integrity reason details are
not exposed to customers.

## Atomicity and idempotency

One database operation creates the acceptance, booking, copied booking items
and the `QUOTE_ACCEPTED`/`BOOKING_CREATED` audit events. A failed eligibility,
integrity or insert condition leaves none of those records partially created.

Database uniqueness permits only:

- one acceptance for a quote;
- one booking for a quote;
- one booking for an acceptance;
- one copied booking line per quote item and sort position; and
- one customer-safe booking reference.

The application generates a non-sequential `BKG-` reference from 96 bits of
random data and retries only a bounded reference collision. A duplicate or
concurrent acceptance that has already completed returns the existing
authorized booking instead of creating another acceptance or booking.

## Immutable acceptance and commercial snapshots

`quote_acceptances` has no ordinary update path. It records the quote,
quote-version and request-version identities; customer/property relationship;
customer or staff-on-behalf actor evidence; acceptance time; commercial and
terms snapshots; exact price and duration snapshots; and a provenance snapshot.
Actor-profile foreign keys may become null as attribution metadata, but all
commercial and business-provenance foreign keys restrict deletion.

Issuance, not acceptance, constructs `quotes.acceptance_source_snapshot`
database-side. It freezes the exact issued quote and quote items; expected
post-issue request identity/version/preferences and raw reported-versus-
normalized item provenance; complete estimate input, price, duration,
availability, scalars and review flags; allowlisted customer/property
presentation with exact versions; and mutable travel-zone semantics. Customer
contact channels and CRM internal notes are not duplicated into this snapshot.
Acceptance rebuilds the same canonical object only to perform exact equality
under locks. It never uses that current reconstruction as booking content.
Before either issue or acceptance, the database verifies that price lines sum
to the stored subtotal, the minimum/VAT basis produces the stored totals,
duration lines sum to every stored component, and every applied/line rule is a
unique active member of the frozen configuration. The quote's source-estimate
digest must equal PostgreSQL 18's SHA-256 of the persisted canonical JSONB
price snapshot; a merely well-formed or stale digest is not accepted.

The Booking copies, rather than recalculates:

- currency, price basis, net, VAT and gross integer minor-unit amounts;
- the full source estimate price snapshot;
- quoted duration and its source estimate duration snapshot;
- frozen bilingual quote-item descriptions, quantities, measurements and
  calculation evidence;
- the customer-visible terms and notes;
- customer and property facts needed to explain the accepted commitment; and
- the request preference for date and appointment window.

Every accepted value above is extracted from the immutable issued source
snapshot. Customer/property presentation is therefore the issuance-time
presentation, not a silently refreshed acceptance-time view. Quote items are
also read from the frozen snapshot when booking items are inserted. Current
source rows are consulted only for locked exact-equality validation. A legacy
issued quote with no source snapshot, or any malformed/unequal snapshot, is
viewable history but is not acceptable; it returns staff review without a
write. Acceptance never backfills the missing evidence. Staff must use the
documented fresh-estimate/new-quote/reissue path.

`booking_items` and the acceptance record are append-oriented and have no
`updated_at` column. Future price-book, catalogue, duration, CRM or request
changes do not rewrite their historical values. The mutable Booking row uses a
monotonic optimistic version for controlled lifecycle changes, but that is not
permission to edit accepted commercial snapshots.

## Acceptance and scheduling decision

Every Phase 3E acceptance currently creates the Booking as:

- booking status `PENDING_SCHEDULING`; and
- scheduling status `REVIEW_REQUIRED`.

The scheduling snapshot records that no exact slot is confirmed and identifies
`OPERATIONAL_REQUIREMENTS_NOT_FROZEN` and
`SCHEDULING_CONFIGURATION_UNAPPROVED`. Phase 2B working hours, travel profiles,
teams and equipment remain provisional development configuration, while an
issued Phase 3D quote did not freeze a complete operational requirements set.
Phase 3E therefore cannot safely convert a preferred date/window into an exact
appointment.

Acceptance does not rerun availability and then pretend its result was quoted.
It also does not invent or silently refresh duration, equipment, travel or
other operational requirements from mutable records. The preferred date and
appointment-window code are retained as customer preference only;
`scheduled_start`, `scheduled_end`, assigned team and assigned equipment remain
null. No
`booking_occupancies` row is fabricated during acceptance.

Phase 3G provides the later authorized staff decision. It explicitly freezes
operational requirements from the immutable Booking/issued-Quote evidence and
uses current availability only after that review. The existing DRAFT working-
hour, travel, scheduling, zone, team and equipment assumptions stay visibly
provisional; selecting their exact versions for a development decision does not
approve them for production.

The persisted scheduling states remain `UNSCHEDULED`, `REVIEW_REQUIRED` and
`SCHEDULED`. A reschedule-required condition is derived from current readiness
rather than stored as another lifecycle state, and no proposed-slot state is
added because Phase 3G creates no hold. If operational input cannot be
reconciled with the frozen reviewed requirements, the Booking remains in staff
review rather than being renormalized or repaired automatically.

## Occupancy and concurrent overlap protection

`booking_occupancies` is the durable, append-oriented scheduling seam. One row
can preserve:

- one Booking and snapshot version;
- one operational team and optional equipment resource;
- exact service start/end and the wider operational start/end that includes
  travel and buffers;
- service duration, time zone, capability requirement and policy/profile
  identities; and
- immutable duration, location, requirements, availability, travel,
  working-hours and equipment evidence.

The adapter binds every blocking row to the requested Sofia date and one team,
queries operational-range overlap (including cross-day edges), verifies the
referenced working-hours/travel profile code and version, strictly decodes all
location/travel/policy evidence, and rejects impossible or unsafe interval
arithmetic. Cancelled, mixed-context, mismatched or malformed rows are never
interpreted as valid availability input.

The acceptance flow writes no occupancy. The Phase 3G scheduling command uses
PostgreSQL—not only the availability preview—as the final concurrent-writer
guard. Migration 0007 installs
`btree_gist` and adds two GiST exclusion constraints over half-open
`tstzrange(operational_start, operational_end, '[)')` intervals:

1. the same team cannot have overlapping `PENDING` or `CONFIRMED` occupancy;
2. the same non-null equipment resource cannot have overlapping `PENDING` or
   `CONFIRMED` occupancy.

Half-open ranges allow one operational interval to start exactly when another
ends. Separate teams and separate equipment resources may operate concurrently.
The database constraints reject conflicting concurrent inserts even when two
application workers observed the same earlier availability state.

## Cancellation and schedule revisions

Authorized staff cancellation requires CRM, operations and schedule-management
permissions plus the expected Booking version and a controlled reason. It
atomically marks the Booking `CANCELLED`, marks any blocking occupancy
`CANCELLED`, increments the Booking version and appends a
`BOOKING_CANCELLED` event. The overlap constraints consider only `PENDING` and
`CONFIRMED`; cancelled occupancy therefore releases team/equipment capacity
without deleting the historical row or its scheduling evidence. Repeated
cancellation is a safe no-change result.

Phase 3F adds a downstream integrity gate: ordinary Booking cancellation is
rejected while a non-cancelled Job exists. Staff must first cancel an eligible
pre-work `PREPARED` or `READY` Job through the explicit audited Job operation.
An arrived, started, review-required or completed Job cannot be erased or
silently unwound through Booking cancellation.

Phase 3G implements ordinary Booking confirmation, exact team/equipment
assignment and controlled rescheduling. Phase 3F's exact-occupancy Job binding
does not substitute for them. A reschedule must:

1. reauthorize the staff actor and revalidate current availability without
   repricing;
2. fail closed when frozen operational requirements or policy provenance is
   missing or inconsistent;
3. preserve the prior occupancy as history by cancelling its blocking state;
4. append its replacement through `previous_occupancy_id` in the same atomic
   operation;
5. rely on the same database overlap constraints;
6. reject silent replacement while a `READY` or later Job owns the exact
   occupancy; and
7. append allowlisted schedule, reschedule, team/equipment assignment, review
   and occupancy-release audit evidence atomically.

It must never rewrite the accepted quote, acceptance, booking items or price
snapshot. Exceptional post-readiness overrides and direct customer appointment
movement remain out of scope.

## Audit, access and privacy

`booking_audit_events` is separate from authentication security history and
from the Phase 3D request/quote business stream. Phase 3E records acceptance,
booking creation and cancellation; Phase 3G adds scheduling, rescheduling,
team/equipment assignment, review and occupancy release with an actor,
controlled source, correlation identifier and allowlisted safe metadata. It
stores no provider
subject, token, contact detail, address or free-form acceptance/cancellation
or reschedule note in audit metadata. Database-level append-only grants remain
a production gate.

Customer reads require `OWN_CUSTOMER_DATA_READ` plus the current exact identity
link and expose only the customer's own safe Booking projection. Staff reads
require CRM, operations and schedule read permissions. Staff-on-behalf
acceptance notes, internal notes, operational snapshots, actor identifiers and
other customers' records never enter the customer projection.

Booking data can contain appointment timing, full service address, access and
parking context, customer notes, cancellation history and operational
provenance. These are sensitive business/personal records. They must remain in
server-mediated, purpose-limited access; direct browser SQL/Data API access is
prohibited.

## Application surfaces

The linked-customer quote detail shows the controlled acceptance confirmation
only while the exact issued quote is eligible. The acknowledgement says that
the customer accepts the quoted commercial terms and requests scheduling; it
does not imply an exact appointment or payment. A completed/retried acceptance
links to the existing Booking.

`/app/my-bookings` and `/app/my-bookings/[bookingReference]` provide the
linked-customer list and detail projections. They show the safe reference,
accepted quote, services, property/address, fixed price and VAT, estimated
duration, preferred versus confirmed timing, status and customer-visible terms.
They expose no staff acceptance note, internal note, raw operational snapshot,
actor identifier or other customer's record.

Staff can record acceptance on behalf of the customer from the authorized
request/quote detail. `/app/bookings` provides bounded search/filter/pagination,
and `/app/bookings/[bookingReference]` shows acceptance evidence, immutable
commercial/item snapshots, scheduling review state, separate customer/internal
notes, audit timeline and the controlled cancellation action. Routes and Server
Actions repeat permission and record checks; hidden forms and references are
not authority. All surfaces use the application-profile Bulgarian or English
locale and provide explicit empty, review-required and error states.

Phase 3G adds `/app/schedule?date=YYYY-MM-DD` for the staff daily board and
queue, plus `/app/schedule/bookings/[bookingReference]?date=YYYY-MM-DD` for
candidate review, exact confirmation and controlled rescheduling. The
technician uses the separately row-scoped `/app/jobs/today`; the customer keeps
the existing own-Booking detail route, now with an explicitly Sofia-formatted
confirmed appointment. Staff dispatch, technician and customer projections
remain separate.

## Migration and environment gate

Migration `0007_phase_3e_booking_engine.sql` is additive. It creates only:

- `quote_acceptances`;
- `bookings`;
- `booking_items`;
- `booking_occupancies`; and
- `booking_audit_events`.

It also installs `btree_gist`, adds the two exclusion constraints and adds a
nullable issued-source snapshot column plus the composite quote/acceptance
provenance indexes required before their restrictive foreign keys. It contains
no backfill, data rewrite, destructive statement, payment, invoice, Job,
treatment, message or file table and never names provider-managed `neon_auth`.

The reviewed migration is authorized only for VAX Neon `development` →
`neondb`, behind the existing development label and exact host/database
interlocks. Neon production is untouched. Production migration,
least-privilege/RLS and append-only grants, backup/recovery, monitoring and
deployment require a later separately authorized gate.

The separate additive Phase 3F migration references these Booking structures
but does not rewrite migration 0007 or any acceptance, Booking, item, occupancy
or audit row. It is likewise authorized only for Neon development and leaves
production and provider-managed `neon_auth` untouched.

Migration `0009_phase_3g_scheduling_dispatch.sql` is also additive. It creates
no new business table; it
adds only `revision_kind`, `revision_reason_category` and `revision_note` with
controlled consistency/category/bounded-note checks and expands the allowlisted
Booking audit event vocabulary. Its SQL, checksum, Drizzle ledger, GiST
constraints and unchanged prior migration checksums must be verified on Neon
development. Static SQL inspection is supplemented by guarded direct
integration tests for same-team/equipment conflict, different-team concurrency,
cancelled release and no-partial-state failure. Production remains a separate
authorization gate.

The separate additive Phase 3H migration adds exact composite source keys that
allow Invoice/item provenance to reference this existing Booking graph, but it
does not rewrite migration 0007/0009 or any acceptance, Booking, item,
occupancy or Booking-audit row. The finance migration and any synthetic
integration fixture remain development-only; production is a separate gate.

## Remaining policy decisions

Before production scheduling, VAX still needs owner-approved:

- active working-hour, scheduling, travel, zone, team and equipment
  configuration;
- any future slot-hold/expiry policy, exceptional override rules and supported
  cross-midnight behavior;
- map-provider and fallback policy plus measured travel and buffer values;
- multi-team and equipment-quantity handling;
- customer reschedule-request and communication policy;
- cancellation notice, financial and retention policy (fees/refunds remain out
  of scope);
- production database roles, RLS, audit immutability and privacy retention;
- distributed mutation abuse controls, monitoring and recovery; and
- a separately reviewed production migration and deployment decision.
