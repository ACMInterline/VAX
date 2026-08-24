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

| Location | Owns | Must not own |
| --- | --- | --- |
| src/app | Routes, layouts, HTTP adaptation, metadata | Core business rules |
| src/components/public | Reusable public layout and presentation | Business persistence or provider access |
| src/config | Replaceable public identity and non-secret site facts | Credentials or final copy ownership |
| src/content/public-site | Typed localized content, route records and claim controls | Database state or framework behavior |
| src/modules/service-catalogue | Provider-neutral canonical catalogue types, codes, labels and capability definitions | Database clients, framework behavior or monetary pricing |
| src/modules/commercial-engine | Pure versioned pricing, VAT, duration, snapshot and contribution policies | Next.js, Drizzle, Neon, persistence or public marketing copy |
| src/modules/availability-engine | Pure service-area, travel, capacity, slot and utilisation policies | Framework, database, live map provider, customer persistence or dispatch UI |
| src/modules/identity-access | Stable roles, permissions, authorization and navigation policy | Next.js, provider SDKs, sessions or credentials |
| src/modules/customer-crm | Customer/property validation, record-level access policy, safe projections and use cases | Next.js UI, provider identities, credentials, pricing or bookings |
| src/auth | Provider-neutral authentication contracts plus server adapters and session/rate-limit boundaries | Business ownership or provider-managed tables |
| src/modules | Domain use cases, policies, ports, module contracts | Provider credentials |
| src/db | PostgreSQL schema, connection adapter, migrations, infrastructure probes | UI behavior |
| src/lib | Small stable cross-cutting utilities | Unbounded shared business logic |
| drizzle | Generated and reviewed migration artifacts | Hand-edited application behavior |
| docs | Product and engineering decisions | Runtime state |

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
through reusable Server Components. Only mobile-navigation state, corresponding
page language switching, and the request prototype require Client Components.

The request prototype validates browser `FormData` with a pure Zod module. It
has no form action, Server Action, route handler, fetch, database adapter or
storage adapter. Future persistence must enter through an application use case
and validated server boundary rather than extending the client prototype
directly.

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
No scheduling block or reservation is persisted. The future occupancy contract
defines the immutable scheduling provenance a later booking adapter must supply.

`/internal/availability-lab` follows the same Server/Client split and exposure
rules as the pricing lab. It is a local browser calculator with no mutation,
database import or public link. The shared internal Server Component layout
returns not-found unless Next.js is running in development, while no-index and
public-boundary checks remain defense in depth. Draft team codes, routes and
utilisation must not cross into public components.

## Database boundary

src/db/client.ts is the single connection construction point. It:

- obtains DATABASE_URL through validated environment access;
- constructs the current Neon HTTP client lazily;
- gives Drizzle the schema;
- avoids opening a connection during import or production build; and
- prevents provider setup from spreading into business modules.

Neon HTTP is appropriate for the current one-shot health query. If later use
cases require interactive transactions or session semantics, the adapter may
change without changing domain rules.

Drizzle schema definitions are the source for generated migrations. Generated
SQL must be reviewed before application. Schema push is not the production
workflow. Code-controlled catalogue rows are upserted deterministically after
migration. Versioned commercial books/rules and versioned availability
profiles/rules use insert-only seed behavior so existing versions are not
rewritten. The seed contains no customers, quotes, bookings, jobs, payments,
invoices, actual product claims or production records.

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

## Environment separation

- Local development targets the VAX Neon `development` branch and its `neondb`
  database.
- `.env.local` is ignored, local-only, and must never be committed.
- The Neon `production` branch is not an ordinary development target.
- Future staging and production deployments must inject DATABASE_URL through
  their hosting environment instead of relying on a repository environment
  file. Authentication deployments must likewise inject branch-specific Auth
  endpoint and cookie-secret configuration.
- Every migration must be reviewed before execution. Production migration
  requires separate explicit authorization.
- Current mutation scripts additionally require an explicit development label
  and exact approved database hostname; they are not production migration tools.

## Health flow

GET /api/health follows this path:

1. The route delegates to the health response module.
2. The module calls the database connectivity probe.
3. The probe executes a constant SELECT 1 query.
4. Success maps to HTTP 200, status ok, database connected.
5. Any configuration or connectivity failure maps to HTTP 503, status
   degraded, database unavailable.

Raw errors, stack traces, hostnames, usernames, and connection values do not
cross the HTTP boundary. The response is marked no-store.

## Replaceable providers

### Authentication

Phase 3A uses Neon Auth's managed Better Auth integration. Application code
depends on `AuthenticatedUser`, `Session`, `UserId`, privileged capability
contracts and permission policy; provider session, Admin API and token shapes
stay inside `src/auth/neon-provider.ts` and its projection helper.
Provider-managed `neon_auth`, application `user_profiles`, and future customer
records are separate ownership boundaries. See `docs/IDENTITY_AND_ACCESS.md`.

### Object storage

PostgreSQL may store attachment metadata, ownership, checksums, and object keys.
Actual binary files and photos must live in a separate object-storage system.
Storage access must be mediated through an application-owned port.

### Communications, maps, and payments

Email, SMS, mapping, and payment providers must follow the same adapter rule.
Provider-specific webhooks terminate at transport adapters and are converted to
validated internal commands.

## Cross-cutting requirements

- Validate HTTP input, environment configuration, external events, and imported
  data.
- Authorize every protected use case, not only navigation.
- Use UTC instants for stored events and explicit local zones for scheduling.
- Record critical state changes and privileged actions in future audit logs.
- Design idempotency before adding bookings, payments, messages, or webhooks.
- Avoid irreversible deletes for records that contribute to service history.
- Implement accessible, responsive loading, empty, error, and recovery states.

## Deferred decisions

The following remain deliberately undecided:

- production authentication email, trusted-origin and distributed rate-limit configuration;
- object-storage provider;
- hosting platform;
- payment, mapping, email, and SMS providers;
- privileged identity administration and organization scope;
- customer merge/shared-household/company authority and production CRM retention workflows;
- final commercial identity and owner-approved content workflow;
- offline technician synchronization;
- analytics stack;
- backup, recovery, and retention targets.

Resolve each decision in its owning phase with a documented acceptance gate.
