# Service Platform Foundation

Production-oriented service-platform foundation with an isolated development
database and a Phase 1 public website for a future carpet and upholstery
cleaning service serving Sofia, Bulgaria.

The current repository contains:

- a minimal Next.js App Router shell;
- strict TypeScript, Tailwind CSS, ESLint, and Vitest configuration;
- an isolated PostgreSQL persistence adapter using Drizzle ORM and the Neon
  serverless driver;
- one infrastructure table, system_metadata;
- generated, reviewable SQL migrations;
- a safe application and database health endpoint; and
- a responsive, claim-controlled public service website;
- a browser-only request prototype that creates no records; and
- product, public-site, architecture, data, design, security, and delivery
  documentation.

Booking connectivity, CRM, authentication, payments, operations workflows,
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

Apply the committed migration only after DATABASE_URL points to the intended
non-production database:

    npm run db:migrate

The migration command uses Next.js environment loading, so local development
can use .env.local while a host-provided DATABASE_URL remains authoritative for
future staging and production environments.

Start the application:

    npm run dev

Then open http://localhost:3000. The health contract is available at
http://localhost:3000/api/health.

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
| npm run db:migrate | Apply committed migrations using DATABASE_URL |
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
| src/components/public | Reusable public-site layout and presentation |
| src/config | Replaceable public identity and runtime-neutral site facts |
| src/content/public-site | Localized content contract, routes, services, FAQ, and claim controls |
| src/modules | Application-facing modules and use-case orchestration |
| src/db | PostgreSQL schema, connection adapter, health probe, and migrator |
| src/lib | Small cross-cutting utilities such as environment validation |
| drizzle | Generated SQL migrations and Drizzle migration metadata |
| docs | Persistent product and engineering decisions |

Read AGENTS.md and the relevant docs before changing architecture or domain
behavior.

## Database workflow

1. Change src/db/schema.ts.
2. Run npm run db:generate with a descriptive migration name when appropriate.
3. Inspect both the SQL and Drizzle metadata.
4. Review backward compatibility and rollback implications.
5. Confirm DATABASE_URL identifies the intended non-production branch.
6. Apply with npm run db:migrate only against that explicitly selected database.

Never use schema push as a substitute for reviewed migrations.
Production migrations require separate explicit authorization.

## Current status

Phase 0B connects local development to the VAX Neon `development` branch and
applies the initial migration to its `neondb` database. That development
database contains only Drizzle migration bookkeeping, `system_metadata`, and
Neon-managed authentication infrastructure; it contains no VAX business data.
The Neon `production` branch has not been migrated or otherwise changed by the
application setup. Phase 0C establishes the initial GitHub `main` baseline and
credential-free CI validation. Phase 0D establishes the autonomous Codex
worktree, pull-request, validation, and connection boundaries. Phase 1 adds the
complete public route foundation, temporary configurable identity, technical
SEO, accessibility and responsive baselines, and a non-persistent request
prototype. See [docs/PUBLIC_SITE.md](docs/PUBLIC_SITE.md). No Phase 1 database
schema or record changes are required, and nothing has been deployed.
