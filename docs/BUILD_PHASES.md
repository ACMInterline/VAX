# Build Phases

## Delivery rule

Each phase is an incremental product slice. Before advancing, define its
acceptance criteria, verify the integrated implementation, update relevant
documentation, and record deferred risks. A phase heading is not evidence that
its capability exists.

## Phase 0 — Foundation

Establish the repository, modular-monolith boundaries, strict typed toolchain,
PostgreSQL adapter, migration workflow, safe health contract, documentation,
and validation commands.

Phase 0A established the local application and migration foundation. Phase 0B
provisioned an isolated Neon `development` branch, configured local-only
connectivity, and applied the reviewed initial migration there. Phase 0C
establishes the initial GitHub `main` baseline, feature-branch workflow, and
credential-free CI validation. Phase 0D establishes the disposable Codex
worktree, pull-request, validation, connection, and database-change workflow.
Production migration and deployment design remain deferred to separately
authorized work.

Gate: clean install, lint, typecheck, tests, production build, reviewed initial
migration, one-command local validation, green protected-main CI, synchronized
GitHub `main`, documented worktree lifecycle, and no committed secrets.

## Phase 1 — Public website foundation

Establish approved brand direction, information architecture, reusable public
layout, content model, responsive navigation, accessibility baseline, service
discovery, and contact or request entry points without prematurely building the
booking engine.

Implemented as a complete public route foundation with a temporary configurable
identity, typed content, six service paths, technical SEO, claim controls,
responsive and accessible presentation, contact placeholders and a browser-only
request prototype. The form performs no persistence and no database schema
change is part of this phase.

Phase 1A makes Bulgarian the primary unprefixed locale and retains complete
English `/en` routes through the same components. It adds corresponding-page
language switching, localized metadata and request validation, a typed
five-status marketing-claim authority register and human-readable evidence
documentation. Final identity, owner-approved Bulgarian copy, original
photography, pricing, request connectivity, deployment and production
performance measurement remain gated follow-up work.

Gate: approved content and routes in both locales, responsive and accessible
browser checks, claim-evidence review, performance budget, and explicit
form-backend behavior.

## Phase 2 — Canonical service catalogue foundation

Implemented as code-controlled Bulgarian/English service categories, service
identities, durable cleaning-item types, permitted measurement modes, separate
fibre and construction taxonomies, neutral condition levels, issues and risk
flags, five treatment levels, mechanical-action levels, treatment approaches,
product and add-on foundations, capability relationships and nullable duration
inputs. The public site and browser-only request form align with the same
canonical definitions without requiring a database connection.

No monetary pricing, booking persistence, actual cleaning-product claim,
customer or transaction table is part of Phase 2. Reference rows are
deterministic and code-controlled; actual products and approved operational
values remain future controlled admin data.

Gate: stable unique codes, complete BG/EN labels, valid default measurement
relationships, reviewed additive development migration, deterministic seed,
claim-boundary tests, database-independent public build, and no production or
Neon Auth change.

### Phase 2A — Duration and pricing semantics

Implemented as an unpublished development foundation: versioned EUR price
books, exact minor-unit and basis-point arithmetic, gross/net VAT support,
selected-band area pricing, item/side prices, minimum-visit logic, separate
commercial condition factors, travel/timing foundations, independent duration
rules, explainable output, immutable future-snapshot types and contribution
concepts. The local internal lab has no database writes and is non-indexed.

All seeded values remain inactive provisional assumptions. Public prices,
quotes, bookings, customer data, production migration and deployment are not
part of Phase 2A.

Gate: reviewed additive development migration, exact boundary and tax tests,
manual-assessment and claim safeguards, database-independent public build,
local internal-lab verification, and no production or Neon Auth change.

### Phase 2B — Service area, travel, availability and team capacity

Implemented as a non-transactional scheduling foundation: operational
service-area metadata, typed locations, provider-independent travel estimates,
a deterministic draft Sofia matrix, two neutral team/equipment fixtures,
versioned 06:00–22:00 working hours and request windows, exact 30-minute
candidate generation, neighbouring-job travel/buffers, manual-review rules,
utilisation and team-hour helpers, future occupancy/snapshot contracts, and a
non-persistent internal availability lab.

No customer booking, calendar transaction, employee identity, public slot,
production migration, Neon Auth change or deployment is part of Phase 2B.

Gate: reviewed additive development migration, travel/boundary/capacity tests,
no Phase 2A duration double-counting, database-independent public build,
internal-lab verification, no public draft leakage, and production unchanged.

### Phase 2C — Commercial and operational calibration

Use owner/accountant decisions and measured field observations to approve or
replace provisional price, duration, zone, travel, parking, working-hour and
capacity values. Define B2B volume semantics, activation/supersession and an
audited controlled workflow for the first non-draft versions. Keep public
publication separately gated.

Gate: approved commercial/tax and operational data, representative field
evidence, validated location rules, deterministic new-version tests, controlled
approval/audit design, and an explicit public-publication decision.

## Phase 3 — Identity/authentication/RBAC

### Phase 3A — Identity, authentication, sessions and RBAC foundation

Implemented with a provider-neutral boundary over Neon Auth, provider-backed
email/password and recovery/verification flows, application-owned profiles,
five canonical roles, stable permissions, deterministic mappings, explicit
first-owner bootstrap, account status, sanitized authentication events,
centralized server authorization, permission-aware navigation and `/app`.

No CRM, customer/property business record, persistent request, quote, booking,
payment, upload, production migration or deployment is included.

### Phase 3B — Privileged identity administration

Implemented application user list/detail routes, localized filtering and
pagination, conservative owner/admin policy, atomic role/status mutations and
audit, last-active-owner/self protection, explicit accessible confirmations,
safe provider capability reporting and pure reconciliation states. No schema,
provider record, synthetic identity, CRM record or deployment change is part of
Phase 3B.

Provider-attested recent authentication, session enumeration/revocation,
production invitations and provider-admin elevation remain fail-closed gates;
no substitute provider-table access or fake email delivery is used. Production
SMTP/trusted origins, shared rate limiting, monitoring/recovery, reviewed
least-privilege/RLS and the scheduled Next.js security update also remain
unresolved before deployment.

Gate: focused privilege/IDOR/race/stale-session/CSRF review,
deny-by-default authorization tests, full validation and protected-main CI.

### Phase 3C — Customer CRM, Property Registry and Cleaning Asset foundation

Implemented individual/business customers, multiple contacts, explicit
application-profile links, properties, areas and physical cleaning assets that
reuse the canonical cleaning taxonomy. Staff routes use existing CRM
permissions; customer self-service is linked-only and read-only. UUID asset
identity is the future Cleaning Passport attachment point without fabricated
inspection, treatment or completed-job history.

At the Phase 3C gate the public request was still non-persistent and no quote
was introduced. Booking, payment, invoice, file, message, notification,
occupancy and deployment also remained outside that phase. Production
least-privilege/RLS, final retention/data-subject workflows and duplicate/merge
policy remained explicit gates.

Gate: reviewed additive development migration, record-level authorization and
IDOR tests, sensitive projection review, archive/delete integrity, bilingual
responsive accessibility, full validation and protected-main CI.

### Phase 3D — Persistent Request → Estimate → Quote

Implemented persistent anonymous, linked-customer and staff-created request
capture with immutable original-submission provenance and separately normalized
structured scope. Staff workflows use the conjunction of CRM and operations
permissions for inbox/detail review, CRM resolution, lifecycle, append-only
price/duration estimates and versioned draft/issued quotes. Linked customers can
submit own requests and read only their own issued quote history.

Estimate versions preserve complete price and duration snapshots from the
provisional engines and remain manual-review gated. Quote issue freezes reviewed
scope, bilingual lines, exact EUR values, terms, validity and estimate
provenance; optimistic versions, request locks and unique active-issued state
protect concurrent writes. A separate allowlisted business-event stream records
material changes without reusing authentication audit history.

No acceptance, booking, appointment, occupancy, reservation, payment, invoice,
file, message, notification, job execution, production migration, deployment or
Neon Auth schema change is part of Phase 3D. Availability preview remains a
staff-only ephemeral advisory. See `docs/REQUEST_AND_QUOTE.md`.

Gate: request ownership and public-intake abuse/privacy design, immutable
commercial provenance, concurrency/idempotency, auditability, bilingual
accessible public/staff/customer flows, development-only migration verification,
full validation, protected-main CI and explicit acceptance boundaries.

### Phase 3E — Quote acceptance → Booking

Implemented the conservative issued-quote acceptance and Booking foundation.
Customer or authorized staff-on-behalf acceptance consumes only an intact,
still-valid `ISSUED` quote and atomically creates one immutable acceptance, one
customer-safe Booking, copied item/commercial snapshots and audited evidence.
It neither renormalizes request facts nor recalculates price or duration. The
quote remains `ISSUED`, the request remains `QUOTED`, and the acceptance
relation is authoritative.

Every new Booking starts `PENDING_SCHEDULING` / `REVIEW_REQUIRED` because the
Phase 2B scheduling configuration is unapproved and the issued quote does not
freeze complete operational requirements. No exact slot, team, equipment or
occupancy is fabricated. A durable occupancy schema provides PostgreSQL GiST
half-open `[)` overlap protection for one team and optional equipment, and
cancellation releases blocking capacity while preserving history. The actual
schedule/assignment/reschedule command remained future at the Phase 3E gate and
was required to append audited snapshot revisions without repricing; Phase 3G
implements that later boundary. See `docs/BOOKING_ENGINE.md`.

No payment, invoice, Job/treatment execution, notification, production
migration or deployment is included.

Gate: immutable pricing/request provenance, authorization and IDOR defense,
duplicate/concurrent acceptance idempotency, atomic failure recovery,
database-backed occupancy constraints, cancellation history, bilingual
accessible customer/staff flows, reviewed development-only migration, full
validation and protected-main CI.

### Phase 3F — Operational Job → Inspection → Treatment → Completion → Cleaning Passport

Implements one durable Job per eligible Booking without changing Phase 3D/3E
authority. Job creation consumes only the Booking/Booking-item chain and the
immutable issued-Quote `acceptance_source_snapshot`; it never rereads current
request or estimate rows as scope authority, renormalizes reported/staff facts,
reprices, recalculates duration or silently repairs CRM provenance. Current CRM
may provide a separate purpose-limited visit contact and exact active asset-
ownership integrity check only. Any malformed or inconsistent provenance fails
closed with zero Job writes.

An exact current confirmed Booking occupancy is required for a `READY` Job;
otherwise a valid Booking can produce only review-gated `PREPARED`. Phase 3F
adds time-bounded operations-team membership, mobile-first staff/assigned-
technician Job views, controlled en-route/arrival/start states, professional
inspection, confirmed treatment or decline/referral, performed-treatment
evidence, atomic completion with server-derived actual duration, and append-
only asset Cleaning Passport history. Planned, observed, confirmed and
performed facts remain distinct. Unsafe, specialist, material-scope or
performed-versus-confirmed divergence fails closed to review instead of
changing scope or price.

No new role or permission, general Booking scheduling/rescheduling command,
multi-visit Job, payment, invoice, file/media, message, notification, route
optimisation, offline synchronization, payroll, inventory, production
migration or deployment is included. Cleaning Passport entries exist only for
asset-linked treatments actually completed within their confirmed plans. See
`docs/JOB_EXECUTION.md`.

Gate: immutable Booking/issued-Quote provenance, no partial Job creation,
exact-occupancy readiness, assigned-team/record-level authorization and IDOR
defense, safety/review behavior, optimistic concurrency and retry idempotency,
completion/Passport atomicity, safe customer versus technician projections,
bilingual responsive accessibility, reviewed development-only migration, full
validation and protected-main CI.

### Phase 3G — Scheduling, dispatch and operational capacity hardening

Implements the durable scheduling transition on the Phase 2B calculator, Phase
3E occupancy constraints and Phase 3F exact-occupancy Job binding. Staff freeze
operational requirements only from immutable Booking/issued-Quote evidence,
inspect deterministically ranked current candidates and explicitly confirm an
exact team, optional equipment and Sofia appointment. The server revalidates
current capability, equipment, working-hour, travel and adjacent-occupancy
state under locks; PostgreSQL GiST constraints remain the final concurrent
capacity guard.

The persisted lifecycle remains `UNSCHEDULED`, `REVIEW_REQUIRED` and
`SCHEDULED`; reschedule-required is derived readiness and no hold state is
introduced. `booking_occupancies` remains the append-oriented revision history:
rescheduling cancels the old blocking row, appends a linked immutable version
and audits a controlled reason without changing price. A `READY` Job blocks
silent rescheduling. Phase 3G also adds a bilingual/mobile staff daily board and
queue, row-scoped technician today view, safe customer appointment, explicit
Sofia daylight-saving behavior and read-only daily capacity metrics.

All existing zone, working-hour, travel, team and equipment configuration stays
visibly DRAFT/provisional. There is no customer-controlled occupancy, hold,
paid routing, payment, invoice, notification, offline synchronization,
production migration or deployment. See `docs/SCHEDULING_AND_DISPATCH.md`.

Historical roadmap provenance: this capability was originally listed below
Phase 3F as “Phase 7 — Calendar, availability and dispatch.” The Phase 3G name
brings the implemented work into the established Phase 3 sequence; it does not
erase or renumber the later Phase 8–18 roadmap.

Gate: immutable commercial/operational provenance, exact DRAFT-version labels,
Sofia spring/autumn daylight-saving tests, deterministic ranking and adjacent-
travel tests, authorization/IDOR/mass-assignment checks, atomic concurrency and
no-partial-state proofs, direct development-database overlap tests, bilingual
responsive accessibility, reviewed additive development-only migration, full
validation and protected-main CI.

### Phase 3H — Finance, Invoice and Payment Allocation foundation

Implements a controlled financial settlement layer without changing Phase
3D–3G authority. Invoice draft creation consumes the exact immutable issued-
Quote Acceptance/Booking/item chain and never reruns normalization, pricing,
duration or CRM repair. Versioned customer billing, seller legal, Invoice
policy and transaction-safe numbering configuration are separate approval
gates. Missing/stale provenance, unresolved VAT/billing/seller state, a
completion-required Job difference or manual adjustment remains
`FINANCE_REVIEW_REQUIRED` rather than being recalculated.

`draft_eligibility=JOB_COMPLETED` blocks draft creation until exact completion.
`BOOKING_ACCEPTED` draft eligibility combined with `JOB_COMPLETED` issue
eligibility may create an immutable `DRAFT` with only
`JOB_COMPLETION_REQUIRED`; later issue revalidates the complete source, item,
configuration and Job graph and never refreshes its snapshots.

Standard Invoices preserve integer EUR net/VAT/gross amounts, accepted B2C/B2B
basis, frozen bilingual lines and issue-time customer/seller/terms/provenance
snapshots. Issue serializes a non-reusable environment-scoped number and makes
the financial document/items immutable. Unissued drafts may be cancelled;
issued corrections require a future credit-note/replacement path. `OVERDUE` is
derived from due date and outstanding balance.

Payments are manual external-event records, not processing. They require an
explicit `RECORDED → CONFIRMED` transition before allocation. The append-
oriented allocation ledger supports multiple partial/full settlements, blocks
cross-customer/currency and over-allocation, leaves excess value unapplied and
uses compensating rows for audited reversal. There is no customer-credit asset,
money-out refund or automatic overpayment policy.

Phase 3H adds only `FINANCE_READ`, `FINANCE_MANAGE`, `INVOICE_ISSUE` and
`PAYMENT_RECORD`, mapped to Owner/Admin; no Accountant role is invented.
Linked customers can read only their own issued/settled Invoice projection.
Staff receive a small finance dashboard, Invoice/payment operations and
print-friendly detail—not a general ledger, profitability system or legal PDF
service. See `docs/FINANCE_AND_INVOICING.md`.

No live gateway/card/bank integration, payment webhook, Bulgarian fiscal-device
automation, accounting export, full credit-note/refund workflow, real legal or
bank seed, production migration or deployment is included. The implementation
makes no VAT, invoice, cash-receipt, fiscal, accounting or legal compliance
claim.

Gate: immutable accepted-commercial provenance, exact integer arithmetic,
B2C/B2B and VAT snapshot tests, issue/numbering immutability and concurrency,
payment confirmation/allocation/reversal and race safety, permission/IDOR/mass-
assignment/projection review, append-oriented audit/ledger integrity, synthetic
development fixture cleanup, reviewed additive development-only migration,
full validation, protected-main CI and explicit accountant/legal production
configuration gates.

### Phase 3I — Communications and immutable customer documents

Adds a provider-neutral communication/document boundary without changing the
authority of Phase 3D–3H records. Authorized staff explicitly materialize one
eligible immutable Quote, Booking, Job, Invoice or Payment event. The owning
domain audit row remains the event authority; the operation never scans for
events automatically, rereads mutable CRM as historical truth, renormalizes a
request, reprices work, reschedules a Booking or repairs finance provenance.

Phase 3I adds versioned Bulgarian/English plain-text templates with exact
allowlisted variables, customer communication preferences, source-bound
communication intents, immutable structured `HTML_PRINT` document snapshots,
SHA-256 integrity checks, local portal delivery evidence, linked-customer
history and a sanitized communication audit stream. Current portal publication
creates the intent, final document, local attempt/result, history and audit
evidence atomically and idempotently.

`COMMUNICATIONS_READ` and `COMMUNICATIONS_MANAGE` are additive permissions, not
a new role. Every materialization also requires the relevant source-domain read
conjunction. Customer history requires `OWN_CUSTOMER_DATA_READ` plus the exact
active identity/customer link; preference updates additionally require
`OWN_CUSTOMER_DATA_UPDATE` and optimistic versioning.

`DELIVERED_LOCAL` means published in authenticated VAX portal history only. It
does not claim customer read/open state or external delivery. Email/SMS/manual
free-form messaging, provider adapters/callbacks/retries, binary PDF/object
storage, automatic event materialization, production migration and deployment
remain deferred.

The supplied Phase 3I attachment is truncated in section 20 after the words
`and explicitly defer`. This phase claims only the visible requirements; the
missing remainder must be recovered and reconciled before a later expansion or
production gate. See `docs/COMMUNICATIONS_AND_DOCUMENTS.md`.

Gate: exact event/customer/template/source-version provenance, customer-safe
projection and placeholder-contract tests, deterministic checksum and
idempotency tests, permission/IDOR/contact/preference isolation, atomic portal
publication and no-partial-state proofs, database immutability/append-only
guards, bilingual responsive accessibility, reviewed additive development-only
migration, full validation and protected-main CI.

### Phase 3J — Production-readiness security repair

Closes repository-owned deployment findings without adding product behavior:
adopt the patched Next.js 16.3.3 release across synchronized packages, require
HTTPS for production Auth and password-reset origins, reject credential-bearing
or ambiguous Auth URLs, and strengthen development mutation targeting with the
exact database name.

No broad RLS/grant migration is applied while runtime uses the table-owning
development credential and the server-mediated architecture supplies no
transaction-local database actor. Production runtime/migration roles, reviewed
grants and RLS, distributed rate limiting, trusted origins/SMTP, monitoring,
recovery rehearsal, production migration and deployment remain separate gates.

Gate: locked clean install, focused production-configuration and mutation-
interlock regression tests, full validation, exact-snapshot security review,
credential scan, protected-main CI, and proof that Neon production is untouched.

### Phase 3K — Database security and staging readiness

Separates database administration, reviewed migration/ownership and server
runtime identities. The runtime is a non-owner, non-DDL, non-role-admin,
non-`BYPASSRLS` login with an exhaustive 97-table DML matrix. The development
Data API and anonymous/PUBLIC roles receive no VAX schema, table, sequence or
trigger-function access. Deny-by-default migrator privileges prevent future
objects from silently reopening those paths.

Migration 0012 enables role/command-scoped RLS for all VAX public tables. This
is meaningful defense against Data API/grant drift, but it does not pretend to
provide customer-row or technician-team isolation: current Neon HTTP queries
do not carry tamper-proof transaction-local actor context. Server repository
authorization remains authoritative. Actor-aware RLS requires a separate
adapter design and security review.

Migration 0013 preserves repository concurrency locks without granting
ordinary write authority: only one primary-key column per lock-only table is
eligible for UPDATE at the ACL layer, and restrictive RLS permits locking while
rejecting all changed rows.

No staging branch is created, no production object or credential is changed,
and no deployment is authorized. The staging runbook requires isolated
credentials/Auth, exact target guards, the same live low-privilege harness,
recovery rehearsal and later explicit approval.

Gate: complete catalog/grant inventory, unchanged migrations 0000–0011 and
provider Auth fingerprint, zero business-data loss, reviewed role bootstrap
and additive development-only migration, real runtime/migrator denial and
allowed-path tests, full validation, exact-snapshot security review,
protected-main CI, and proof that production remains unmigrated.

### Phase 3L — Staging operations and recovery readiness

Creates the isolated Neon `staging` branch from the controlled development
base, rotates separate runtime/migrator/administrator credentials, applies and
verifies migrations through additive 0015, and proves a cold rebuild plus
disposable recovery branch. Adds a database-backed shared sensitive-action
limiter, strict environment/origin/proxy contracts, safe liveness/readiness,
structured log redaction, staging noindex/security headers and operational
runbooks.

Staging remains local-loopback only and contains no Auth user/session or
business data. External email, live reset/OTP, authenticated five-role browser/
IDOR/session-cookie flows, hosted monitoring/alerts and portable logical export
are not complete. Neon Auth remains Beta. Production remains unmigrated,
undeployed and separately unauthorized.

Gate: exact migration hashes, development/staging low-privilege verification,
multi-instance limiter proof, fail-closed credential replacement plus a
provider-supported pooler-session invalidation procedure, cold rebuild and
controlled migration-failure cleanup, branch recovery, safe outage/readiness
behavior,
browser headers/noindex checks, full validation, exact-snapshot security review,
protected-main CI, and proof that production is untouched. A complete staging
rehearsal still requires an approved hosted HTTPS origin and test-only mail
transport.

### Phase 3M — Hosted staging acceptance

Adds a dedicated nonproduction Vercel Preview deployment over the isolated
Neon staging branch, with one exact HTTPS staging/Auth origin, a generated
test-only SMTP sink and recipient allowlist, shared hosted rate limiting,
sanitized GitHub issue monitoring and a portable PostgreSQL logical export/
restore rehearsal. Synthetic OWNER, DISPATCHER, TECHNICIAN and CUSTOMER flows
exercise verification/reset/session, protected navigation, cross-customer
denial, Request, Estimate, Quote, acceptance and Booking behavior.

The historical Phase 3M database contract remains 98 public tables and 16
ordered migrations. Six synthetic Auth/application profiles and the bounded
CRM/request/Quote/Booking fixture chain are retained as controlled staging
acceptance evidence. Scheduling stops safely because price, duration and
availability knowledge is still provisional and inactive; downstream Job,
Passport, finance and communication/document work is not fabricated. Provider
session inventory/revoke-all/recent-auth, established pooler-session
invalidation and production on-call ownership remain fail-closed limitations.

Gate: exact hosted commit/origin/configuration, live readiness, synthetic Auth
and IDOR coverage, generic recovery/email behavior, multi-instance limiter,
sanitized alert/recovery evidence, portable restore and secret scan, protected-
main CI, retained-fixture accounting and proof that production is untouched.
This gate establishes nonproduction evidence only and does not authorize
production.

### Phase 3N — Operational calibration and business authority

Adds an application-owned governance boundary for critical commercial,
operational, legal, provider and deployment facts. A strict registry defines
17 readiness categories, typed value contracts, evidence classes and required
conceptual authorities. Records move explicitly through `PROPOSED`,
`UNDER_REVIEW`, environment-specific approval, rejection and supersession;
effective dates and immutable versions prevent a saved or future value from
self-activating.

The protected bilingual `/app/admin/business-authority` surface uses the
existing `SYSTEM_SETTINGS_READ`/`SYSTEM_SETTINGS_MANAGE` permissions. Reads are
permission-gated; proposal and all status/approval decisions require an active
Owner in both application policy and the database transition graph. Selecting
`ACCOUNTANT`, `LEGAL`, `OPERATIONS`, `TECHNICAL` or `CONTENT_CLAIMS` records
which conceptual decision was obtained; it grants no role or professional
qualification. External decisions require a controlled evidence reference,
and the runtime cannot self-assert `SYSTEM_VERIFIED` evidence.

Migration `0016_phase_3n_business_authority.sql` adds
`business_authority_records` and append-only
`business_authority_audit_events`, database-enforced transition/approval graph
checks, exact runtime grants/RLS and no operational seed. It extends the
nonproduction contract to 100 public tables and 17 ordered migrations while
retaining five roles, 28 permissions and 76 canonical mappings. The same
migration adds exact `STAGING` scope to the pre-existing finance environment
checks; hosted finance actions derive that scope from `VAX_ENVIRONMENT`, not
from Next.js `NODE_ENV`. No seller, VAT, number, price or finance authority is
created.

Business Authority runtime mutations also carry a fresh transaction-local HMAC
binding of application profile, provider subject, correlation and issue time.
Database triggers validate it using a protected purpose-derived verifier and
repeat the live profile/provider/Owner check. The verifier is derived from the
Auth cookie secret but provisioned only by the migrator after the atomic
migration set; missing/mismatched state blocks mutation. Production key
provisioning and coordinated rotation remain separately unauthorized.

The deterministic evaluator derives approved/pending items and blocker codes
from exact current approvals; no editable ready boolean exists. The printable
production-authorization package distinguishes Owner input, system evidence
and external evidence, documents provider/pooled-credential limitations,
lists names-only configuration dependencies and remains
`PRODUCTION NOT AUTHORIZED`. Configuration references require an exact trusted
type/code/version/content-digest resolution; the final production GO is bound
to the exact release commit, target, active change window and canonical
dependency fingerprint.

Policy readiness is closed and semantic: exact required codes only, fixed units
and lower/integer bounds where numeric, no numeric fields on nonnumeric entries,
and no unresolved legal-retention exception. The current global availability
record deliberately blocks `INSTANT_*` until a later authorized per-service
model exists. Hosted/production scope requires explicit `VAX_ENVIRONMENT`;
`NODE_ENV` never activates production authority. Zero real authority remains a
valid fail-closed governance state but keeps deployment unauthorized.

Gate: strict proposal/transition/effective-date/supersession/environment tests,
Owner-only approval and database graph enforcement, production-GO dependency
tests, historical Quote/Booking/Invoice/document regression safety, exact
100-table/17-migration security policy, development/staging-only migration and
rehearsal, full validation, exact-snapshot security review, protected-main CI
and proof that Neon production remains untouched. Missing real operational,
Owner, Accountant, Legal or provider decisions stay visible blockers; they are
not fabricated to pass staging.

### ATTELIER finalization — business calibration and product closure

This is a closure task, not another numbered architecture phase. It replaces
the temporary customer brand with ATTELIER, adds the original geometric visual
system and bilingual public gross prices, then applies the Owner's exact
staging-only scope, duration, hours, windows, zones, access, Job/Passport,
provider-risk and monitoring facts through the Phase 3N governance boundary.

Migration 0017 adds explicit unresolved-VAT estimate semantics and second-side
price/duration percentages without adding a table or rewriting history. The
follow-up 0018 preserves manual-estimate compatibility without changing 0017.
The contract becomes 100 public tables and 19 ordered migrations. The exact
staging resolver is allowlisted and returns nothing in production. Sixteen
authority records can reach staging approval; thirteen remain under review.
The usable lifecycle ends honestly at a real gross estimate until VAT,
Accountant/Legal and actual staff/equipment/route/product evidence are supplied.

Gate: exact public-price/duration/zone tests, claim-boundary and bilingual UI
tests, authority type/code/version/digest and environment tests, unresolved-VAT
provenance/Quote fail-closed tests, migration/security-history checks, guarded
development/staging evidence, browser accessibility/responsiveness, full
validation, exact-snapshot security review, protected-main CI and proof that
production remains untouched.

## Phase 8 — Technician workspace

Expand Phase 3F's mobile-first assigned-work views, arrival/progress states,
task guidance, issue escalation and completion checks with an explicit offline
and synchronization strategy plus broader field-device behavior.

Gate: field-device browser testing, accessible touch interactions, retry and
sync behavior, and permission isolation.

## Phase 9 — Inspection and treatment workflow

Expand Phase 3F's item inspection, condition/material/risk findings, existing
damage, treatment plans, performed treatment and separated notes with media
evidence, richer product-consumption detail, amendments and customer
acknowledgement where required.

Gate: history integrity, safe treatment guidance ownership, media controls,
customer acknowledgement, and audited amendments.

## Phase 10 — Customer portal

Expand the secure customer surface beyond Phase 3D's request/issued-Quote
history, Phase 3E Bookings, Phase 3F Cleaning Passport and Phase 3I immutable
document history to richer appointments, conversations and relevant service
status.

Gate: object-level authorization, privacy review, responsive accessibility,
empty and error states, and account-recovery behavior.

## Phase 11 — Digital Cleaning Passport/history

Expand Phase 3F's initial append-only asset history with photos, reviewed
amendments, export controls, multi-visit composition and recurring-maintenance
workflows without duplicating source facts.

Gate: provenance, timeline correctness, amendment rules, export controls, and
multi-visit scenario tests.

## Phase 12 — Payments/invoices

Expand Phase 3H with approved payment-provider adapters, verified webhooks,
money-out refunds, legally reviewed credit notes/replacement documents,
discount approvals, exceptional reconciliation, immutable generated documents
and accountant-approved exports.

Gate: exact money handling, idempotent webhook processing, reconciliation,
permission controls, audit logs, and financial review.

## Phase 13 — Communications/notifications

Expand Phase 3I's local portal templates, preferences, intents, immutable
documents and delivery history with approved customer conversations, email/SMS
adapters, external delivery status, retries, suppression and opt-out controls.

Gate: consent and legal review, idempotency, suppression behavior, provider
failure recovery, and sanitized logging.

## Phase 14 — Claims/reviews

Implement claims intake and resolution, evidence, internal ownership, customer
updates, reviews, moderation, and publication controls.

Gate: sensitive-data access, immutable event history, escalation rules,
moderation policy, and response-time reporting.

## Phase 15 — Equipment/inventory

Implement equipment identity, maintenance plans and history, consumable stock,
adjustments, thresholds, and accountability.

Gate: adjustment auditability, maintenance due logic, negative-stock policy,
and operational workflow tests.

## Phase 16 — Analytics

Define source-backed operational and commercial metrics, event provenance,
quality checks, dashboards, and access rules.

Gate: approved metric definitions, reconciled source data, freshness and
quality indicators, and privacy-safe access.

## Phase 17 — SEO/marketing optimisation

Improve technical SEO, structured data, localized discovery, performance,
conversion measurement, content workflows, and experiment governance.

Gate: approved canonical and indexing behavior, structured-data validation,
performance budgets, consent-aware measurement, and content review.

## Phase 18 — Security hardening and production readiness

Complete threat modeling, authorization review, dependency and configuration
hardening, rate limits, CSP, monitoring, backups, recovery exercises, data
retention, incident procedures, load testing, deployment controls, and launch
runbooks.

Gate: no unresolved launch-blocking findings; demonstrated restore, rollback,
monitoring, alerting, and critical user journeys; explicit production approval.
