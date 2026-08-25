# Quote Acceptance and Booking Engine

## Phase 3E decision and boundary

Phase 3E implements the first durable transition from reviewed commercial work
to an operational booking:

> immutable issued Quote → immutable Quote Acceptance → Booking → copied
> Booking Items → future Scheduling Occupancy

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

## Domain separation

| Record | Authority |
| --- | --- |
| `service_requests` and request items | What was reported and the separate staff-normalized interpretation |
| `request_estimates` | One append-only price/duration calculation and its source evidence |
| `quotes` and quote items | One reviewed commercial offer frozen when issued |
| `quote_acceptances` | Explicit agreement to exactly one immutable issued quote version |
| `bookings` and booking items | The durable operational commitment and copied commercial/service evidence |
| `booking_occupancies` | A versioned operational interval for one team and optional equipment resource |
| `booking_audit_events` | Append-oriented acceptance, booking and cancellation evidence |
| future Job | Field execution and treatment evidence; not a Booking and not implemented |

Booking creation does not change the accepted quote into a mutable order. The
quote remains `ISSUED`, and its request remains `QUOTED`. The unique acceptance
relationship is the authoritative evidence that the quote was accepted; VAX
does not add an `ACCEPTED` quote status or use the request status as a substitute
for acceptance.

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

## Current scheduling decision

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

Current availability can still be revalidated for a later authorized staff
scheduling decision, but that decision must preserve the accepted commercial
snapshots. If the operational input cannot be reconciled with frozen,
reviewed requirements, it must remain in staff review rather than being
renormalized or repaired automatically.

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

The current acceptance flow writes no occupancy. When a later authorized
scheduling command is implemented, PostgreSQL—not only the availability
preview—must be the final concurrent-writer guard. Migration 0007 installs
`btree_gist` and adds two GiST exclusion constraints over half-open
`tstzrange(operational_start, operational_end, '[)')` intervals:

1. the same team cannot have overlapping `PENDING` or `CONFIRMED` occupancy;
2. the same non-null equipment resource cannot have overlapping `PENDING` or
   `CONFIRMED` occupancy.

Half-open ranges allow one operational interval to start exactly when another
ends. Separate teams and separate equipment resources may operate concurrently.
The database constraints reject conflicting concurrent inserts even when two
application workers observed the same earlier availability state.

## Cancellation and future schedule revisions

Authorized staff cancellation requires CRM, operations and schedule-management
permissions plus the expected Booking version and a controlled reason. It
atomically marks the Booking `CANCELLED`, marks any blocking occupancy
`CANCELLED`, increments the Booking version and appends a
`BOOKING_CANCELLED` event. The overlap constraints consider only `PENDING` and
`CONFIRMED`; cancelled occupancy therefore releases team/equipment capacity
without deleting the historical row or its scheduling evidence. Repeated
cancellation is a safe no-change result.

Full scheduling, assignment, rescheduling and override operations are not
implemented. A future reschedule must:

1. reauthorize the staff actor and revalidate current availability without
   repricing;
2. fail closed when frozen operational requirements or policy provenance is
   missing or inconsistent;
3. preserve the prior occupancy row;
4. append a new snapshot version linked through `previous_occupancy_id`;
5. rely on the same database overlap constraints; and
6. append allowlisted `BOOKING_SCHEDULED`/`TEAM_ASSIGNED` or schedule-revision
   audit evidence atomically.

It must never rewrite the accepted quote, acceptance, booking items or price
snapshot.

## Audit, access and privacy

`booking_audit_events` is separate from authentication security history and
from the Phase 3D request/quote business stream. Phase 3E records acceptance,
booking creation and cancellation with an actor, controlled source,
correlation identifier and allowlisted safe metadata. It stores no provider
subject, token, contact detail, address or free-form acceptance/cancellation
note in audit metadata. Database-level append-only grants remain a production
gate.

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
`neondb`, behind the existing development label and exact-host interlocks.
Neon production is untouched. Production migration, least-privilege/RLS and
append-only grants, backup/recovery, monitoring and deployment require a later
separately authorized gate.

## Remaining policy decisions

Before confirmed scheduling or production, VAX still needs owner-approved:

- active working-hour, scheduling, travel, zone, team and equipment
  configuration;
- the frozen operational-requirements contract derived without changing
  customer-reported or staff-normalized provenance;
- slot-hold, expiry, override and same-day/cross-midnight/daylight-saving rules;
- map-provider and fallback policy plus measured travel and buffer values;
- multi-team and equipment-quantity handling;
- audited schedule/assignment/reschedule commands and customer communication;
- cancellation notice, financial and retention policy (fees/refunds remain out
  of scope);
- production database roles, RLS, audit immutability and privacy retention;
- distributed mutation abuse controls, monitoring and recovery; and
- a separately reviewed production migration and deployment decision.
