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

## Public website boundary

The Phase 1 public site is a statically rendered application surface under the
`(public)` route group. Pages consume provider-neutral configuration and typed
localized content through reusable Server Components. Only mobile-navigation
state and the request prototype require Client Components.

The request prototype validates browser `FormData` with a pure Zod module. It
has no form action, Server Action, route handler, fetch, database adapter or
storage adapter. Future persistence must enter through an application use case
and validated server boundary rather than extending the client prototype
directly.

SEO metadata is constructed centrally. Canonical and breadcrumb URLs depend on
a validated `PUBLIC_SITE_URL`; indexing stays disabled when no approved origin
exists. Provider or public-business structured data is emitted only when its
facts are verified.

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
workflow.

## Environment separation

- Local development targets the VAX Neon `development` branch and its `neondb`
  database.
- `.env.local` is ignored, local-only, and must never be committed.
- The Neon `production` branch is not an ordinary development target.
- Future staging and production deployments must inject DATABASE_URL through
  their hosting environment instead of relying on a repository environment
  file.
- Every migration must be reviewed before execution. Production migration
  requires separate explicit authorization.

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

## Replaceable future providers

### Authentication

Authentication is not implemented. Future identity work must expose
application-owned identity and authorization contracts. Provider session,
token, and webhook types stay in an adapter.

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

- authentication provider and session model;
- object-storage provider;
- hosting platform;
- payment, mapping, email, and SMS providers;
- detailed authorization matrix;
- final localization strategy;
- offline technician synchronization;
- analytics stack;
- backup, recovery, and retention targets.

Resolve each decision in its owning phase with a documented acceptance gate.
