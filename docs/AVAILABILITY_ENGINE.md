# Availability, Travel and Team Capacity Engine

## Status and boundary

Phase 2B provides a provider-neutral scheduling-capacity foundation. It can
evaluate ephemeral work requests against development teams, equipment, working
hours, travel assumptions and in-memory occupancy. It does not create or hold a
customer reservation and is not a dispatch calendar.

Phase 3E adds a durable Booking occupancy schema and a database-backed overlap
boundary, but the acceptance flow does not create a slot or occupancy. Every
new Booking remains review-required because approved scheduling configuration
and a frozen operational-requirements contract are still absent.

All initial values are inactive, provisional development assumptions. They are
not owner-approved operating policy, legal working-hour guidance, real map
results or customer promises. The availability module's Neon persistence is
limited to reference and configuration records on the `development` branch;
Phase 3D request and quote transactions do not make those assumptions approved.

## Separation of concerns

The four calculations remain separate and composable:

1. **PRICE** returns exact money, provenance and commercial-review state.
2. **DURATION** returns the complete on-site service block and review state.
3. **TRAVEL** estimates movement between two typed locations through a
   replaceable provider contract.
4. **AVAILABILITY** combines the prior results with team capacity, operating
   policy and neighbouring work.

The pure availability module imports no Next.js, Drizzle or Neon code. Database
schema and seeds adapt the domain definitions to configuration tables.

## Service areas and locations

The canonical service-area labels remain:

- `SOFIA_CORE`
- `SOFIA_EXTENDED`
- `SOFIA_OUTSKIRTS`
- `OUTSIDE_SOFIA`

Each zone can represent localized name, activity, service eligibility, an
optional minimum-order override, optional base-travel semantics, manual
confirmation and future structured geographic metadata. Exact districts,
polygons, postcodes and coordinate boundaries remain owner-approved commercial
and operational data. The provisional labels do not assert authoritative Sofia
geography.

The ephemeral location contract supports city, district/neighbourhood, address
text, postal code, coordinate pair, access notes, parking notes and zone code.
Coordinates are optional, but latitude and longitude must be supplied together
and pass range validation. The engine itself creates no customer or property
record; Phase 3D may adapt an already authorized normalized request/property
into this ephemeral contract.

## Teams, capabilities and equipment

The development fixtures define `TEAM_A` and `TEAM_B`. Each team is active for
testing, has a default crew size of two, refers to the draft working-hours
policy and has standard residential, commercial-area and portable-extraction
capabilities. Neither team claims `SPECIALIST_ASSESSMENT` capability.

`CLEANING_MACHINE_A` and `CLEANING_MACHINE_B` are neutral portable-equipment
fixtures, one assigned to each team. They have no manufacturer, serial number
or performance specification. Equipment can be active, unavailable or in
maintenance; the engine requires a currently active resource with the requested
capability and a valid team assignment. Full maintenance history is deferred.

## Working hours and appointment windows

`SOFIA_TEAM_HOURS_V1_DRAFT` defines a provisional 06:00–22:00 local operating
window for every weekday in `Europe/Sofia`. Rules support enabled state and an
optional team override. The profile is versioned, inactive and not a legal
guarantee. Exceptions and future occupancy are inputs to the calculator rather
than persisted HR leave.

The draft request windows are:

| Code | Local request window |
| --- | --- |
| `EARLY_MORNING` | 06:00–09:00 |
| `MORNING` | 09:00–12:00 |
| `MIDDAY` | 12:00–15:00 |
| `AFTERNOON` | 15:00–18:00 |
| `EVENING` | 18:00–22:00 |

These constrain a requested arrival/start range. They do not guarantee an exact
arrival time. Exact candidate starts use the separate scheduling interval,
currently 30 minutes in `SOFIA_SCHEDULING_V1_DRAFT`.

In-memory scheduling blocks can represent jobs, meal breaks, maintenance,
training, private blocks, unavailability, holidays, sickness and operational
holds. Phase 2B deliberately persists none of them.

## Travel provider abstraction

`TravelTimeProvider` accepts origin, destination and a local departure time and
returns:

- estimated travel minutes;
- distance when known;
- confidence and source;
- whether a fallback was used;
- manual-assessment state;
- warnings and the applied rule identifier.

The synchronous `TravelTimeEstimator` keeps the pure slot engine deterministic.
An adapter exposes the same estimator through the asynchronous provider port.
A future map adapter can add geocoding, route distance and traffic-aware time
without changing capacity rules.

No live or paid mapping API is called. The draft matrix is:

| Origin/destination | Development minutes |
| --- | ---: |
| Same normalized core district | 15 |
| Core ↔ core | 20 |
| Core ↔ extended | 30 |
| Extended ↔ extended | 30 |
| Core ↔ outskirts | 40 |
| Extended ↔ outskirts | 45 |
| Outskirts ↔ outskirts | 45 |
| Any outside-Sofia leg | Manual review |

Every automatic value reports `distanceMetres: null`, development-assumption
confidence and `fallbackUsed: true`. These are conservative fixtures, not real
Google Maps, Mapbox or traffic results.

## Duration and buffer ownership

The Phase 2A duration total already contains:

> setup + inspection + base cleaning + condition/issue/add-on time + cleanup and handover

Phase 2B uses that total exactly once. It never adds setup, inspection, cleanup
or handover again.

The independent development transition buffer is 10 minutes per known
neighbouring job. It represents operational uncertainty such as parking,
loading, access, elevators, handover and traffic variability. It is distinct
from driving time:

- a previous job contributes one travel-before estimate and one buffer;
- a following job contributes one travel-after estimate and one buffer;
- both neighbours contribute two buffers, one for each transition; and
- no neighbour contributes no transition travel or transition buffer.

An explicit `parkingBufferMinutes` can reserve extra time before arrival when
the caller has configured it. Parking notes always produce a review warning.
No scheduling input creates or infers a parking charge.

For a candidate service start, the operational interval is:

> start − previous travel − previous transition buffer − explicit parking time
> through service end + following transition buffer + following travel

The complete interval must fit the working window and must not overlap any
existing block.

## Availability and slot generation

The job-capacity input composes price and duration results, location/service
area, date, preferred request window, capability and equipment requirements,
team count, parking time and manual-assessment state.

For each candidate team and start, the engine:

1. validates date, minute and policy boundaries;
2. checks team activity and requested capabilities;
3. checks an active assigned equipment resource for every equipment capability;
4. uses the Phase 2A confirmed duration, or its partial duration for review only;
5. finds the latest completed previous job and earliest later next job;
6. validates injected travel-provider results and converts malformed or failed
   estimates to manual review rather than accepting invalid time;
7. calculates each known travel transition and one buffer per adjacency;
8. builds the full operational interval;
9. checks working hours, request window and every occupancy block; and
10. returns disposition, feasibility, times, travel, buffers, reasons and warnings.

Candidate starts are deterministic 30-minute increments. A 60-minute request on
an empty 06:00–22:00 day can start at 06:00 and its latest automatic start is
21:00. Longer work consumes its actual duration and can block most or all of a
day; it is never rounded down to a nominal slot length.

`AVAILABLE` means the deterministic development rules find no blocker or review
condition. `REQUEST_REVIEW` means the interval may fit operationally but cannot
be offered automatically. `UNAVAILABLE` means a hard capacity condition fails.
`feasible` is true only for `AVAILABLE`; `operationallyFits` separately explains
whether a review-only candidate fits the known time and resource constraints.

Automatic booking is suppressed for, among other conditions:

- Phase 2A manual pricing or duration;
- decline/referral or uncertain service duration;
- outside-Sofia work;
- a service area requiring confirmation;
- parking uncertainty;
- work above the 360-minute development review threshold; and
- a two-team request.

Inactive teams, missing capability/equipment, overlapping work and work outside
the operating window are unavailable. A missing travel duration next to another
job remains unconfirmed rather than assuming zero travel.

## Utilisation and team-hour semantics

The pure utilisation helper reports working-window, unavailable, available,
scheduled service, scheduled travel, buffer, occupied and idle team minutes.
Overlapping non-working blocks are unioned so unavailable time is not counted
twice.

- service utilisation = service minutes / available team minutes;
- occupied utilisation = (service + travel + transition buffer) / available
  team minutes; and
- travel share = travel minutes / occupied team minutes.

Ratios are returned as integer basis points. They are operational metrics, not
payroll or accounting facts.

A **team-hour** is one dispatchable team occupied for one hour. A **labour-hour**
is one worker occupied for one hour. A two-person team occupied for two hours
uses two team-hours and four labour-hours. The helper exposes both explicitly.

Where an explainable price exists, another helper reports gross revenue per
occupied team-hour and estimated contribution per occupied team-hour. Phase 2B
seeds no payroll, consumable or travel-cost inputs and does not create a ledger.

## Phase 3D request integration

Phase 3D can evaluate availability only as a staff-only advisory preview after
request scope, location, service duration and capabilities are sufficiently
normalized. A manual-review or unavailable result cannot become a customer
promise. Public and customer request submission does not calculate or expose
slots.

Candidate-slot preview remains ephemeral: no candidate, hold, team assignment,
occupancy, reservation or booking row is written, and no slot preview is copied
into a Phase 3D quote. An estimate does retain a staff-only snapshot of the
service-area and scheduling-configuration readiness used for its review gate.
Quote issue therefore offers reviewed commercial scope, not a confirmed
appointment. See `docs/REQUEST_AND_QUOTE.md`.

## Phase 3E booking integration

Acceptance consumes the immutable issued quote without rerunning this engine,
renormalizing the request or refreshing its commercial/duration evidence. It
copies the preferred date and appointment window only as customer preference,
sets `PENDING_SCHEDULING` / `REVIEW_REQUIRED`, leaves exact times and team or
equipment assignment empty, and creates no occupancy. This is the required
fail-closed result while operational requirements and the draft Phase 2B
configuration are not approved and frozen.

`booking_occupancies` is now the durable adapter boundary for a later
authorized staff scheduling command. It stores one team, optional equipment,
service and wider operational instants, policy/profile versions and full
scheduling evidence. Only `PENDING` and `CONFIRMED` rows become Phase 2B
blocking work; cancelled or malformed rows are never interpreted as valid
availability input.

The database adapter is always scoped to one team and requested Sofia date. It
loads every operational interval overlapping that local day, verifies the
working-hours and travel-profile code/version against the referenced rows, and
strictly decodes date, team, intervals, policy versions, location and travel
evidence. Mixed-team/date batches, cross-day shapes unsupported by the
minute-of-day engine, unsafe arithmetic and inconsistent provenance fail closed
instead of disappearing from capacity input.

PostgreSQL exclusion constraints protect both team and equipment capacity over
half-open `[)` operational ranges. Adjacent ranges may touch, while concurrent
overlap for the same team or non-null equipment resource is rejected even when
application-side previews race. Cancellation retains the occupancy snapshot
but moves it outside the blocking predicate, releasing capacity. See
`docs/BOOKING_ENGINE.md`.

## Persisted configuration

The additive Phase 2B model extends `travel_zones` with service-eligibility and
operational metadata and adds:

- `working_hour_policies`, `working_hour_rules`;
- `operations_teams`, `team_capabilities`;
- `equipment_resources`, `team_equipment_assignments`;
- `appointment_window_definitions`;
- `travel_time_profiles`, `travel_time_matrix_rules`.

Versioned working-hour and travel profiles, their rules and appointment-window
definitions use insert-only seed behavior. Team and neutral equipment reference
state can be idempotently reconciled during development bootstrap. All Phase 2B
rows in this availability schema are configuration. Phase 3E owns the separate
Booking and occupancy records; it adds no general hold, reservation, invoice or
payment. Phase 3C customer/property and Phase 3D request/quote records remain in
their separate owning modules.

## Versioning and future snapshots

Travel, working-hour, appointment-window and scheduling definitions carry
stable code/version/lifecycle metadata or effective windows where applicable.
A change from 20 to 30 minutes creates a new profile version; it must not mutate
the assumptions behind accepted work.

The earlier `FutureSchedulingOccupancy` contract is now complemented by the
Phase 3E `booking_occupancies` persistence boundary. A durable scheduled record
must identify team, date/times, status, location, service duration, travel
metadata, equipment requirements and immutable versions of the scheduling,
working-hours and travel assumptions. The complete reviewed snapshot is
retained with Booking provenance rather than recalculated against current
configuration.

Database exclusion constraints now solve the same-team and same-equipment
overlap race for persisted blocking occupancy. The staff scheduling command,
holds, dispatch overrides and audited append-only schedule revisions remain
future work; application preview alone must never substitute for those
transactional boundaries.

## Internal availability lab

`/internal/availability-lab` is a browser-only, non-indexed development harness.
It provides deterministic scenarios A–F for residential carpet, upholstery,
extended-zone, large office, specialist and outside-Sofia behavior. Inputs can
vary date, measurement, condition, zone, request window, sample workload, team
count and parking time. Results show draft price/duration, travel assumptions,
both teams' candidate/review/rejected slots, neighbour effects and utilisation.

The route imports no database module, has no action or fetch, persists nothing,
is absent from public navigation and is blocked by the shared internal layout
outside the Next.js development server. No-index and robots controls remain
defense in depth, not authorization. Any future deployed internal tool requires
deliberate authenticated access rather than removal of this gate.

## Owner and future implementation decisions

Before activation or customer use, approve or measure:

- authoritative Sofia zone mapping and outside-area eligibility;
- real team structure, crew size, capabilities and equipment inventory;
- operating days, legal/contractual limits, breaks and exception policy;
- appointment-window wording and arrival promises;
- map/geocoder provider, credentials, data retention, traffic policy and
  fallback thresholds;
- field-observed travel and transition buffers;
- parking-time and commercial parking-cost policy;
- large-job and multi-team approval/dispatch rules;
- scheduling-policy activation, supersession and audit workflow;
- daylight-saving, same-day, cross-midnight and holiday behavior;
- hold expiry, scheduling idempotency and audited override rules beyond the
  implemented occupancy overlap constraints; and
- which internal assumptions, if any, may ever become public.
