# Job execution and Cleaning Passport

## Purpose and phase boundary

Phase 3F turns an eligible Phase 3E Booking into one durable field-service
Job. It records professional observations, the confirmed treatment decision,
the work actually performed, actual duration, completion, and an append-only
Cleaning Passport entry for a linked cleaning asset.

Phase 3G adds upstream exact scheduling, daily dispatch and a technician-today
view without changing Job scope authority or execution states. Scheduling
consumes the immutable Booking/issued-Quote chain and cannot reinterpret the
Job plan.

Phase 3H may use exact completed Job/item state as an Invoice eligibility gate,
but the Job is never commercial authority and cannot reprice or rewrite the
accepted Quote/Booking scope.

This phase does not add payments, invoices, fiscal documents, uploads,
messaging, automated notifications, route optimisation, payroll, inventory,
recurring-maintenance automation, offline synchronisation, production
migration, or deployment.

## Booking and Job authority

A Booking remains the commercial and scheduling commitment. A Job is its
execution record. Phase 3F uses a one-Booking-to-one-Job rule and a public
`JOB-…` reference; arbitrary standalone Jobs are not supported.

Job creation consumes only:

- the Booking and its immutable Booking items;
- the accepted Quote and Quote Acceptance provenance;
- the immutable issued-quote `acceptance_source_snapshot`; and
- the current confirmed Booking occupancy when the Booking is scheduled.

The immutable issued snapshot is the only authority for the original request
item, its customer-reported facts, staff-normalised facts, cleaning-asset link,
and quoted add-ons. Job creation does not read current request or estimate rows
as a fallback and never normalises, prices, recalculates, repairs, or refreshes
that historical scope. A malformed, incomplete, or inconsistent provenance
chain fails closed with no Job write.

Current CRM data is not allowed to change the frozen scope. A currently active
primary contact may be captured as a separate, purpose-limited visit-contact
snapshot. Current cleaning-asset ownership and status may be checked only to
prevent a stale or cross-property link; current asset attributes are not used
to reinterpret the issued scope.

## Preparation and scheduling

An exactly `CONFIRMED` and `SCHEDULED` Booking whose current confirmed
occupancy matches the Booking's time, team, and equipment can create a `READY`
Job. A provenance-valid but unscheduled or review-required Booking can create
only a `PREPARED` Job with explicit review reasons. It cannot be executed by a
technician.

The Phase 3F assignment operation may only bind a Job to the exact current
confirmed Booking occupancy. It does not reschedule a Booking or silently
substitute another team. Phase 3G implements ordinary Booking rescheduling as a
separate scheduling command, but it fails closed while a `READY` Job is bound
to the current occupancy rather than silently rebinding the Job. Jobs that have
entered field execution are never moved by the scheduling command.

Every subsequent executable mutation freshly re-proves that same occupancy
identity/version, Booking schedule, active team capabilities, and any active,
effectively assigned equipment. Operational revocation produces no requested
workflow write and returns the Job to staff review. A technician whose exact
team membership is absent or expired is denied without revealing another
team's Job.

`/app/jobs/today` applies the same repository scope to the current Sofia civil
date. It is not a broad dispatch view: a technician sees only assigned-team
Jobs and the time, customer/address/access and readiness facts needed for the
visit. Team workload, commercial details and another team's work remain hidden.

## Lifecycle

The controlled Job lifecycle is:

`PREPARED → READY → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED`

`REQUIRES_REVIEW` and pre-work `CANCELLED` are explicit terminal or staff-gated
outcomes for this phase. The application does not expose an arbitrary status
selector. Arrival, start, completion, review, and cancellation timestamps are
server-owned. Repeated identical actions are idempotent where safe; conflicting
or stale actions fail closed. Completion and cancellation retries compare their
stored payload as well as terminal state, so a different note, care instruction,
recommendation, or cancellation reason cannot be accepted as a no-change retry.

A Booking with an existing non-cancelled Job cannot be cancelled through the
ordinary Booking workflow. A pre-work Job must first be explicitly cancelled.
Neither a started nor a completed Job is erased or silently reopened.

## Team membership and technician access

`team_memberships` links an active application profile to an operations team
for a bounded validity window. It is an operational authorisation fact, not an
HR or payroll record, and no technician self-assignment flow is provided.

Every technician read and mutation is re-authorised at the database boundary.
It requires:

- an active application profile and active `TECHNICIAN` role;
- the current `FIELD_JOBS_READ` or `FIELD_JOBS_UPDATE` permission;
- an active, currently valid membership in the exact assigned team; and
- a Job whose assigned team still matches that membership.

Owner and administrator execution access still requires the applicable fresh
permissions. Assignment and cancellation require operations and scheduling
management permissions. Dispatcher access is operational and scheduling
focused; it does not imply technician execution authority.

Technician projections contain only visit-essential customer, address,
contact, access, schedule, item, inspection, treatment, and completion data.
They exclude prices, margin, Quote calculations, unrelated customers and
properties, CRM history, administrative notes, and user administration.

## Planned, observed, confirmed, and performed

Phase 3F keeps four facts separate:

1. **Planned** — copied from immutable Booking and issued-quote evidence.
2. **Observed** — the technician's confirmed on-site inspection.
3. **Confirmed treatment** — the professional decision after inspection.
4. **Performed** — the treatment and add-ons actually executed.

Inspection rows record observed item type, measurement, condition, material,
construction, issues, risks, existing damage, and feasibility. Observed issues
and risks use the Phase 2 canonical taxonomy and are never copied from
customer-reported CRM relations as if they were professional observations.

A different item type, larger or inconsistent scope, unsafe contamination,
specialist-only issue or material, unsafe structural state, or required
unquoted add-on cannot be silently executed or repriced. The item or Job moves
to `REQUIRES_REVIEW`, `DECLINED`, or `REFERRED` according to the recorded
evidence. Phase 3F does not create a replacement Quote.

Treatment plans use canonical treatment, mechanical-action, approach, add-on,
and optional verified-product references. The product remains nullable because
the canonical development catalogue has no approved product records. The
system does not invent product, manufacturer, medical, safety, or performance
claims.

## Completion and actual duration

Completion is an atomic operation. It locks the Job and its items, verifies the
expected version and current assignment, and requires every item to have:

- a confirmed inspection;
- a confirmed treatment and completed execution; or
- an explicit declined or referred outcome.

No unresolved review item may remain. Actual productive and occupied-team
minutes are derived from server timestamps and stored separately from the
immutable planned-duration snapshot. Completion persists an immutable
completion snapshot, appends audit events, and creates eligible Cleaning
Passport entries in the same transaction. Once completed, ordinary mutation is
blocked. A future correction must use an explicit amendment/history model.

Pure analytics helpers may compare planned minutes/team-hours with actual
minutes/team-hours. An immutable quoted-revenue aggregate may be supplied by a
future authorised analytics caller, but the Job module does not read or
recalculate commercial amounts.

## Finance eligibility relationship

An approved Invoice policy may use `BOOKING_ACCEPTED` or require
`JOB_COMPLETED` before draft and/or issue. Draft-level `JOB_COMPLETED` creates
no Invoice before exact completion. Booking-level draft plus Job-level issue may
create an immutable completion-waiting `DRAFT` whose sole reason is
`JOB_COMPLETION_REQUIRED`; later issue must reprove the complete source,
configuration and item graph without refreshing it. When completion is
required, Phase 3H verifies the exact Job linked to the Booking, its `COMPLETED`
state, complete item count and each Job item's quantity/planned-measurement
equality with the immutable Booking item. The finance module does not use
observed inspection, performed treatment, actual duration or current CRM as a
replacement price input.

Declined, referred, omitted, additional, changed-quantity or otherwise
materially different execution is not silently converted to a lower/higher
Invoice. It remains `FINANCE_REVIEW_REQUIRED` and receives no issued number
until an authorized future commercial/correction workflow resolves it. No
Invoice operation modifies the Job, completion snapshot, Cleaning Passport,
Booking or Quote. See `docs/FINANCE_AND_INVOICING.md`.

## Cleaning Passport

A Cleaning Passport entry is an append-only asset history record derived only
from a completed, actually performed treatment linked to a durable cleaning
asset. Its database provenance binds the asset history row to the exact
completed execution identity, Job/item scope, execution completion timestamp,
result, and performed treatment references. Inspection-only, declined,
referred, review-required, unperformed, stopped-for-safety, no-observable-
improvement, and asset-less items do not create a treatment entry. Uniqueness
on the Job item and execution prevents duplicate history during retries.

The immutable entry separates customer-safe completion and care information
from internal technician notes and operational audit metadata. Customer access
requires a current active identity link to the exact customer/property/asset.
Staff asset history requires customer-record and operations read permissions.
Neither view duplicates history into free-text CRM fields.

A maintenance recommendation is optional and advisory. It may record a review
date or interval, a reason, and its technician-assessment source. No universal
frequency, legal, manufacturer, health, or medical claim is inferred.

## Audit, concurrency, and integrity

`job_audit_events` records allowlisted lifecycle events with safe metadata.
Job, item, inspection, plan, and execution mutations use optimistic versions,
current-state predicates, fresh authorisation, and restrictive provenance
foreign keys. Job creation, treatment execution, completion, and passport
creation have database uniqueness or locking safeguards for retry and race
safety.

Business and history references use restrictive deletion. Actor-attribution
references may become null if a profile is later removed. Audit and passport
records are append-oriented and have no ordinary update path.

Production row-level security and least-privilege grants still require a
separate authorised review before deployment. Application checks are not a
substitute for that production database gate.

## Future operational work

Phase 3G supplies ordinary Booking scheduling and append-oriented occupancy
replacement without changing this execution model. Later phases may add
exceptional post-readiness overrides, split/multi-visit Jobs, amendments to
completed work, customer handover or signature policy, notifications, uploads,
offline/mobile synchronisation, route optimisation,
inventory/product-consumption details, recurring maintenance automation,
provider-verified payments, credit notes, refunds and accounting exports. Phase
3H provides only the controlled Invoice/manual-payment/allocation foundation;
none of those later integrations is implied by the Phase 3F–3H schema or UI.
