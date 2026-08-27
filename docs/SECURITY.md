# Security

## Security posture through Phase 3J

The repository now has a development authentication, session and RBAC boundary,
but it does not claim production security readiness. Production-grade shared
rate limiting, email delivery, trusted origins, monitoring, recovery and
production data governance remain gated. The finance foundation adds no claim
of legal, fiscal, tax, accounting or payment-provider security readiness. The
communications foundation publishes locally only and makes no external-
delivery, customer-read or messaging-provider claim.

## Framework security baseline

Phase 3J upgrades `next`, `@next/env` and `eslint-config-next` together from
16.3.2 to the patched 16.3.3 Active LTS release. Next.js identifies the prior
16.3.2 baseline as affected by two critical August 2026 vulnerabilities. The
synchronized upgrade, locked clean install, full validation and exact-snapshot
security review close the scheduled framework-update gate; they do not
authorize deployment.

Reference: [August 2026 Security Release](https://nextjs.org/blog/august-2026-security-release)

Deployment remains blocked on the independent operational, provider, database
least-privilege, recovery and explicit authorization gates below. Future
framework advisories must be assessed before any later release.

## Secrets and environment configuration

- Runtime secret-bearing variables include `DATABASE_URL` and
  `NEON_AUTH_COOKIE_SECRET`; Auth endpoint and bootstrap subject configuration
  must also remain server-only.
- Read it from the environment through the validated server-side boundary.
- Never hard-code, log, return, test-fixture, or commit a real connection value.
- Never commit .env, .env.local, credentials, tokens, keys, or certificates.
- Keep .env.example limited to variable names and empty values.
- Use separate credentials and databases per environment.
- Local development must use the VAX Neon `development` branch, never the
  production branch.
- Database mutation commands require an explicit `development` acknowledgement
  plus the exact expected development database hostname and database name in
  addition to `DATABASE_URL`; those non-secret controls must never contain
  credentials.
- Future staging and production environments must inject DATABASE_URL through
  their deployment platform rather than use a committed environment file.
- GitHub Actions must validate without a live database credential and must not
  apply migrations.
- Rotate credentials if exposure is suspected; do not merely delete a committed
  secret.

Client components and browser bundles must never import server environment or
database modules.

## Codex development boundary

- Normal implementation work occurs on a focused feature branch in a local
  disposable worktree, never directly on protected `main`.
- `.worktreeinclude` contains only the ignored `.env.local` path. It may copy
  that file into local Codex-managed worktrees but never exposes or tracks its
  value. Do not use it for cloud or remote worktrees.
- The Neon management integration is for authorized administration and schema
  inspection; it is not the application's runtime connection.
- Codex must never force-push, bypass failed validation or CI, deploy, or modify
  production resources without explicit authorization.
- Remove completed local worktrees so ignored credentials and build artifacts
  do not persist in unnecessary checkouts.

## Database access

- PostgreSQL is accessed through the isolated src/db adapter.
- Use least-privilege application and migration roles when environments are
  provisioned.
- Use parameterized Drizzle queries; never concatenate untrusted SQL.
- Make schema changes through explicit, reviewable migrations.
- Do not run destructive migrations or access production data without explicit
  instruction and an impact review.
- Back up and rehearse recovery before destructive production changes.
- Do not store binary files or photos in PostgreSQL.

Application migrations are applied only to the VAX Neon `development` branch.
The Phase 3A migration creates additive public-schema identity/RBAC tables and
must never target production or directly change provider-managed `neon_auth`.
Phase 3E migration 0007 is likewise additive and development-only; it creates
only application-owned acceptance, Booking, item, occupancy and Booking-audit
tables plus the required `btree_gist` extension and overlap constraints. It
never names `neon_auth`, creates no payment/invoice/Job table and is not
authorized for production.
The separate additive Phase 3F migration creates only application-owned team-
membership, Job/item, inspection, treatment, Cleaning Passport and Job-audit
structures. It does not rewrite migrations 0001–0007, contains no commercial,
payment, invoice or Auth-managed table, and is authorized only for Neon
development. Production remains untouched.

Migration `0009_phase_3g_scheduling_dispatch.sql` creates no new business
table. It adds only
`revision_kind`, `revision_reason_category` and `revision_note` with controlled
consistency/category/bounded-note checks and broadens allowlisted Booking audit
event types. It must preserve migration 0007's partial uniqueness and GiST
overlap constraints, never rewrite prior Booking/occupancy data or name
`neon_auth`, and may be applied only to Neon development after SQL/checksum
review.

The additive `0010_phase_3h_finance_invoicing.sql` migration creates only
application-owned customer billing, seller/configuration, Invoice/item,
Payment, allocation, reversal and finance-audit structures plus the exact
provenance indexes and database
integrity functions they require. It seeds no legal seller, VAT, bank, billing,
invoice policy or numbering value, never names `neon_auth`, and is authorized
only for Neon development after SQL/checksum review. Production remains
unmigrated and separately gated.

The additive `0011_phase_3i_communications_documents.sql` migration creates
only application-owned template, preference, intent, immutable document, local
delivery, customer-history and communication-audit structures plus supporting
same-customer indexes and integrity guards. It rewrites no prior migration,
never names `neon_auth`, stores no binary PDF/provider credential and is
authorized only for Neon development after SQL/checksum review. Production
remains untouched and separately gated.

The current migration and owner-bootstrap commands refuse production mode,
non-development mutation labels, unexpected database hostnames and unexpected
database names, and alternate target/identity query parameters before opening a
database client. Normal Neon TLS parameters remain supported. Applying any
migration to production requires a separately designed command and explicit
authorization.

Phase 3J deliberately adds no RLS or grant migration. The current development
connection owns the application tables, table owners bypass ordinary RLS, and
the server-mediated adapter does not yet establish a transaction-local database
actor. A permissive policy would create false assurance, while deny-by-default
policies would break the application. Production therefore still requires
externally provisioned, distinct non-owner runtime and migration roles, reviewed
grants/default privileges and a real RLS design before any browser Data API use.

## Health endpoint

GET /api/health exposes only bounded status values:

- status: ok or degraded
- database: connected or unavailable

It returns HTTP 503 when configuration or connectivity fails and sets
Cache-Control to no-store. It does not return stack traces, hostnames,
usernames, passwords, connection values, driver errors, or raw exceptions.

Future public deployment work must decide whether this endpoint remains public,
is split into liveness and readiness endpoints, or receives network controls.

## Trust boundaries

Validate and normalize all data entering through:

- HTTP requests and form submissions;
- environment variables;
- authentication callbacks and sessions;
- payment, email, SMS, or storage webhooks;
- imported files and external APIs;
- object metadata and upload declarations; and
- admin and technician actions.

Validation does not replace authorization. Every protected use case must verify
actor, action, resource ownership, and relevant organization scope on the
server.

## Phase 1 historical request prototype and current public intake

Phase 1's public request form was a frontend-only prototype with no action or
persistence. Phase 3D replaces that historical boundary with a Server Action
that revalidates allowlisted fields, applies bounded anonymous-intake abuse
controls and calls the application-owned request use case. It stores a request
for staff review and returns only a random customer-safe reference. It still
uploads no file and creates no public price, quote, appointment, booking or
payment.

Anonymous contact details never authenticate a caller, infer an existing CRM
customer or create an Auth/profile/role/link record. Original validated facts
are preserved separately from staff normalization. Contact details, addresses
and notes stay out of URLs, logs and safe audit metadata. Local rate limiting is
not production-distributed; final retention, consent/notice, duplicate handling,
monitoring and recovery remain deployment gates.

Public hygiene, stain, acoustic, timing and product-performance claims are also
a trust boundary. `src/content/public-site/claims.ts` classifies important
claims as `verified`, `qualified`, `manufacturer_evidence_required`,
`legal_verification_required` or `prohibited`, with tests over publishable
Bulgarian and English content. `docs/CONTENT_AUTHORITY.md` records the approved
publication boundary and evidence needed for any stronger statement. Content
review remains required; a passing pattern test is not evidence for a marketing
claim.

The language selector uses deterministic public URLs and stores no locale
preference. Both locale versions expose the same persistent-review boundary;
the Client Component imports no server environment or database code and reaches
persistence only through the localized Server Action.

## Phase 2 catalogue safeguards

Phase 2 adds only canonical reference and capability data. The seeder contains
no customers, bookings, prices, credentials or actual cleaning-product rows.
Issue handling distinguishes assessment, specialist and decline/referral
boundaries; it does not claim medical or biohazard capability. Antibacterial,
allergen, manufacturer and product-origin capabilities remain evidence-gated
and are not seeded.

Only the Neon `development` branch may receive the reviewed Phase 2 migration.
The migration must remain additive, must not touch `neon_auth`, and must be
followed by a schema and row-count inspection. Production remains outside this
authorization.

## Phase 2A commercial safeguards

Phase 2A commercial rows are development-only, inactive drafts and explicitly
not approved for publication. Prices use exact integer minor units and tax
rates use basis points. Version-owned price books and rules are seeded with
insert-only conflict handling so reruns do not silently rewrite history.

The pure calculation engine validates quantities, measurement boundaries, VAT
configuration and manual-assessment conditions. Biological contamination is
decline/referral-only; no antibacterial, allergen, sanitisation or medical
capability is created. Unknown or unsupported scope suppresses the final price
and/or duration rather than fabricating an answer.

The `/internal/pricing-lab` route contains bundled provisional values for local
testing. It is not linked publicly, is absent from the sitemap, is disallowed
by robots rules and emits no-index/no-follow metadata. The shared internal
layout also returns not-found outside the Next.js development server. Those
controls do not provide authenticated internal access; any future deployed lab
needs an explicit authorization design, and draft books must never be selected
by a customer-facing use case.

Only the reviewed additive migration and commercial seed may run against Neon
`development`. Production and `neon_auth` remain outside Phase 2A authority.

## Phase 2B availability safeguards

Phase 2B persists only team/equipment, working-window, appointment-window,
service-area and travel configuration. It creates no customer, property,
request, occupancy, reservation, booking, employee-account or payment record.
All sample jobs and breaks are ephemeral development fixtures.

The pure engine validates dates, minutes, coordinate pairs, team capability,
equipment state, complete working-window fit and occupancy overlap. It never
assumes zero time for an unconfirmed neighbouring route. Malformed or failed
injected travel estimates fail closed to manual review. Phase 2A manual or
decline/referral results, outside-Sofia work, inactive/unapproved zones,
parking uncertainty, large jobs and two-team requests cannot become automatic
slots.

`/internal/availability-lab` bundles internal team codes, draft price/duration,
travel and utilisation values. Like the pricing lab it has no mutation or
database access, is absent from public navigation and emits no-index/no-follow.
The shared server layout makes both labs development-only by returning not-found
from production builds. This is not a substitute for authentication if an
internal tool is deliberately deployed later, and no customer-facing calendar
is present.

Only the reviewed additive Phase 2B migration and deterministic seed may run on
Neon `development`. Production and Neon Auth-managed schemas remain outside the
phase authorization. No map credential or live provider is introduced.

## Phase 3A identity and authorization

- Neon Auth owns passwords, verification, reset tokens and provider sessions;
  application code never manipulates its schema.
- Application profiles and RBAC are separate public-schema records linked by a
  unique opaque provider subject.
- Signed HttpOnly cookies, `SameSite=Strict`, fixed redirects and server-side
  session checks are used; session credentials never enter localStorage.
- Provider calls remain server-only. No public catch-all, raw sign-in/signup or
  provider-token route is mounted by VAX.
- Every protected operation must re-authorize server-side. Proxy and hidden
  navigation are defense in depth only.
- `SUSPENDED`, `DISABLED`, no-role and missing-permission states deny access.
- Self-registration is fixed to `CUSTOMER`; owner bootstrap is explicit,
  provider-subject-based, idempotent and disabled after ownership exists.
- Login and recovery errors avoid account-existence disclosure and provider
  detail leakage. Passwords, OTPs, reset/session tokens and raw provider errors
  are neither logged nor stored by VAX.
- Production email verification is mandatory in application policy; a false
  environment override is honored only outside production.
- Local auth attempt limiting is process-local. Production auth fails closed
  until a distributed/provider-backed limiter is selected.
- Auth and `/app` routes are private/no-store and noindex, with deny framing,
  MIME-sniffing, referrer and browser-permission headers.
- The enabled development Data API is not an application/browser integration.
  Because application tables do not yet have reviewed RLS, browser token access
  is prohibited until least-privilege grants and row-level policies are designed
  and verified.

Detailed roles, sessions, audit events and remaining production blockers are in
`docs/IDENTITY_AND_ACCESS.md`.

## Phase 3B privileged administration safeguards

- `/app/admin/users` and application-UUID detail routes require
  `USER_ADMIN_READ` in a nested server layout. Every Server Action separately
  requires `USER_ADMIN_MANAGE`; role actions also require `ROLE_ASSIGN` in the
  provider-neutral service and database recheck.
- Role/status inputs are allowlisted. `ADMIN` can manage only unprivileged
  targets and only `DISPATCHER`, `TECHNICIAN` and `CUSTOMER`; client-submitted
  roles never grant authority.
- Self role/status changes are blocked. `OWNER`/`ADMIN` changes and `DISABLED`
  fail closed without provider-attested recent authentication.
- A shared PostgreSQL transaction advisory lock and database-side active-owner
  count protect the last active owner from concurrent revocation, suspension or
  disablement. The transaction explicitly selects `READ COMMITTED`, acquires
  the lock before reading state, then uses a fresh snapshot for actor, target
  and owner checks while keeping mutation and sanitized audit insertion atomic.
- Status is application-owned and re-read at each protected boundary, so a
  suspended/disabled profile is denied even while a provider cookie exists.
- Provider user listing uses only the supported server Admin API and projects
  email, verification state and creation time. Provider subjects and provider
  roles do not cross its safe DTO. The UI does not call this capability until
  provider-admin authority is deliberately configured and reviewed.
- Session listing/revocation stays unavailable because its pinned contract,
  recent-authentication proof and signed-cache invalidation have not been
  validated. There is no direct `neon_auth` SQL fallback.
- Privileged actions use explicit modal confirmation, pending-state protection,
  focus return and per-response error-alert focus. Next.js Server Action origin
  checks and `SameSite=Strict` remain the CSRF boundary for this email/password
  flow.
- Development uses bounded in-process privileged-mutation limiting. Production
  remains fail-closed until a shared limiter is configured.
- The focused review found no browser database access, provider-table write,
  role injection, client-only enforcement, raw provider error or sensitive
  audit payload. Runtime least-privilege grants, RLS/Data API policy and audit
  immutability remain explicit deployment gates.

## Phase 3C CRM and record-ownership safeguards

- Authentication identity, application profile and CRM customer remain
  separate records. Only an active application-owned identity/customer link can
  establish customer self-service scope; matching email is never authority.
- Staff pages require the existing CRM read/manage permissions. Identity-link
  administration additionally requires user-administration manage permission.
  Dispatcher can operate CRM records but cannot grant customer identity access;
  Technician has no unrestricted CRM access.
- Every read and mutation reauthorizes the current application actor and derives
  the owning customer through the database relationship. Customer, property,
  area, asset and hidden form identifiers are untrusted. Missing and forbidden
  records have the same external outcome.
- Self-service uses a linked-only repository surface and accepts no
  client-selected customer scope. Customer DTOs exclude staff-only summaries,
  access/parking notes, operational notes, actor metadata and link-management
  information.
- Zod allowlists mutable fields; foreign and canonical references are checked
  server-side. Optimistic record versions prevent silent stale overwrites.
- Ownership and canonical foreign keys restrict deletion. Normal lifecycle
  changes archive or deactivate records, and revoking an identity link cannot
  cascade into customer/property/asset loss.
- At the Phase 3C gate the public request form remained client-only; Phase 3D
  replaces that historical boundary without making CRM creation public.
- Direct browser SQL/Data API access remains prohibited. Application record
  policy is server-mediated; production least-privilege grants and fully
  reviewed RLS are still mandatory deployment gates, not partially implemented
  controls.
- Addresses, coordinates and operational notes are treated as sensitive. Free
  text must not contain credentials or payment/identity secrets. Retention,
  export, erasure, merge and data-subject workflows remain unresolved and are
  documented in `docs/CRM_AND_PRIVACY.md`.

## Phase 3D request, estimate and quote safeguards

- Public intake revalidates strict field and collection limits on the server,
  uses an address-scoped local limiter plus a honeypot, returns a generic safe
  result and never reveals CRM matches. Production requires a shared abuse
  control, monitoring and approved retention/notices.
- Request references and quote references use non-sequential random values.
  They are selectors, not bearer credentials; every protected read repeats
  actor, permission and ownership checks.
- Staff reads require both `CUSTOMER_RECORDS_READ` and `OPERATIONS_READ`;
  mutations require both corresponding manage permissions. Customer submission
  requires `OWN_CUSTOMER_DATA_UPDATE`; own-request/issued-quote reads require
  `OWN_CUSTOMER_DATA_READ`. Customer operations also require the exact current
  active identity/customer link and authorized CRM graph.
- Contact email/phone and `requesting_profile_id` are provenance only. They
  never infer a customer, authorize access or create an Auth identity/profile.
- The immutable original submission is separate from staff normalization.
  It preserves exact authenticated property/asset selections, while distinct
  reported and normalized condition/material/construction fields prevent staff
  interpretation from rewriting source facts. Zod allowlists normalized values
  and the database rechecks active catalogue, customer, property and asset
  relationships. Issues and add-ons are relational rather than uncontrolled
  identifier arrays. Repeated normalization uses disjoint retained/omitted sets
  so staff-only associations are not deleted and updated in the same statement,
  while customer-origin provenance rows are never removed.
- Estimates are append-only versions with complete price and duration input and
  result snapshots. Provisional, incomplete, specialist and unsupported inputs
  fail closed to staff review; no internal calculation is shown as an automatic
  public price. Estimate append and every quote draft/issue boundary lock and
  rederive the current CRM customer segment and canonical travel zone, then
  compare those values with the immutable estimate input snapshot. Stale,
  missing, inactive, null or unsupported commercial context fails closed.
- Quote drafts are staff-only. Issue freezes customer-visible lines, totals,
  terms, validity and estimate provenance. A replacement is a new version;
  request-row locking, optimistic record versions, unique version constraints
  and one-active-issued enforcement prevent conflicting concurrent issue.
- Customer projections include only previously issued quote history for the
  exact linked customer. Drafts, estimate internals, staff notes, actor IDs and
  staff-normalized free text and unrelated database IDs are excluded. Customer
  quote text passes the canonical evidence/claim boundary before persistence;
  comparison-only NFKC, semantic percent normalization, default-ignorable
  removal and bounded separator-tolerant semantic views prevent punctuation,
  whitespace, compatibility-symbol, combining-mark and invisible-mark variants
  from bypassing that policy without rewriting the reviewed text or joining
  unrelated ordinary words.
  Missing and forbidden identifiers have the same safe outcome, limiting IDOR
  disclosure.
- `business_audit_events` is separate from Auth audit and accepts only
  controlled request/estimate/quote events with allowlisted safe metadata.
  Ordinary application code has no update/delete operation; database-level
  append-only grants remain a production gate.
- No browser Data API/SQL access, provider Auth schema mutation, anonymous
  quote link, acceptance, booking, occupancy, payment, invoice, upload, message,
  notification or deployment is added. See `docs/REQUEST_AND_QUOTE.md`.

## Phase 3E quote acceptance and Booking safeguards

- Customer acceptance requires own-record update permission plus the current
  exact identity/customer link. Staff-on-behalf acceptance requires CRM and
  operations management permissions, a controlled source and a non-blank
  evidence note. Anonymous acceptance is unavailable.
- The DRAFT-to-ISSUED statement builds a canonical acceptance-source snapshot
  database-side while locking quote/request, request item provenance, quote
  items, CRM/property/zone and the complete estimate. The browser cannot submit
  or replace this evidence.
- The acceptance transaction locks and rechecks the `ISSUED` quote and
  `QUOTED` request, `[valid_from, valid_until)` validity, ownership/active state,
  full reported-versus-normalized request graph, complete estimate, mutable
  CRM/zone semantics and quote items. Its canonical current reconstruction must
  equal the issued JSONB snapshot exactly. Missing, extra, malformed, stale or
  changed evidence fails closed. Route identifiers and preview state are never
  authority.
- Estimate evidence is decoded database-side before issue or acceptance. The
  guard validates the strict engine item/enumeration contract, configuration
  provenance, canonical price/duration inputs, timestamp equality, scalar and
  result flags, line-to-subtotal/component arithmetic, unique rule references,
  VAT/minimum-total derivation, status and warning/review-code derivation. The
  database-canonical price-snapshot SHA-256 must also match the quote's stored
  source-estimate digest. Malformed JSON takes a false/review branch rather
  than an unsafe cast or exception.
- Acceptance invokes no request normalization, pricing, duration, CRM repair or
  snapshot refresh path, and booking values are extracted only from the issued
  snapshot. A legacy issued quote with `NULL` evidence is never backfilled.
  Any stale, incomplete or inconsistent provenance fails closed to safe staff
  review with no partial acceptance/Booking/audit state.
- Unique quote/acceptance/Booking constraints and one atomic database statement
  make duplicate and concurrent submissions idempotent. A bounded retry handles
  only random Booking-reference collision; it cannot weaken eligibility.
- The accepted quote remains `ISSUED` and the request remains `QUOTED`.
  `quote_acceptances` is immutable, unique acceptance evidence, and Booking
  items copy the frozen line descriptions, measurements, calculation evidence
  and integer commercial amounts.
- Every new Booking is `PENDING_SCHEDULING` / `REVIEW_REQUIRED`. The preferred
  window remains a preference; no exact time, team, equipment or occupancy is
  fabricated while scheduling configuration and frozen operational
  requirements are absent.
- `btree_gist` team/equipment exclusion constraints apply to half-open `[)`
  operational ranges for `PENDING`/`CONFIRMED` occupancy. They reject races at
  the database boundary. Cancellation changes blocking occupancy to
  `CANCELLED`, releasing capacity while retaining the historical row.
- The occupancy adapter is scoped to one requested team and Sofia work date,
  reads operational-range overlap rather than only service-start date, checks
  denormalized policy/profile provenance against referenced configuration and
  rejects malformed, mixed-context or arithmetically impossible snapshots.
- Staff cancellation reauthorizes CRM/operations/schedule management, checks
  the optimistic Booking version, changes Booking and occupancy atomically and
  appends sanitized audit evidence. Phase 3G rescheduling appends a linked
  schedule snapshot and audit event rather than rewriting history.
- Customer projections exclude staff acceptance notes, internal notes,
  operational snapshots, actor identifiers and other customers' records.
  Booking addresses, appointment times, access/parking facts and cancellation
  history remain sensitive server-mediated data.
- There is still no browser Data API/SQL access, provider Auth mutation,
  payment, invoice, Job/treatment execution, upload, message, notification,
  production migration or deployment. See `docs/BOOKING_ENGINE.md`.

## Phase 3F Job execution and Cleaning Passport safeguards

- Job creation is one atomic, one-Booking-to-one-Job operation. It validates
  the Booking, Booking items, Quote Acceptance, issued Quote and immutable
  `acceptance_source_snapshot` and inserts no partial Job/item/audit state on
  any failure or retry conflict.
- The immutable issued snapshot is the only authority for reported and staff-
  normalized request facts, asset link and quoted add-ons. Creation never reads
  current request/estimate rows as a fallback, invokes normalization/pricing/
  duration, or refreshes CRM facts into scope. Current CRM can only prove
  active asset ownership/integrity and supply a separately labeled visit
  contact. Inconsistency fails closed with zero writes.
- `READY` requires an exact current `CONFIRMED` occupancy matching Booking
  schedule, team and equipment. Otherwise a valid Job remains non-executable
  `PREPARED` with controlled review reasons. Job assignment can bind only that
  exact occupancy; it is not a hidden rescheduling path.
- Broad staff reads require CRM, operations, schedule and field-job read
  permissions. Assigned-technician reads additionally require an active
  `TECHNICIAN` role and an exact active time-valid membership in the Job's
  assigned team. Every mutation repeats fresh profile, permission, team,
  resource, state and optimistic-version checks in the database.
- Technician projections are purpose-limited to visit, scope, inspection,
  treatment and completion facts. They exclude all price/margin/calculation
  data, unrelated CRM history, administrative notes and identity data.
- Planned, observed, confirmed and performed facts are separate records.
  Canonical item/measurement/material/issue/risk/capability relationships are
  revalidated. Unsafe contamination/structure, specialist-only capability,
  material scope change, unquoted add-on or performed-plan divergence moves to
  controlled review, decline or referral instead of silent execution,
  replacement, repricing or repair.
- Server-owned timestamps control en-route, arrival, start, treatment and
  completion time. Job/item/execution versions and database uniqueness protect
  stale and duplicate mutation. A stopped-for-safety execution creates no
  Passport entry and cannot be represented as successfully completed service.
- Job completion locks the Job and all items, requires every item to be
  completed, declined or referred with its required inspection/plan/execution
  evidence, derives actual productive/occupied-team duration server-side and
  atomically freezes completion, Job audit and eligible Passport entries.
- `cleaning_passport_entries` are append-only and reference the exact asset,
  Job item and execution. Customer reads require the current exact identity/
  customer/property/asset link and receive only the customer-safe snapshot;
  staff history uses a separate authorized projection. Internal technician
  notes never enter customer history.
- `job_audit_events` accepts only controlled event/source/status metadata and
  has no ordinary update/delete path. Production database roles, RLS and
  append-only grants remain required; server authorization is not a substitute.
- Job mutations use a bounded local limiter only for development. Production
  remains blocked on shared abuse controls, monitoring/recovery, privacy/
  retention decisions, reviewed least-privilege/RLS, a separately authorized
  migration and explicit deployment approval. See `docs/JOB_EXECUTION.md`.
- Executable Job mutations freshly revalidate exact Booking occupancy,
  schedule, active team capabilities and effective equipment assignment.
  Cross-team or expired technician membership remains a not-found/forbidden
  boundary; mutable resource revocation cannot be bypassed with a stale page.
- Cleaning Passport history is database-bound to the exact completed treatment
  execution facts and excludes stopped, unperformed and no-observable-
  improvement outcomes from customer treatment history.

## Phase 3G scheduling and dispatch safeguards

- Scheduling freezes operational requirements only from the intact immutable
  Booking, Booking items and issued-Quote acceptance snapshot. It never
  renormalizes reported facts, recalculates price/duration, repairs CRM data or
  silently refreshes accepted scope. Missing or inconsistent evidence remains
  staff review.
- Owner, Admin and Dispatcher use existing CRM/operations/schedule permissions.
  Technician schedule-read authority does not grant administrative schedule or
  reassignment access. Every Booking, occupancy, team, equipment, Job, customer
  and property identifier is an untrusted selector and is reauthorized at the
  repository boundary.
- Mutation actions authenticate, authorize and rate-limit before parsing
  allowlisted fields. Browsers do not control duration, end time, operational
  interval, policy snapshots, server timestamps or audit metadata.
- Candidate previews are advisory and bound to Booking/versioned input state.
  Confirmation locks the Booking/current occupancy and freshly revalidates
  current team capability, equipment activity/capability/assignment, exact
  working-hour/travel versions and both adjacent occupancies. Stale previews
  fail closed rather than bypassing current capacity.
- The scheduling-specific occupancy adapter keeps service and historical
  operational boundaries distinct. It does not add captured historical travel
  or buffers a second time. Missing/invalid travel never becomes a silent zero;
  deterministic fallback and manual-review state remain visible.
- One atomic `READ COMMITTED` confirmation/reschedule transaction acquires the
  team/date advisory lock before its fresh mutation snapshot, then updates the
  Booking, changes any prior blocking occupancy, inserts the linked immutable
  replacement and appends allowlisted audit evidence. The mutation locks the
  complete selected-day occupancy and current configuration authority it uses.
  PostgreSQL half-open GiST exclusions are the final same-team/same-equipment
  overlap guard; an exclusion violation returns a generic conflict and leaves
  no partial state.
- Rescheduling uses controlled reason values and preserves old-to-new history.
  A `READY` or later Job cannot be silently rebound or moved. Simultaneous
  schedule, reschedule and cancellation requests are resolved under locks and
  optimistic Booking version checks.
- Sofia local scheduling time is converted and round-tripped on the server.
  Nonexistent spring time and ambiguous repeated autumn time are rejected
  rather than guessed; browser offsets and a presumed 24-hour day are not
  trusted.
- Staff dispatch, technician-today and customer appointment projections are
  distinct. Technician reads require exact active time-valid team membership.
  Customers receive only their own appointment and never team workload,
  equipment, travel or another customer's data.
- Capacity metrics are read-only and use persisted operational components and,
  where shown, immutable booked gross values. They do not reprice, expose
  cross-scope CRM data or become accounting/payroll authority.
- Static migration tests are supplemented by guarded Neon development
  integration tests for team/equipment overlap, different-team concurrency,
  cancelled release, two-dispatcher serialization and a reschedule/cancellation
  race. The minimal application fixture is cleaned from every touched table and
  creates no Neon Auth identity. CI remains credential-free and production is
  never a test target.
- DRAFT working hours, zones, travel, team capacity and equipment assignments
  remain visibly provisional. No development result is automatically approved
  operational knowledge. Direct browser Data API access, paid routing,
  deployment and production migration remain prohibited. See
  `docs/SCHEDULING_AND_DISPATCH.md`.

## Phase 3H finance and invoicing safeguards

- Invoice draft creation and issue consume only the immutable accepted
  Quote/Booking chain. The repository locks and revalidates exact acceptance,
  Booking, Quote, item, customer/property, approved billing, seller and policy
  relationships. It never accepts browser totals/VAT/customer scope or invokes
  normalization, repricing, duration recalculation or CRM repair. Any mismatch
  fails closed to finance review.
- Exact integer minor units, basis points, line/aggregate arithmetic checks,
  generated balances and restrictive composite foreign keys guard amount, VAT
  and source-snapshot substitution. Issue repeats the complete source/item/sum
  checks instead of trusting the earlier draft decision.
- `READY_TO_ISSUE` is not issue authority. A policy with
  `draft_eligibility=JOB_COMPLETED` creates no draft before exact completion. A
  Booking-eligible/Job-required policy may create only an immutable `DRAFT`
  whose sole reason is `JOB_COMPLETION_REQUIRED`; later issue must reprove the
  complete source/item/configuration/Job graph and cannot clear another reason
  or refresh the snapshot. Issue also requires current `FINANCE_READ` +
  `INVOICE_ISSUE`, an expected version, explicit confirmation and a locked
  numbering sequence. Production rejects provisional policy/numbering. Unique
  number/sequence constraints are the final duplicate-issue boundary.
- Issued Invoice headers, snapshots and items cannot be edited or cancelled.
  Later settlement may update only the controlled paid balance/status. Future
  correction requires a credit-note/replacement history rather than destructive
  mutation.
- Payment entry creates only `RECORDED`; it does not claim provider or bank
  verification. A separate authorized confirmation is required before
  allocation. The manual card method does not process card data, and free-text
  notes must never contain credentials, account secrets or payment-card data.
- Allocation locks Payment before Invoice, rechecks `PAYMENT_RECORD`, requires
  the same customer and currency, and refuses unconfirmed/reversed payments,
  non-payable invoices, Payment over-allocation and Invoice overpayment. Client
  values cannot derive balances or status.
- Reversal requires the finance-manage and payment-record permission
  conjunction, uses the same deterministic lock order, appends one reversal
  fact and compensating allocation rows, and restores every affected Invoice
  atomically. It deletes no financial history and sends no money.
- Payment recording, allocation and reversal use payload-bound idempotency.
  Optimistic versions, unique keys and row locks prevent conflicting retries,
  stale actions, duplicate number allocation and allocation/reversal races.
- Staff mutations authenticate, authorize and apply the existing bounded
  `FINANCE_MUTATION` limiter before strict allowlist parsing. Production still
  requires a distributed/provider-backed limiter and finance-specific
  monitoring/recovery.
- Staff finance, customer Invoice and printable projections are distinct.
  Customers require `OWN_CUSTOMER_DATA_READ` plus the exact active identity/
  customer link and can see only their own issued/settled documents. Drafts,
  review state, internal notes, commercial/provenance internals, staff audit,
  Payment records and other customers remain excluded. Dispatcher and
  Technician receive no finance permissions.
- Customer-visible payment instructions come only from an approved seller
  snapshot. The schema and seed contain no real seller, company, VAT or bank
  data. Sensitive billing, company/VAT identifiers and external payment
  references must not enter logs, URLs or audit metadata.
- `finance_audit_events`, allocations and reversals are append-oriented with
  allowlisted metadata. Database immutability guards protect the migration's
  critical history, while production least-privilege roles, RLS and append-only
  grants remain mandatory defense in depth.
- There is no browser Data API/SQL, live payment gateway, card processing, bank
  API, webhook, refund, fiscal-device integration, accounting export,
  production migration or deployment. This phase makes no Bulgarian legal,
  VAT, invoice, cash-receipt, fiscal or accounting compliance claim. See
  `docs/FINANCE_AND_INVOICING.md`.

## Phase 3I communications and documents safeguards

- Publication starts only from an explicit authorized staff action over an
  eligible immutable owning audit event. No background observer silently
  publishes historical or new business rows.
- Materialization rechecks `COMMUNICATIONS_READ` + `COMMUNICATIONS_MANAGE` and
  the exact source permission conjunction in both the service and database
  repository. Quote requires customer/operations read; Booking additionally
  requires schedule read; Job/Passport additionally requires field-job read;
  Invoice/Payment requires customer/finance read.
- Source-specific restrictive and composite foreign keys bind customer,
  contact, source, owning audit event, template, document and delivery graph.
  Booking confirmation/reschedule also binds the exact occupancy revision.
  Missing or inconsistent provenance fails closed to review; source data is not
  renormalized, repriced, rescheduled, repaired or refreshed.
- The source projector allowlists customer-safe facts. Access notes,
  coordinates, request free text, estimate internals, staff/technician notes,
  external payment references and provider details do not enter the document
  snapshot.
- Templates are versioned plain text with exact allowlisted placeholder
  contracts. Unknown, missing, duplicate, malformed or mismatched variables
  fail closed. The renderer evaluates no code and stores no arbitrary HTML.
- Final documents bind canonical structured content to template key/version,
  locale and renderer version with SHA-256. Referenced templates and intents,
  final/superseded documents, attempts, results, history and audit evidence are
  protected by database immutability/append-only guards.
- Event/template/channel uniqueness, payload-bound idempotency and one atomic
  insert graph prevent duplicate/conflicting retries and partial portal
  publication.
- `DELIVERED_LOCAL`/`PORTAL_PUBLISHED` means only that VAX published the final
  document to authenticated portal history. It is not customer-read evidence
  and cannot represent email, SMS, postal or provider acceptance.
- Linked-customer reads require `OWN_CUSTOMER_DATA_READ` plus the exact active,
  non-revoked identity/customer link. Preference updates additionally require
  `OWN_CUSTOMER_DATA_UPDATE`, exactly one link and optimistic versioning.
  References and matching email/contact values never grant ownership.
- Portal, operational and billing choices remain separate from future email/
  SMS and marketing consent. Future channels and marketing default off; the
  database prohibits automated marketing intents in this phase.
- Communication audit metadata is allowlisted and excludes bodies, contact
  values, addresses, notes, external payment references, provider responses,
  credentials and tokens.
- The bounded communication mutation limiter is defense in depth only.
  Production still requires a shared limiter, monitoring/recovery, reviewed
  RLS/least-privilege grants and retention/contact-authority/consent policy.
- External email/SMS providers, callbacks, retries, suppression/bounce
  handling, manual free-form messages, customer-open tracking, binary PDF/
  object storage, production migration and deployment are absent. See
  `docs/COMMUNICATIONS_AND_DOCUMENTS.md`.

## Auditability

Phase 3D records material request, estimate and quote lifecycle changes in its
business stream. Phase 3E separately records acceptance, Booking creation and
cancellation. Phase 3G extends the Booking stream with scheduling,
rescheduling, team/equipment assignment, review and occupancy-release evidence.
Phase 3F separately records Job lifecycle, assignment,
inspection, treatment, review, completion and Passport creation.
Phase 3H separately records Invoice readiness/issue/cancellation, Payment
recording/confirmation/allocation/reversal and settlement changes.
Phase 3I separately records communication materialization, rendering, local
portal publication and preference changes while keeping each owning domain
event as the source authority.
Authentication and role/status events remain in `auth_audit_events`. Broader
sensitive-read and future-domain operations still require durable audit
coverage, including:

- role and permission changes;
- access to sensitive customer information;
- discounts, future Invoice/Payment correction and exceptional reconciliation;
- future communication correction/supersession, external delivery
  reconciliation, suppression and consent exceptions;
- multi-team assignment and exceptional job/schedule overrides beyond the
  implemented ordinary Phase 3G scheduling history;
- inspection, damage, treatment, Passport amendments and claim changes;
- exports, deletions, and retention actions;
- security-setting changes; and
- equipment or inventory adjustments with business impact.

Audit records should capture actor, action, target, time, source, result, and
correlation context while avoiding secret values and unnecessary sensitive
payloads. Audit logs must not be silently editable by ordinary operators.

## Application safeguards for future phases

- Reconfirm CSRF and cookie policy if social/OAuth or cross-site embedding is added
- Safe output encoding and content security policy
- Distributed rate and abuse controls for request, quote, Booking/scheduling,
  Job, finance, authentication and messaging paths
- An approved duplicate/replay policy for public request intake, preservation
  of Booking and finance idempotency, plus idempotency for notifications and
  provider webhooks
- File type, size, malware, and authorization controls for uploads
- Encryption in transit and provider-supported encryption at rest
- Dependency and lockfile review
- Centralized sanitized logging and alerting
- Backup, point-in-time recovery, and restoration exercises
- Defined retention and deletion workflows
- Security review before every production gate

## Incident rule

Do not copy suspected secrets into issues, chat, logs, screenshots, or test
output. Preserve minimal evidence, revoke or rotate affected credentials through
the owning provider, assess exposure, and document remediation through an
authorized incident process.
