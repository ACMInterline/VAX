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

Convert an explicitly accepted Phase 3D quote into a booking, then add
availability selection, confirmation, amendments, cancellation and
idempotency without duplicating the quote's commercial provenance.

Gate: pricing provenance, concurrency handling, customer confirmations,
failure recovery, and end-to-end booking tests.

## Phase 7 — Calendar, availability and dispatch

Build the durable calendar and dispatch workflow on the Phase 2B calculation
foundation: persisted occupancy, holds, calendar views, dispatch queues,
assignments, audited overrides and concurrent conflict handling.

Gate: Sofia time-zone and daylight-saving tests, concurrency rules, override
audit logs, and dispatcher workflow validation.

## Phase 8 — Technician workspace

Implement mobile-first assigned-work views, arrival and progress states,
offline and sync strategy, task guidance, issue escalation, and completion
checks.

Gate: field-device browser testing, accessible touch interactions, retry and
sync behavior, and permission isolation.

## Phase 9 — Inspection and treatment workflow

Implement inspections, item condition, materials, stains, existing damage,
treatment plans, products used, technician notes, evidence, and customer
acknowledgement where required.

Gate: history integrity, safe treatment guidance ownership, media controls,
customer acknowledgement, and audited amendments.

## Phase 10 — Customer portal

Expand the secure customer surface beyond Phase 3D's request submission and
issued-quote read access to appointments, documents, messages and relevant
service status.

Gate: object-level authorization, privacy review, responsive accessibility,
empty and error states, and account-recovery behavior.

## Phase 11 — Digital Cleaning Passport/history

Assemble durable item history from bookings, inspections, treatments, photos,
completed cleanings, and care recommendations without duplicating source facts.

Gate: provenance, timeline correctness, amendment rules, export controls, and
multi-visit scenario tests.

## Phase 12 — Payments/invoices

Implement payment-provider adapters, payment and refund state, invoices,
discount approvals, reconciliation, webhooks, and customer documents.

Gate: exact money handling, idempotent webhook processing, reconciliation,
permission controls, audit logs, and financial review.

## Phase 13 — Communications/notifications

Implement template ownership, customer messages, notification preferences,
email and SMS adapters, delivery status, retries, and opt-out controls.

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
