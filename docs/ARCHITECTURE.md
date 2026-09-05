# Architecture

## Decision

The system is a modular monolith:

- one application repository;
- one deployable Next.js application;
- one PostgreSQL database;
- clearly owned domain modules;
- explicit adapters around external providers; and
- migrations as the only schema-change mechanism.

Microservices are not part of the current architecture. A module boundary may
be extracted only when measured operational needs justify the added
distribution, consistency, and deployment cost.

## Runtime foundation

- Next.js App Router and React provide the web runtime.
- TypeScript strict mode is mandatory.
- Tailwind CSS provides utility generation; shared visual tokens and primitives
  remain application-owned.
- Zod validates data at trust boundaries.
- PostgreSQL is the durable relational store.
- Drizzle ORM defines typed schema and query integration.
- The Neon serverless driver is the current database transport.
- Vitest covers lightweight unit and contract behavior.

The default Next.js Node.js runtime is used. No Edge runtime dependency is
introduced.

## Repository boundaries

| Location                             | Owns                                                                                                                                                          | Must not own                                                                                                              |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| src/app                              | Routes, layouts, HTTP adaptation, metadata                                                                                                                    | Core business rules                                                                                                       |
| src/components/public                | Reusable public layout and presentation                                                                                                                       | Business persistence or provider access                                                                                   |
| src/config                           | Replaceable public identity and non-secret site facts                                                                                                         | Credentials or final copy ownership                                                                                       |
| src/content/public-site              | Typed localized content, route records and claim controls                                                                                                     | Database state or framework behavior                                                                                      |
| src/modules/service-catalogue        | Provider-neutral canonical catalogue types, codes, labels and capability definitions                                                                          | Database clients, framework behavior or monetary pricing                                                                  |
| src/modules/commercial-engine        | Pure versioned pricing, VAT, duration, snapshot and contribution policies                                                                                     | Next.js, Drizzle, Neon, persistence or public marketing copy                                                              |
| src/modules/availability-engine      | Pure service-area, travel, capacity, slot and utilisation policies                                                                                            | Framework, database, live map provider, customer persistence or dispatch UI                                               |
| src/modules/identity-access          | Stable roles, permissions, authorization and navigation policy                                                                                                | Next.js, provider SDKs, sessions or credentials                                                                           |
| src/modules/customer-crm             | Customer/property validation, record-level access policy, safe projections and use cases                                                                      | Next.js UI, provider identities, credentials, pricing or bookings                                                         |
| src/modules/request-quote            | Request, estimate and quote lifecycle, policy, validation, projections and persistence ports                                                                  | Provider identities, browser authority, booking acceptance, payments or occupancy                                         |
| src/modules/booking-engine           | Quote-acceptance eligibility, Booking authorization/lifecycle, safe projections, idempotency and occupancy adaptation                                         | Provider identities, request renormalization, repricing, Job execution or payments                                        |
| src/modules/scheduling-dispatch      | Staff-reviewed scheduling eligibility, candidate ranking, Sofia time conversion, dispatch readiness, capacity projections and atomic occupancy revision ports | Repricing, request renormalization, CRM repair, user-team membership, provider credentials or Job execution               |
| src/modules/job-execution            | Booking-to-Job provenance, assigned-team access, inspection, treatment, completion, Cleaning Passport and operational analytics policy                        | Provider identities, request/estimate reinterpretation, repricing, CRM repair, scheduling replacement or payments         |
| src/modules/finance-invoicing        | Accepted-commercial invoice eligibility, immutable financial snapshots, finance authorization, exact settlement, payment-allocation and reversal ports        | Repricing, request/CRM repair, provider payment processing, tax advice or accounting export                               |
| src/modules/communications-documents | Exact event projection, communication authorization, bilingual template contracts, immutable rendering, idempotency and portal-publication ports              | Source-domain mutation, CRM repair, repricing, external provider delivery, executable templates or binary storage         |
| src/modules/business-authority       | Versioned environment/effective-time authority, strict evidence/value validation, Owner-controlled lifecycle and derived production readiness                 | Self-asserted system evidence, legal/accounting conclusions, provider mutation, release execution or historical repricing |
| src/modules/public-request           | Public-request validation, safe action state and anonymous intake adaptation                                                                                  | Authentication provisioning, automatic CRM matching, quoting or booking                                                   |
| src/auth                             | Provider-neutral authentication contracts plus server adapters and session/rate-limit boundaries                                                              | Business ownership or provider-managed tables                                                                             |
| src/modules                          | Domain use cases, policies, ports, module contracts                                                                                                           | Provider credentials                                                                                                      |
| src/db                               | PostgreSQL schema, connection adapter, migrations, infrastructure probes                                                                                      | UI behavior                                                                                                               |
| src/lib                              | Small stable cross-cutting utilities                                                                                                                          | Unbounded shared business logic                                                                                           |
| drizzle                              | Generated and reviewed migration artifacts                                                                                                                    | Hand-edited application behavior                                                                                          |
| docs                                 | Product and engineering decisions                                                                                                                             | Runtime state                                                                                                             |

Future business modules should be organized by capability rather than by a
global controllers/services/models split. A typical module may contain domain
types, application use cases, ports, and infrastructure adapters when those
parts become necessary.

## Dependency direction

The intended dependency flow is:

> Next.js transport → application use case → domain policy and port → adapter

Core business rules must not import Next.js, Neon, an authentication SDK, an
object-storage SDK, or payment-provider types.

The Phase 0A health module is intentionally an infrastructure endpoint and may
call the database health probe directly; it is not a business-domain pattern.

Phase 3A follows the normal direction: auth routes and Server Actions call the
provider-neutral authentication boundary, application authorization loads its
own profile and permission state, and only the centralized adapter imports the
Neon Auth SDK.

Phase 3B keeps the same direction for privileged administration: nested routes
and Server Actions call the pure identity-administration service, whose
repository port requires atomic mutation-and-audit behavior. The PostgreSQL
adapter revalidates actor, target, role and last-owner state. A separate
provider-neutral privileged-auth contract exposes capability state and safe
projections; only the Neon adapter may call Better Auth Admin APIs. Application
roles never become provider roles, and provider identifiers never become route
identifiers.

Phase 3C applies that direction to business records. Staff and linked-customer
routes call a customer-CRM service whose actor-aware repository rechecks the
current application profile, permissions and full ownership chain. Route IDs
and hidden form fields are untrusted selectors, not authority. Staff and
customer projections are separate types so internal summaries, access notes,
operational notes and link-administration metadata cannot enter the customer
self-service response accidentally. Provider subjects and email equality are
never business-ownership inputs.

Phase 3D extends the same direction through `src/modules/request-quote`.
Anonymous, linked-customer and staff transports call validated use cases; the
PostgreSQL repository repeats source, actor, permission, active-link, CRM graph,
lifecycle and optimistic-version checks. Public contact details are submission
data, never identity or customer-link authority. Staff reads require both CRM
and operations read permissions, while staff mutations require both matching
manage permissions. Customer reads and submissions require the own-record
permission plus the exact active identity/customer link. Request, staff and
customer projections remain distinct so original contact facts, staff notes,
draft quotes and internal estimate details cannot cross the wrong boundary.

Phase 3E adds `src/modules/booking-engine`. Customer and staff transports call
provider-neutral Booking policy and use cases; the PostgreSQL repository
rechecks permissions, current identity links and the entire immutable
quote/request/estimate/CRM provenance graph. The acceptance write never calls
normalization, pricing, duration or CRM repair. It atomically inserts
acceptance, Booking, copied items and Booking audit evidence, or fails closed
with no partial state. Scheduling remains a separate later command and must use
database-backed occupancy constraints rather than trusting a preview.

Phase 3F adds `src/modules/job-execution`. Staff and assigned-technician
transports call provider-neutral Job policy and use cases; the PostgreSQL
repository rechecks current permissions, exact time-valid team membership,
Booking/occupancy state and immutable issued-quote provenance. Job creation
copies planned scope only from the Booking chain and the Quote's
`acceptance_source_snapshot`; it never invokes request normalization, pricing,
duration calculation or CRM repair. Inspection, treatment and completion keep
planned, observed, confirmed and performed facts distinct. Completion and
eligible Cleaning Passport creation are one atomic database operation.

Phase 3G adds `src/modules/scheduling-dispatch`. Protected scheduling routes
call provider-neutral policy and use cases; the PostgreSQL adapter locks and
revalidates the Booking, current occupancy, team, capability, equipment,
working-hour, travel and adjacent-occupancy boundaries. Candidate previews are
advisory and version-bound. Only the atomic confirmation operation can append
an occupancy, update the Booking and write audit evidence. It consumes frozen
operational requirements derived exclusively from immutable Booking and
issued-Quote evidence and never calls normalization, pricing, duration or CRM
repair. Staff, technician and customer schedule projections remain separate.

Phase 3H adds `src/modules/finance-invoicing`. Staff and linked-customer
transports call provider-neutral finance policy and use cases; the PostgreSQL
repository repeats current profile, permission, customer-link, lifecycle,
configuration and exact provenance checks. Invoice creation copies the accepted
Quote/Booking commercial and line evidence without invoking normalization,
pricing or CRM repair. Issue revalidates that entire graph and serializes the
approved numbering counter. Payment recording remains separate from explicit
confirmation, and allocation/reversal use an append-oriented, database-guarded
ledger. Customer and staff projections remain distinct.

Phase 3I adds `src/modules/communications-documents`. Authorized staff
explicitly materialize one eligible owning audit event; there is no automatic
table observer or provider send. The service resolves an allowlisted
customer-safe projection, exact locale and active template, then the PostgreSQL
repository rechecks the actor, source-domain permission conjunction, source and
audit provenance, active customer/contact, preference and template before one
atomic write creates the final document and local portal history. Linked-
customer reads require the exact active identity/customer link. Source records
are never repaired, recalculated or reinterpreted during materialization.

Phase 3N adds `src/modules/business-authority`. The registry owns stable
readiness keys, evidence classes, conceptual authority requirements and strict
value schemas. The service owns proposal/review/approval policy and derives
readiness from current environment-scoped effective records; the PostgreSQL
adapter atomically binds every state transition to append-only evidence. It
does not mutate the commercial, scheduling, finance or provider modules.
Runtime mutation batches establish a fresh transaction-local HMAC binding over
the application profile, provider subject, correlation IDs and issue time. A
database assertion validates it against a protected purpose-derived key and
rechecks the live profile/provider/Owner relationship; missing or stale context
fails closed. The key is derived from, but domain-separated from, the Auth
cookie secret and is installed only through the migrator path.
Configuration references remain blocked unless trusted resolution matches the
exact type, code, version and content digest. A production GO is additionally
bound to the exact release commit, target, active change window and canonical
dependency fingerprint. Existing immutable domain snapshots remain the only
history authority.

## Public website boundary

The Phase 1A public site is a statically rendered bilingual application
surface. Unprefixed routes under `(public)` are Bulgarian, the primary
commercial locale; matching routes under `(public-en)/en` are English. Thin
route adapters pass a locale to shared page and presentation components, while
an exact typed content contract prevents either language from silently falling
back to the other. Separate root layouts give each document an accurate
`<html lang>` value. No browser-language redirect or locale cookie changes URL
selection.

Pages consume provider-neutral configuration and typed localized content
through reusable Server Components. Mobile-navigation state, corresponding
page language switching and accessible request-form interaction use Client
Components; persistence remains behind a Server Action and application use
case.

Phase 1's browser-only request prototype is historical. Phase 3D now validates
the public `FormData` again on the server, applies bounded anonymous-intake
abuse controls, and calls the request application boundary. It stores an
immutable original-submission snapshot and returns only a random customer-safe
reference. The public boundary does not authenticate, infer an existing
customer from contact details, calculate a public price, create a quote or
booking, upload a file, or expose a database/provider credential.

SEO metadata is constructed centrally. Canonical, `hreflang`, sitemap and
breadcrumb URLs depend on a validated `PUBLIC_SITE_URL`; indexing stays
disabled when no approved origin exists. Bulgarian is `x-default`, and Open
Graph locale values match each document. Provider or public-business structured
data is emitted only when its facts are verified.

Marketing claims are another trust boundary. The typed claim registry and
`docs/CONTENT_AUTHORITY.md` distinguish verified, qualified,
manufacturer-evidence-dependent, legally dependent and prohibited statements.
That classification remains static content governance in Phase 1A rather than
a database capability.

## Service catalogue boundary

Phase 2 uses `src/modules/service-catalogue/catalogue.ts` as the provider-neutral
source for stable service, item, measurement, material, condition, issue, risk,
treatment and capability codes. Public static consumers may import this module;
it imports neither Drizzle nor Neon. `src/db/schema/service-catalogue.ts` owns
the relational persistence shape, and the database seeder adapts canonical
definitions to those tables.

This deliberate duplication boundary is representation, not authority: domain
definitions own meaning, Drizzle owns columns and constraints, and the seeder
maps between them. Public marketing wording may differ from canonical display
labels, but every public service record carries its stable catalogue code.
Actual product records and later operational duration values are future
controlled admin data, not static public content.

## Commercial engine boundary

Phase 2A keeps commercial calculation in `src/modules/commercial-engine`. Exact
money is represented as integer EUR cents, percentages and VAT as basis points,
and measured area as hundredths of a square metre. The engine consumes plain
versioned configuration and returns explainable lines, provenance identifiers,
warnings and manual-assessment flags. It imports no framework or provider.

Pricing and duration are independent calculations. Technical treatment level
does not map directly to a commercial tier. The initial configuration is an
inactive development fixture used by the database bootstrap and local internal
lab; versioned database records are the future commercial value authority.

`/internal/pricing-lab` uses a Server Component page for no-index metadata and a
small Client Component for local interactivity. It has no server mutation,
database import or public navigation link. The shared internal layout returns
not-found outside the Next.js development server. Route-level and robots
controls remain defense in depth, and any deliberately deployed internal tool
still requires authentication and authorization.

## Availability engine boundary

Phase 2B keeps service-area, location, travel, capacity, slot and utilisation
logic in `src/modules/availability-engine`. PRICE, DURATION, TRAVEL and
AVAILABILITY remain separate computations. The engine consumes plain typed
configuration and ephemeral occupancy and has no framework, database or maps
SDK dependency.

The travel port can later be implemented by a geocoding/routing provider. The
current synchronous estimator uses a versioned deterministic fallback matrix,
returns no fabricated distance and identifies every result as a development
assumption. Provider selection and credentials remain deferred.

The Phase 2A duration total already includes setup, inspection, cleaning,
cleanup and handover. Availability adds only neighbouring travel, one
independent buffer per transition and explicit caller-provided parking time.
Phase 2B persists no scheduling block or reservation. Phase 3E adds a separate
durable occupancy schema and adapter contract, but acceptance writes no
occupancy because approved scheduling configuration and frozen operational
requirements are absent.

`/internal/availability-lab` follows the same Server/Client split and exposure
rules as the pricing lab. It is a local browser calculator with no mutation,
database import or public link. The shared internal Server Component layout
returns not-found unless Next.js is running in development, while no-index and
public-boundary checks remain defense in depth. Draft team codes, routes and
utilisation must not cross into public components.

## Request, estimate and quote boundary

Phase 3D persists a controlled transaction chain without turning it into a
booking engine:

> Service Request → append-only Estimate → staff-reviewed versioned Quote

The request retains the validated original submission separately from staff's
structured normalization. Request items may reference the catalogue, existing
CRM assets, relational issues and add-ons, but normalization never rewrites the
original facts. State changes and mutable structured scope use database-side
authorization plus optimistic versions.

Each estimate is a new version. It stores complete price and duration input and
result snapshots, advisory service-area/configuration readiness, exact
configuration identities, the resulting request version and searchable integer
totals; earlier estimates are not recalculated or edited. Provisional or
incomplete engine output fails closed to manual review and is never shown as an
automatic public price.

Quote drafts are staff-only mutable records. Issue freezes the commercial
scope, item descriptions, totals, terms, validity, source request version and
estimate provenance. A request change makes an older draft stale.
Revisions create a new quote version, and issuing a replacement supersedes the
prior issued version atomically. Request-row locking, optimistic record
versions, unique per-request versions and one active issued quote per request
protect concurrent writes. Linked customers can read issued history for their
exact customer only; they cannot read drafts, internal estimates or staff
notes. Phase 3D has no acceptance command, booking, payment, invoice,
notification, document generation, occupancy or reservation. The complete
contract is in `docs/REQUEST_AND_QUOTE.md`.

## Quote acceptance and Booking boundary

Phase 3E extends the chain without changing Phase 3D source authority:

> immutable issued Quote → immutable Quote Acceptance → Booking

Acceptance revalidates lifecycle, `[valid_from, valid_until)` validity,
authorization, customer/property ownership, request/estimate versions,
commercial snapshot identities and digest, exact totals and the quote-item
graph in one locked database operation. It does not reinterpret reported data,
renormalize staff scope, recalculate price/duration or silently substitute
mutable CRM facts into source provenance. Any inconsistency fails closed to
staff review.

The quote remains `ISSUED` and the request remains `QUOTED`; the unique
acceptance relation is authoritative. A successful operation atomically writes
acceptance, `PENDING_SCHEDULING` / `REVIEW_REQUIRED` Booking, copied item
snapshots and two audit events. Preferred window is not an exact slot, and no
team, equipment, time or occupancy is fabricated.

The `booking_occupancies` persistence seam supports one team, optional
equipment and append-oriented policy/travel/availability evidence. PostgreSQL
GiST exclusion constraints use half-open `[)` operational ranges and block
concurrent overlap for the same team or equipment while status is `PENDING` or
`CONFIRMED`. Cancellation retains the row but releases capacity by changing it
to `CANCELLED`. Future scheduling and rescheduling must append audited snapshot
versions, preserve prior occupancy and never alter accepted commercial
evidence. See `docs/BOOKING_ENGINE.md`.

## Job execution and Cleaning Passport boundary

Phase 3F extends the operational chain without weakening Phase 3D or Phase 3E
source authority:

> Booking + immutable issued-Quote snapshot → Job → inspection → confirmed
> treatment → performed treatment → completion → Cleaning Passport

Exactly one Job may consume a Booking. Creation uses the Booking, Booking
items, Quote Acceptance and the immutable issued-Quote
`acceptance_source_snapshot`. Current request, estimate and mutable CRM facts
are not fallback scope inputs. Current CRM may be checked only for ownership
integrity and may supply a separate purpose-limited visit-contact snapshot. A
malformed or inconsistent commercial, request, CRM or provenance chain fails
closed with no Job write.

An exact current `CONFIRMED` Booking occupancy that matches the Booking's
schedule, team and equipment may produce a `READY` Job. Otherwise a
provenance-valid Booking produces only `PREPARED` with explicit review reasons;
the Job cannot enter field execution. Team assignment may bind only to that
exact occupancy and does not reschedule or replace it.

Assigned-technician access is derived from a current active `TECHNICIAN` role,
the field-job permissions and an exact time-valid membership in the Job's
assigned operations team. Staff and technician projections are separate, so
prices, estimate internals, unrelated CRM history and administrative data do
not enter the field view.

Inspection records professional observed facts without rewriting customer-
reported or staff-normalized scope. Treatment plans use canonical technical
references and only add-ons already authorized by the issued Quote. Material
scope change, unsafe or specialist evidence, or performed-versus-confirmed
divergence moves the item or Job to review, decline or referral instead of
silently changing or repricing work.

Job completion derives actual productive and occupied-team time from server
timestamps and atomically freezes completion, audit and eligible asset history.
A Cleaning Passport entry exists only for an asset-linked treatment actually
completed within the confirmed plan; inspection-only, declined, referred,
review-required and unperformed work creates no treatment history. Customer-
safe history and staff operational history remain separate projections. See
`docs/JOB_EXECUTION.md`.

## Scheduling and dispatch boundary

Phase 3G completes the first operational schedule transition without changing
commercial or execution authority:

> accepted Booking → explicit operational review → candidate preview → exact
> confirmed occupancy → dispatch readiness → eligible Job

The persisted Booking scheduling vocabulary remains `UNSCHEDULED`,
`REVIEW_REQUIRED` and `SCHEDULED`; reschedule-required is a derived readiness
condition. Reviewed operational requirements are frozen only from the immutable
Booking, Booking items and issued-Quote acceptance snapshot. Exact DRAFT policy
versions may be used in development only with visible provisional, fallback
and manual-review labels. They do not become approved production rules.

`booking_occupancies` is both the blocking capacity record and append-oriented
schedule revision history. Rescheduling cancels the prior blocking version and
inserts a linked replacement atomically; it does not mutate prior evidence or
create a second calendar table. A `READY` Job prevents silent rescheduling and
requires explicit staff review. PostgreSQL GiST constraints over half-open
operational ranges remain the final same-team and same-equipment race guard.

The staff board, technician-today and linked-customer appointment surfaces use
different projections and authorities. Technician access still requires exact
time-valid team membership. Customer views expose their own confirmed
appointment but never team workload, equipment or travel internals. All Sofia
local scheduling input is converted to an absolute instant under explicit DST
rules. See `docs/SCHEDULING_AND_DISPATCH.md`.

## Finance and invoicing boundary

Phase 3H adds a settlement layer without changing the authority of the earlier
commercial and operational records:

> immutable accepted Quote/Booking evidence → review-gated Invoice → issued
> financial snapshot → confirmed Payment → append-oriented allocation

An invoice is neither a recalculated Quote nor an editable Job total. Draft
creation and issue lock and validate the exact Quote Acceptance, Booking,
Booking items, issued Quote and Quote items. Current customer billing, seller,
numbering and invoice-policy records are independently versioned approval
gates. They cannot change accepted amounts. If source provenance, billing/VAT
state, configuration or a completion-required Job differs, the operation fails
closed to finance review rather than refreshing or repairing it.

Job-completed draft eligibility creates no Invoice before completion. A policy
that allows the draft at Booking acceptance but requires completion for issue
may preserve only an immutable completion-waiting draft; later issue must
revalidate the full graph and cannot clear unrelated review state or refresh
the snapshot.

Money stays in integer EUR minor units and VAT in integer basis points. Invoice
items preserve frozen bilingual descriptions, measurement and source-item
relationships. Issue allocates one non-reusable number through the locked
environment-specific counter. Issued documents and their commercial/legal
snapshots are immutable; settlement changes only through payment allocations.
`OVERDUE` is a date-derived display state, not a background rewrite.

A payment is a manual record of an external event, not provider verification.
It must move from `RECORDED` to explicitly `CONFIRMED` before allocation. The
ledger prevents cross-customer/currency and over-allocation writes, supports
partial/full settlement and leaves excess value unapplied. Reversal appends a
payment-reversal fact plus compensating allocations and restores invoice
balances atomically; it does not delete history or execute a refund.

Staff finance/dashboard and linked-customer invoice routes use separate
permission and projection boundaries. There is no live gateway, card
processing, bank API, fiscal-device automation, accounting export, full
credit-note/refund workflow or compliance claim. See
`docs/FINANCE_AND_INVOICING.md`.

## Communications and documents boundary

Phase 3I adds a customer-safe publication layer without becoming a new source
of Quote, Booking, Job or finance truth:

> immutable owning event → explicit staff materialization → intent → immutable
> render snapshot → local portal result → customer history

The event's existing business, Booking, Job or finance audit row remains the
event authority. Communication intent columns and restrictive composite
foreign keys bind the exact source, customer, source version, schedule
occupancy where applicable and template version. Missing or inconsistent
authority fails closed to staff review. No source domain is renormalized,
repriced, rescheduled, repaired or refreshed.

Templates are bilingual, versioned plain text with exact allowlisted variable
contracts. Rendering creates a validated structured `HTML_PRINT` snapshot and
a SHA-256 checksum bound to the template, locale, renderer and content. Final
documents and delivery/history records are immutable or append-only. Customer
projections expose only final/superseded documents with a matching local portal
publication and an exact active identity/customer link.

`DELIVERED_LOCAL` means published in the VAX portal; it is not external delivery
or customer-read evidence. Email/SMS adapters, manual free-form messages,
provider callbacks/retries, binary PDF/object storage, automatic event
materialization, production migration and deployment remain deferred. See
`docs/COMMUNICATIONS_AND_DOCUMENTS.md`.

## Database boundary

src/db/client.ts is the single connection construction point. It:

- obtains only the `vax_runtime` `DATABASE_URL` through validated environment
  access;
- constructs the current Neon HTTP client lazily;
- gives Drizzle the schema;
- avoids opening a connection during import or production build; and
- prevents provider setup from spreading into business modules.

The current Neon HTTP adapter supports the bounded transactions used by the
CRM, request/Quote, Booking, Job, finance, communications and Business
Authority repositories.
Transactional invariants stay in the database adapter rather than the domain policy. If a
later workflow requires interactive session semantics that the HTTP transport
cannot provide, the adapter may change without changing domain rules.

Migration tooling constructs a separate client from
`MIGRATION_DATABASE_URL`, requires `vax_migrator`, and rechecks the live Neon
project/branch/database before mutation. Administrative role provisioning is a
separate development-only script and never enters the application runtime
dependency graph. Phase 3K RLS is role/command scoped, not actor-row scoped;
the rationale and complete DML matrix are in `docs/DATABASE_SECURITY.md`.

Drizzle schema definitions are the source for generated migrations. Generated
SQL must be reviewed before application. Schema push is not the production
workflow. Code-controlled catalogue rows are upserted deterministically after
migration. Versioned commercial books/rules and versioned availability
profiles/rules use insert-only seed behavior so existing versions are not
rewritten. The seed contains no customers, quotes, bookings, jobs, payments,
invoices, seller legal identity, customer billing identity, bank details,
actual product claims or production records.

Phase 3A canonical roles, permissions and mappings are also code-controlled and
deterministically seeded. Application profiles, role assignments and sanitized
security events are runtime records. They are separate from both provider-owned
identity and future CRM/customer data. Canonical seed reruns refresh code-owned
labels and mappings but preserve an operator-disabled role or permission; only a
future explicit audited administration flow may reactivate it.

Phase 3C runtime CRM records are operator/customer data, not deterministic seed
data. They use UUID identities, restrictive ownership foreign keys,
archive/inactive lifecycle state and application-profile actor metadata. The
stable cleaning-asset UUID is the attachment point for later inspection,
treatment, completed-job and maintenance history; Phase 3C creates none of
those events. The existing security audit stream remains identity-specific and
is not repurposed as a general business audit log.

Phase 3D request, estimate and quote rows are runtime transaction data and are
never seeded. Restrictive ownership and provenance foreign keys preserve their
relationship to CRM, catalogue, commercial configuration and application
actors. `business_audit_events` is a separate append-oriented stream for
allowlisted request/estimate/quote changes; it does not replace
`auth_audit_events`, and application code exposes no ordinary update or delete
operation for it. Database-level append-only grants and reviewed production
least privilege remain a deployment gate.

Phase 3E acceptance, Booking, item, occupancy and Booking-audit rows are runtime
transaction data and are never seeded. Restrictive composite foreign keys and
unique constraints preserve exact issued-quote provenance and idempotency.
`btree_gist` exclusion constraints are the final concurrent-writer boundary for
team/equipment overlap. The acceptance flow creates no occupancy or confirmed
slot; a later scheduling adapter must supply reviewed immutable operational
snapshots and remain transactionally guarded.

Phase 3F team-membership, Job, item, inspection, treatment, Cleaning Passport
and Job-audit rows are runtime operational data and are never seeded.
Restrictive composite foreign keys preserve the exact Booking, occupancy,
asset, inspection, plan and execution graph. Jobs and their items copy no
commercial amount. `cleaning_passport_entries` and `job_audit_events` are
append-oriented; ordinary application code exposes no update/delete path for
them. Reviewed production grants, RLS and database-level append-only
enforcement remain a deployment gate.

Phase 3H customer-billing, seller, invoice-policy, numbering, Invoice, item,
Payment, allocation, reversal and finance-audit rows are application-owned.
Configuration is versioned and environment-scoped; runtime financial records
are never seeded. Composite restrictive keys preserve the exact
Quote/Acceptance/Booking/Job and customer/currency graph. Unique counters,
optimistic versions, row locks, arithmetic checks and append-oriented ledger
facts protect issue and settlement races. Issued Invoice/item history, approved
configuration used by history, allocations, reversals and finance audit are not
ordinary mutable records. Production runtime grants, RLS and append-only
enforcement remain a separate deployment gate.

Phase 3N Business Authority rows are runtime governance records, not seeds.
Their typed payload, evidence, environment and effective window are immutable;
only the correlated status/record-version transition may change. Each
transition has one append-only audit fact with an active Owner role snapshot.
The database prevents staging/production approval mismatch and runtime system-
evidence self-assertion. The derived package reads these facts but performs no
release operation.

ATTELIER finalization preserves that boundary. The business-authority
repository composes one narrow code-owned resolver that returns only approved
allowlisted staging configuration snapshots. The request/estimate service
selects the separate ATTELIER price/duration definitions only for explicit
staging; development keeps the original fixtures and production fails closed.
Unresolved VAT can preserve gross commercial provenance but cannot satisfy
issued-Quote or finance invariants.

Repository migrations run through the node-postgres migrator transaction so
the ordered pending migration set and ledger writes commit or roll back
together. Secret-derived verifier provisioning is an explicit post-migration
operator step rather than secret-bearing SQL; authority mutations remain
unavailable until that guarded step succeeds.

## Environment separation

- Local development targets the VAX Neon `development` branch and its `neondb`
  database.
- Phase 3L staging targets the isolated Neon `staging` branch and `neondb`
  through separate runtime/migrator credentials and branch-specific Auth.
- Finance and Business Authority services resolve their environment from the
  explicit validated `VAX_ENVIRONMENT` boundary. Hosted staging and production
  fail closed if it is absent, blank or unsafe. A hosted staging production
  build is still `STAGING`; `NODE_ENV` never promotes its records to
  `PRODUCTION`.
- `.env.local` is ignored, local-only, and must never be committed.
- `.env.staging.local` is also ignored, requires owner-only permissions and is
  accepted only by dedicated staging commands. A separate ignored owner-only
  `.env.staging.target.local` contains independently reviewed database and Auth
  target assertions; credentials cannot authorize their own target. Omitted
  managed values are cleared rather than inherited from the ambient process.
  Hosted staging must preserve
  the same separation in a secret manager.
- The Neon `production` branch is not an ordinary development target.
- Future hosted staging and production deployments must inject separate runtime
  and migration credentials through their hosting environment instead of relying
  on a repository environment file. Authentication deployments must likewise
  inject branch-specific Auth endpoint and cookie-secret configuration.
- Every migration must be reviewed before execution. Production migration
  requires separate explicit authorization.
- Current mutation scripts additionally require an explicit approved
  nonproduction label plus the exact project, branch, hostname, database and
  role; development-only scripts reject staging, and none are production tools.

## Health flow

GET /api/health retains the compatibility connectivity path. Phase 3L adds:

1. `/api/liveness`, which proves only that the application process responds;
2. `/api/readiness`, which validates safe configuration, the exact runtime
   identity, database connectivity, the exact migration ledger through 0018,
   the 100-table contract and operational rate-limit schema, shared-limit
   privilege, Auth availability and staging email state; and
3. a 503 readiness result whenever any required category is not ready.

Raw errors, stack traces, hostnames, usernames, schema names, provider details
and connection values do not cross the HTTP boundary. Responses are no-store.
The reporter boundary accepts only safe structured fields; a hosted monitoring
provider is deliberately not selected in Phase 3L.

Local staging separates the ignored credential/runtime file from an
independently reviewed owner-only target manifest. Only the manifest loader can
mint the opaque staging mutation authorization passed to migration, security,
state, rebuild and rotation commands; runtime Next.js receives neither file's
operator authority. The local launcher binds both its pooled runtime database
and canonical Auth base URL to that manifest before spawn.

## Replaceable providers

### Authentication

Phase 3A uses Neon Auth's managed Better Auth integration. Application code
depends on `AuthenticatedUser`, `Session`, `UserId`, privileged capability
contracts and permission policy; provider session, Admin API and token shapes
stay inside `src/auth/neon-provider.ts` and its projection helper.
Provider-managed `neon_auth`, application `user_profiles`, and CRM customer
records are separate ownership boundaries. Implemented customer, request,
quote, acceptance, Booking, Job, Cleaning Passport, finance and communications
authorization remains application-owned and never changes the provider schema.
See
`docs/IDENTITY_AND_ACCESS.md`, `docs/REQUEST_AND_QUOTE.md`,
`docs/BOOKING_ENGINE.md`, `docs/JOB_EXECUTION.md` and
`docs/FINANCE_AND_INVOICING.md`, plus
`docs/COMMUNICATIONS_AND_DOCUMENTS.md`.

### Object storage

PostgreSQL may store attachment metadata, ownership, checksums, and object keys.
Actual binary files and photos must live in a separate object-storage system.
Storage access must be mediated through an application-owned port.

### Communications, maps, and payments

Email, SMS, mapping, and payment providers must follow the same adapter rule.
Provider-specific webhooks terminate at transport adapters and are converted to
validated internal commands. Phase 3H implements no payment adapter or webhook;
its `CARD_MANUAL_REFERENCE` value records only a staff-entered external fact.
Phase 3I implements only the application-owned `PORTAL_LOCAL` adapter. A local
portal publication is not an email/SMS/provider delivery receipt. Future
channels remain disabled and provider-free until separately approved.

## Cross-cutting requirements

- Validate HTTP input, environment configuration, external events, and imported
  data.
- Authorize every protected use case, not only navigation.
- Use UTC instants for stored events and explicit local zones for scheduling.
- Record critical state changes and privileged actions in their owning audit
  stream; Phase 3D covers request/estimate/quote events and Phase 3E covers
  acceptance, Booking creation and cancellation. Phase 3G extends the Booking
  stream with reviewed scheduling, rescheduling, assignments, review and
  occupancy-release evidence. Phase 3F separately covers Job lifecycle,
  inspection, treatment, completion and Cleaning Passport creation. Phase 3H
  separately covers Invoice, Payment, allocation, reversal and settlement.
  Phase 3I separately covers communication intent, rendering, local portal
  publication and preference changes.
- Preserve the implemented Booking, finance and communication idempotency
  boundaries before adding provider webhooks or retry workers.
- Avoid irreversible deletes for records that contribute to service history.
- Implement accessible, responsive loading, empty, error, and recovery states.

## Deferred decisions

The following remain deliberately undecided:

- production authentication email, trusted-origin and distributed rate-limit configuration;
- object-storage provider;
- hosting platform;
- live-payment, live-routing, email, and SMS providers;
- binary PDF rendering/storage, provider delivery receipts and customer-open
  tracking;
- automatic communication materialization, external retry/suppression policy
  and legally reviewed contact/consent handling;
- privileged identity administration and organization scope;
- customer merge/shared-household/company authority and production CRM retention workflows;
- final commercial identity and owner-approved content workflow;
- offline technician synchronization;
- analytics stack;
- production service-zone, working-hour, travel, team-capacity and equipment
  approval;
- backup, recovery, and retention targets; and
- qualified accountant/legal approval of seller/VAT, numbering, invoice,
  credit-note, refund, cash/fiscal-device and accounting-export policy.

Resolve each decision in its owning phase with a documented acceptance gate.
