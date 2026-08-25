# Service Platform Foundation

Production-oriented service-platform foundation with an isolated development
database, a bilingual public website, a canonical service catalogue, a
versioned development commercial engine, a non-transactional scheduling
capacity foundation, secure identity/RBAC, customer/property CRM records and a
persistent request-to-versioned-quote workflow for a future carpet and
upholstery cleaning service serving Sofia, Bulgaria.

The current repository contains:

- a minimal Next.js App Router shell;
- strict TypeScript, Tailwind CSS, ESLint, and Vitest configuration;
- an isolated PostgreSQL persistence adapter using Drizzle ORM and the Neon
  serverless driver;
- one infrastructure table plus canonical service-catalogue, pricing, duration,
  service-area, team/equipment, working-hour and travel-rule tables;
- generated, reviewable SQL migrations;
- a safe application and database health endpoint;
- a responsive, Bulgarian-first public service website with complete English
  routes and evidence-controlled marketing claims;
- a server-validated bilingual public request form that persists a safe
  staff-review request without creating an account, quote or booking;
- deterministic catalogue seeding plus insert-only provisional development
  price-book and duration versions, with no public prices or product claims;
- non-indexed local-only pricing and availability calculation harnesses;
- Neon Auth-backed bilingual account flows, application-owned profiles,
  deny-by-default RBAC and a protected `/app` shell;
- bilingual privileged application user list/detail routes with conservative,
  owner-protected role/status administration and sanitized audit review;
- bilingual staff customer/property administration plus linked-customer,
  read-only property access with server-side record ownership checks;
- durable customer, contact, property, area and cleaning-asset records that
  form the identity-safe Cleaning Passport attachment foundation; and
- separate request, normalized-item, estimate, versioned-quote and business
  audit records with protected staff and linked-customer access; and
- product, public-site, architecture, data, design, security, and delivery
  documentation.

Accepted bookings, occupancy/calendar, completed Cleaning Passport history,
production invitations/session administration, payments, invoices, dispatch,
object storage, final branding and deployment are not implemented.

## Requirements

- Node.js 24 LTS
- npm
- A PostgreSQL database when database-backed behavior is exercised

## Local setup

Install the locked dependencies:

    npm ci

Create a local environment file:

    cp .env.example .env.local

Add the Neon PostgreSQL connection value for the VAX `development` branch and
`neondb` database to DATABASE_URL in .env.local. The production branch must not
be used for ordinary development. Never put the value in source code or commit
the local environment file.

`PUBLIC_SITE_URL` is optional for local development. Leave it empty until an
approved public HTTPS origin exists. Without it, canonical and business schema
markup are withheld and robots configuration remains non-indexing.

Authentication additionally requires development-branch values for
`NEON_AUTH_BASE_URL` and a locally generated `NEON_AUTH_COOKIE_SECRET` of at
least 32 characters. Keep both server-only. Production email verification and
rate limiting are intentionally blocked pending deployment decisions; see
[docs/IDENTITY_AND_ACCESS.md](docs/IDENTITY_AND_ACCESS.md).

Database mutation commands also require
`DATABASE_MUTATION_ENVIRONMENT=development` and
`DATABASE_MUTATION_EXPECTED_HOST` set to the exact hostname from the approved
development `DATABASE_URL` (hostname only, never the connection string). This
second input is an intentional wrong-branch interlock. Apply the committed
migration only after both checks identify the intended development database:

    npm run db:migrate

The migration command uses Next.js environment loading, so local development
can use `.env.local`. It refuses production mode, a non-development mutation
label, or a database hostname that differs from the explicit expected host.
Future staging or production migration needs a separately reviewed command and
explicit authorization; this Phase 3A command is development-only.

Start the application:

    npm run dev

Then open http://localhost:3000. The health contract is available at
http://localhost:3000/api/health.

The development-only calculation harness is available locally at
http://localhost:3000/internal/pricing-lab. It is not a customer quotation
surface, is not linked publicly and the shared internal layout returns not-found
outside the development server.

The non-persistent team-capacity harness is available at
http://localhost:3000/internal/availability-lab. It shows provisional travel and
slot calculations only; it creates no booking, makes no customer promise and is
also unavailable from a production build.

Without a configured, reachable database, the application still builds and the
health endpoint intentionally returns HTTP 503 with:

    { "status": "degraded", "database": "unavailable" }

With a reachable database it returns HTTP 200 with:

    { "status": "ok", "database": "connected" }

Neither response exposes connection details or errors.

## Scripts

| Command | Purpose |
| --- | --- |
| npm run dev | Run the local Next.js development server |
| npm run build | Create a production build |
| npm run start | Serve the production build |
| npm run lint | Run ESLint across the repository |
| npm run typecheck | Check strict TypeScript without emitting files |
| npm run test | Run the Vitest suite once |
| npm run test:watch | Run Vitest in watch mode |
| npm run db:generate | Generate SQL migrations from the Drizzle schema |
| npm run db:check | Validate the committed migration history |
| npm run db:migrate | Apply committed migrations and canonical reference seeds using DATABASE_URL |
| npm run auth:bootstrap-owner | Explicitly assign the first owner to an existing active application profile |
| npm run validate | Run the full local completion gate, including migration and dependency checks |

## Git workflow and CI

- `main` is the stable integration branch.
- Routine work belongs on focused feature branches or isolated Git worktrees.
- Pull requests must pass CI before merge.
- CI runs the locked install, lint, typecheck, tests, build, migration-history
  check, and dependency audit without a live database credential.
- `.env.local` remains local-only, and the Neon `development` branch remains
  the ordinary local database target.
- Production database changes and deployment require separate explicit
  authorization.

The complete Codex branch, worktree, connection, validation, and database
delivery policy is documented in [docs/DEVELOPMENT_WORKFLOW.md](docs/DEVELOPMENT_WORKFLOW.md).

## Repository map

| Path | Responsibility |
| --- | --- |
| src/app | Next.js routes, layouts, and transport adapters |
| src/auth | Provider-neutral auth contracts, Neon adapter, session and rate-limit boundaries |
| src/components/public | Reusable public-site layout and presentation |
| src/components/admin | Accessible privileged-administration presentation and confirmation controls |
| src/components/application | Shared protected-application shell and accessible action primitives |
| src/config | Replaceable public identity and runtime-neutral site facts |
| src/content/public-site | Localized content contract, routes, services, FAQ, and claim controls |
| src/modules | Provider-neutral domain vocabulary and application-facing modules |
| src/db | PostgreSQL schema, connection adapter, health probe, and migrator |
| src/lib | Small cross-cutting utilities such as environment validation |
| drizzle | Generated SQL migrations and Drizzle migration metadata |
| docs | Persistent product and engineering decisions |

Read AGENTS.md and the relevant docs before changing architecture or domain
behavior.

## Database workflow

1. Change the relevant schema module exported by src/db/schema.ts.
2. Run npm run db:generate with a descriptive migration name when appropriate.
3. Inspect both the SQL and Drizzle metadata.
4. Review backward compatibility and rollback implications.
5. Confirm `DATABASE_URL`, `DATABASE_MUTATION_ENVIRONMENT=development`, and the
   exact `DATABASE_MUTATION_EXPECTED_HOST` identify the intended development
   branch.
6. Apply migrations and deterministic canonical seeds with npm run db:migrate
   only against that explicitly selected database.

Never use schema push as a substitute for reviewed migrations.
Production migrations require separate explicit authorization.

## Current status

Phase 0B connects local development to the VAX Neon `development` branch and
applies the initial migration to its `neondb` database. That branch contains
Drizzle migration bookkeeping, application tables, canonical catalogue data
and development-only versioned commercial configuration. No real personal
data is seeded.
The Neon `production` branch has not been migrated or otherwise changed by the
application setup. Phase 0C establishes the initial GitHub `main` baseline and
credential-free CI validation. Phase 0D establishes the autonomous Codex
worktree, pull-request, validation, and connection boundaries. Phase 1 adds the
complete public route foundation, temporary configurable identity, technical
SEO, accessibility and responsive baselines, and a non-persistent request
prototype. Phase 1A makes Bulgarian primary at unprefixed routes, keeps matching
English routes under `/en`, and adds the content authority defined in
[docs/CONTENT_AUTHORITY.md](docs/CONTENT_AUTHORITY.md). See
[docs/PUBLIC_SITE.md](docs/PUBLIC_SITE.md). Phase 2 adds the canonical catalogue,
taxonomies, capability relationships and price-free product/add-on foundations
defined in [docs/SERVICE_CATALOGUE.md](docs/SERVICE_CATALOGUE.md), applied only
to Neon development. Phase 2A adds the unpublished provisional EUR pricing,
VAT, duration, travel, timing and explainability foundation defined in
[docs/PRICING_ENGINE.md](docs/PRICING_ENGINE.md). Phase 2B adds the draft
service-area, travel-time, working-hours, two-team equipment/capacity, slot and
utilisation foundation defined in
[docs/AVAILABILITY_ENGINE.md](docs/AVAILABILITY_ENGINE.md). No booking
persistence, production migration or deployment is included. Phase 3A adds the
Neon Auth server adapter, secure bilingual account flows, application-owned
profiles, five canonical roles, 22 permissions, deterministic role mappings,
status enforcement, sanitized auth events and the protected `/app` foundation
described in [docs/IDENTITY_AND_ACCESS.md](docs/IDENTITY_AND_ACCESS.md). It adds
no CRM or transactional business data and does not change Neon production.
Phase 3B adds owner-protected application identity list/detail, conservative
role/status management, atomic sanitized audit, provider reconciliation policy
and fail-closed provider capability gates without a schema migration, synthetic
identity, provider mutation or deployment. Phase 3C adds explicit
application-profile-to-customer links, customer/contact/property/area/asset
records and server-mediated staff/customer CRM surfaces. Phase 3D adds the
persistent public/customer/staff request workflow, provenance-preserving item
normalization, append-only estimate versions, staff-reviewed quote versions,
linked-customer issued-quote access and a separate business audit. It creates
no accepted Booking, payment, invoice or occupancy, and does not migrate
production or deploy. See [docs/CRM_AND_PRIVACY.md](docs/CRM_AND_PRIVACY.md)
and [docs/REQUEST_AND_QUOTE.md](docs/REQUEST_AND_QUOTE.md).
