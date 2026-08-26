# Scheduling and Dispatch

## Purpose and authority

Phase 3G turns the Phase 2B availability calculator and the Phase 3E durable
Booking occupancy seam into an operational staff scheduling and dispatch
workflow. It preserves the Phase 3D–3F provenance chain:

> issued Quote snapshot → accepted Booking → reviewed operational requirements
> → exact schedule → immutable occupancy version → dispatch readiness → Job

Booking acceptance, schedule confirmation, dispatch readiness and Job execution
remain separate decisions. Scheduling never reprices a Booking, renormalizes a
request, repairs CRM data or refreshes accepted facts from current mutable
catalogue or configuration rows. If the immutable Booking/issued-Quote evidence
is incomplete or inconsistent, the Booking remains in staff review.

Phase 3G does not add payments, invoices, payroll, inventory accounting,
customer-controlled occupancy, temporary customer holds, automatic customer
notifications, paid routing, technician offline synchronization, production
migration or deployment.

## Scheduling lifecycle

The persisted Booking scheduling states remain deliberately small:

| State | Meaning |
| --- | --- |
| `UNSCHEDULED` | The Booking has no exact current appointment and is eligible for staff scheduling review. |
| `REVIEW_REQUIRED` | One or more provenance, configuration, capability, equipment, travel or customer conditions prevent confirmation. |
| `SCHEDULED` | The Booking has one exact current confirmed occupancy whose team, equipment and service times match the Booking. |

A reschedule-required condition is derived dispatch readiness, not another
persisted Booking state. `SLOT_PROPOSED` is not introduced because Phase 3G
does not create a hold or reservation workflow. Booking cancellation remains a
separate Booking lifecycle state and cancels any current blocking occupancy
without deleting its history.

An accepted Booking therefore follows:

> `PENDING_SCHEDULING` + `REVIEW_REQUIRED` → staff review → candidate preview
> → exact confirmation → `CONFIRMED` + `SCHEDULED`

No candidate preview is a customer promise or capacity reservation.

## Operational-requirements review

Phase 3E intentionally records
`OPERATIONAL_REQUIREMENTS_NOT_FROZEN` and
`SCHEDULING_CONFIGURATION_UNAPPROVED` on every new Booking. Phase 3G resolves
those conditions only through an explicit staff scheduling review. That review
may freeze:

- the immutable booked service duration;
- the exact service location copied into the Booking;
- the capability codes required by the accepted service scope;
- an equipment capability where the accepted scope requires it;
- the single-team requirement supported by the current operational model; and
- the exact scheduling, working-hour and travel policy versions used for the
  decision.

The review must derive operational requirements only from the intact Booking,
Booking items and issued-Quote acceptance snapshot. Current request
normalization, estimate recalculation, CRM repair and repricing are forbidden
inputs. A changed current catalogue mapping may identify a review condition,
but it cannot silently rewrite the accepted scope.

The existing development service zones, working hours, travel matrix, team
capacity and equipment assignments remain `DRAFT`, inactive or otherwise
provisional configuration. Staff may use an exact reviewed version for a
development scheduling decision only when the UI and stored snapshot keep its
provisional status, deterministic fallback and manual-review limitations
visible. This is not production approval.

## Eligibility and fail-closed review

A Booking may enter exact scheduling only when the server freshly proves that:

- it is not cancelled and its accepted issued-Quote provenance is intact;
- its Booking, item, duration, customer and property snapshots are present and
  internally consistent;
- the exact service location is valid for operational use;
- the staff-reviewed operational requirements are complete;
- exactly one team is required by the supported model;
- every required team capability is known;
- any required equipment capability is known;
- the selected scheduling, working-hour and travel versions can be identified;
  and
- no unresolved blocking review reason remains.

Multi-team work, outside-Sofia uncertainty, unsupported specialist scope,
unconfirmed access or parking conditions, malformed snapshots and unavailable
duration remain review-required. Large jobs may occupy several hours or a full
working day when they fit all reviewed constraints; they are not shortened to a
standard residential slot.

## Protected application surfaces

Scheduling administration is a protected staff operation. Owner, administrator
and dispatcher access requires active application identity plus the existing
schedule-management authority. A technician's schedule-read permission does
not authorize arbitrary Booking scheduling, team reassignment or cross-team
dispatch access.

The protected scheduling surface provides:

- a date-controlled daily dispatch board at
  `/app/schedule?date=YYYY-MM-DD`;
- an unscheduled and review-required queue;
- Booking-specific candidate inspection, exact confirmation and rescheduling at
  `/app/schedule/bookings/[bookingReference]?date=YYYY-MM-DD`;
- controlled rescheduling and cancellation/release context; and
- bilingual Bulgarian and English labels, warnings, empty states and errors.

Routes and Server Actions treat every Booking, occupancy, team, equipment, Job,
customer and property identifier as an untrusted selector. Page context is
authenticated before route or query parsing. Mutation context is authenticated,
authorized and rate-limited before form data is parsed. Repository queries then
repeat active-profile, permission and record-scope checks.

`confirmScheduleAction` is the single scheduling mutation transport. The
server decides from the locked current occupancy whether the command is an
initial schedule or a reschedule; the client cannot select an alternate
mutation path.

## Dispatch board and queue

The daily board is an operational list rather than a wide enterprise calendar.
It groups confirmed work by team and shows only the information needed to
dispatch safely:

- service start and expected end;
- booked service duration;
- travel and operational-buffer allowance;
- customer/property summary limited to the visit purpose;
- Booking or Job reference;
- equipment assignment or missing-equipment state;
- Booking/Job status and dispatch readiness; and
- preceding/next-job warnings.

The queue contains accepted Bookings that are unscheduled, review-required or
conflicted. Date navigation supports previous day, today, next day and a
validated date picker. On narrow screens, the board becomes a stacked day list;
it must not require a wide grid at 320, 375, 390 or 430 CSS pixels.

## Candidate generation and ranking

Candidate generation reuses the pure Phase 2B availability engine with a
scheduling-specific adapter for durable occupancy. It uses:

- immutable booked duration rather than a current duration recalculation;
- the staff-reviewed service location and requirements;
- current active teams, capabilities and equipment assignments;
- current blocking occupancy;
- the selected versioned working-hour policy;
- the selected versioned travel profile and provider abstraction;
- parking/access time where it has been reviewed; and
- the configured inter-job operational buffer exactly once per transition.

Feasible candidates are ranked deterministically in this order:

1. fit within the customer's preferred appointment window;
2. lower additional travel while retaining safe adjacent-job feasibility;
3. continuity with nearby work;
4. lower occupied workload when the higher-priority factors are equal; and
5. earliest feasible service start, followed by stable team identity as the
   final deterministic tie-breaker.

Workload balance never overrides travel safety or creates artificial equality.
Review candidates remain visibly distinct from confirmable candidates.

A preview is bound to the Booking version and the authoritative inputs used to
produce it. Confirmation rejects a stale preview and requires a fresh preview;
it never converts stale client data directly into an occupancy.

## Travel and buffer semantics

The scheduling model keeps these time components distinct:

| Component | Owner |
| --- | --- |
| Inspection, setup, treatment and cleanup | Immutable booked service duration |
| Travel before/after | Versioned travel-provider result or documented deterministic fallback |
| Inter-job buffer | Versioned scheduling policy, once for each adjacent transition |
| Parking/access allowance | Staff-reviewed location requirement; time only, never a fabricated fee |

Historical occupancy stores both service instants and the wider operational
interval plus the exact travel/buffer evidence used at confirmation. Candidate
evaluation must not feed a historical operational boundary back into the
engine as if it were a service boundary and then add the same historical
travel/buffer again. The durable adapter keeps historical service boundaries,
locations and component snapshots distinct so it can evaluate:

> previous service → current travel/buffer → candidate service → next
> travel/buffer → following service

Both preceding and following work are required inputs. A five-minute raw
appointment gap is not feasible when safe travel requires longer.

The provider interface remains replaceable. The deterministic development
matrix may be used only with a visible fallback/provisional label. An invalid
provider result, missing location or uncertain route fails to review; it never
becomes zero travel silently. Phase 3G does not purchase or configure a paid
routing provider and does not fabricate Sofia district, postal-code or polygon
boundaries.

## Sofia time and daylight saving

The operational time zone is `Europe/Sofia`. Stored schedule and audit times
are absolute instants; local date and time are presentation and scheduling
inputs. The server converts validated Sofia local time to an instant and
round-trips it before persistence.

- A nonexistent local time during the spring transition is rejected.
- An ambiguous local time during the autumn transition is rejected rather than
  guessed from a browser offset and remains a manual scheduling review.
- Candidate generation, daily queries and capacity aggregation use Sofia civil
  dates and do not assume every local day contains 24 hours.
- Customer and staff formatting names `Europe/Sofia` explicitly rather than
  inheriting the deployment host's time zone.

Focused tests cover both Sofia clock transitions.

## Exact confirmation and durable occupancy

The browser may submit only an allowlisted Booking reference, Booking version,
candidate identity, work date, expected prior occupancy version and controlled
reason where required. Team, equipment and exact times come from the selected
server-generated candidate. The browser does not supply authoritative duration,
expected end, operational interval, timestamps, policy snapshots or audit
metadata.

At confirmation the server recomputes the exact service end and operational
interval. One atomic database operation:

1. locks the Booking and its current blocking occupancy;
2. verifies optimistic Booking version and candidate freshness;
3. revalidates immutable provenance and staff-reviewed requirements;
4. revalidates current team state and every capability;
5. revalidates equipment state, capability and team assignment;
6. reloads the exact working-hour, scheduling and travel versions;
7. reloads adjacent blocking occupancy and recomputes travel feasibility;
8. inserts the new immutable occupancy version;
9. updates the Booking to the matching exact schedule; and
10. appends allowlisted audit evidence.

PostgreSQL GiST exclusion constraints over half-open `[)` operational ranges
remain the final race-safe guard for the same team and the same non-null
equipment resource. Database conflict details are translated to a generic
scheduling conflict and never exposed to the browser.

## History, rescheduling and cancellation

`booking_occupancies` remains the single append-oriented schedule history; no
duplicate calendar or schedule-revision table is introduced. Each new version
links to the prior occupancy. Historical rows and their policy, travel,
requirements and interval snapshots are never mutated into current meaning.

Controlled rescheduling accepts one of:

- `CUSTOMER_REQUEST`;
- `OPERATIONAL`;
- `TEAM_UNAVAILABLE`;
- `EQUIPMENT_UNAVAILABLE`;
- `TRAVEL_CONFLICT`; or
- `OTHER`.

Any optional note is length-bounded, sanitized and excluded from broadly safe
audit metadata. Rescheduling repeats full confirmation checks, cancels the old
blocking occupancy, appends the replacement and records old-to-new evidence in
one atomic operation. The commercial Booking and price remain unchanged.

A Job in `READY` state is not silently rebound to a replacement occupancy.
That reschedule fails closed for explicit staff Job review. Jobs already en
route, arrived, in progress or completed are never rescheduled through this
command.

Booking cancellation preserves the existing rule that an active Job must be
cancelled through its controlled pre-work policy first. A successful Booking
cancellation releases the blocking occupancy by changing its state rather than
deleting it and appends both cancellation and occupancy-release evidence where
applicable.

The Booking audit vocabulary includes initial scheduling, rescheduling, team
assignment, equipment assignment, schedule-review, cancellation and occupancy
release events. Metadata is allowlisted and contains stable operational codes,
versions and safe references rather than customer free text or provider data.

## Dispatch readiness and Job integration

Dispatch readiness is computed from current evidence and may return:

- `READY`;
- `MISSING_TEAM`;
- `MISSING_EQUIPMENT`;
- `SCHEDULE_CONFLICT`;
- `TRAVEL_REVIEW`;
- `CAPABILITY_REVIEW`;
- `CUSTOMER_REVIEW`.

A derived reschedule-required condition is not another readiness code or
persisted Booking state. It is represented by the applicable explicit review
code above and a staff action when the current schedule can no longer be
treated as executable.

An exact current `CONFIRMED` occupancy matching the Booking's team, equipment
and service instants is the only schedule provenance that can make a Phase 3F
Job `READY`. Scheduling does not auto-start a Job. Existing idempotent Job
creation may produce `PREPARED` only when exact readiness is not satisfied.

Assigning an operational team resource does not grant a user team membership,
role or permission.

## Technician and customer views

The technician today view reuses Phase 3F row-level authorization. A technician
uses `/app/jobs/today` and sees only Jobs assigned to a team for which the
technician has an active, time-valid membership. The view may show the visit
time, required customer name, service address, access notes, Job
readiness/status and execution scope. It does not grant cross-team,
unrestricted CRM, commercial or scheduling-management access.

A linked customer may use the existing
`/app/my-bookings/[bookingReference]` route to read only that customer's Booking
and confirmed service date/time, preferred window, estimated booked duration
and Booking status. The customer view excludes internal travel estimates,
capacity, team workload, equipment, other customers and staff-only warnings. A
customer cannot move or cancel occupancy by submitting a schedule mutation. A
future reschedule-request signal may be added separately; it is not direct
schedule authority.

## Capacity analytics

Phase 3G analytics are read-only operational projections. For each team and
Sofia civil date they can report:

- working-window and unavailable minutes;
- available team minutes;
- scheduled service, travel and buffer minutes;
- occupied and remaining/idle team minutes;
- productive and occupied utilisation;
- travel share;
- jobs per day; and
- gross booked revenue per occupied team-hour where immutable Booking totals
  are available.

One team occupied for two hours is two team-hours. With a crew of two it is four
labour-hours. These values are never combined. Revenue productivity is not
accounting, margin recognition or repricing and must not use mutable current
prices.

## Accessibility and localization

The scheduling UI follows the protected application's established accessible
form and feedback primitives:

- every date, time, team, equipment, reason and note input has a label;
- field errors are programmatically associated;
- mutation status is announced and each distinct error can receive focus;
- ordinary rerenders do not create focus loops;
- confirmation dialogs are labelled, keyboard operable and restore focus;
- board information has a usable list alternative; and
- loading, empty, review, conflict and failure states are explicit.

Bulgarian and English presentation follows the validated application profile
locale. Stable status, reason and audit codes remain untranslated internally.

## Migration and development verification

Phase 3G reuses existing business tables. Migration
`0009_phase_3g_scheduling_dispatch.sql` adds only
`revision_kind`, `revision_reason_category` and `revision_note` to
`booking_occupancies`, with controlled initial/reschedule consistency, the six
reason categories above, a trimmed 1–500 character note when present, and a
required note for `OTHER`. It broadens the Booking audit allowlist to include
`BOOKING_RESCHEDULED`, `EQUIPMENT_ASSIGNED`, `SCHEDULE_REVIEW_REQUIRED` and
`OCCUPANCY_RELEASED` alongside the existing events. It must not create a second
calendar, rewrite historical Booking/occupancy data, touch Neon Auth, remove
constraints or alter commercial provenance.

Migration validation is authorized only for Neon VAX `development` / `neondb`
after the explicit development label and exact-host interlock succeed. Review
generated SQL, indexes, checks and GiST constraints first; apply the committed
migration; then verify its checksum, Drizzle ledger entry, expected schema and
unchanged prior migration checksums. Production remains untouched.

Static migration inspection is not evidence that PostgreSQL exclusion
constraints work at runtime. A guarded, serialized development integration run
must use deterministic synthetic fixtures and prove:

- overlapping occupancy for the same team is rejected;
- overlapping occupancy for the same equipment is rejected;
- different teams may operate concurrently;
- cancelled/released occupancy no longer blocks capacity; and
- a rejected conflict leaves Booking, occupancy and audit state unchanged.

Fixtures and any safely supported synthetic identities must be removed after
verification. Credential-free CI continues to run without a live database.

## Validation matrix

Phase 3G verification covers:

- eligible, cancelled and provenance-incomplete Bookings;
- preferred-window and working-hour boundaries, long jobs, required
  capabilities/equipment and multi-team review;
- preceding and following travel, impossible gaps, deterministic fallback and
  buffer ownership;
- initial schedule, controlled reschedule, cancellation release, immutable
  prior snapshots and allowlisted audit events;
- two dispatchers targeting one Booking, conflicting Bookings, stale preview
  and reschedule/cancel races;
- Owner/Admin/Dispatcher access, customer scheduling denial, technician
  reassignment denial and cross-customer/cross-team IDOR resistance;
- own customer appointment visibility and unrelated appointment denial;
- Sofia spring and autumn clock transitions;
- Bulgarian/English labels, keyboard controls, time/date labels, repeated-error
  focus, confirmation dialog, list alternatives and responsive layouts at 320,
  375, 390, 430, 768 and at least 1024 CSS pixels; and
- CRM, request, estimate, quote, Booking, Job, Cleaning Passport, RBAC, CSRF and
  database-security regression suites.

An authenticated browser rehearsal may create dispatcher, technician or
customer identities only when provider-supported cleanup is proven first. If
safe cleanup is unavailable, no identity is created and the limitation is
reported instead of weakening the cleanup requirement.

## Security and production gates

Phase 3G retains server-mediated database access and does not enable the
browser Data API. Production still requires separately authorized migration
and deployment plus reviewed least-privilege grants/RLS, trusted origins,
custom SMTP, shared rate limiting, monitoring and recovery, live authentication
flow validation, provider beta review, calibrated operational data, a routing-
provider decision if needed, and the repository's framework-security release
gate.

No DRAFT configuration, deterministic travel fallback, synthetic fixture or
development result becomes approved operational knowledge automatically.

## Remaining operational decisions

Before production scheduling, the owner must approve:

- real Sofia service-zone boundaries;
- working-hour and exception policy;
- travel calibration and provider/fallback tolerances;
- parking/access review rules;
- team capacity, memberships and equipment assignments;
- capability ownership and large-job escalation rules;
- customer reschedule-request and notification policy;
- dispatch incident and override procedures; and
- production database, observability, recovery and deployment controls.
