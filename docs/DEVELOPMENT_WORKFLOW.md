# Development Workflow

## Normal delivery path

Future implementation tasks follow this path without requiring routine Git,
terminal, test, or database-administration work from the user:

> product instruction → isolated worktree → focused implementation → local
> validation → scoped commit → normal push → pull request → CI → protected
> `main`

`main` is the stable integration branch. Start normal implementation from the
current remote `main` in a disposable Codex-managed worktree or an equivalent
isolated Git worktree. Use `codex/<phase>-<short-description>` branch names,
for example `codex/phase-1-public-site`. Never force-push.

The worktree lifecycle is:

1. Confirm `main`, its upstream, protection, status, and current CI result.
2. Create an isolated worktree from current `main` and a focused branch.
3. Inspect relevant instructions and implementation before editing.
4. Implement only the requested slice and add proportionate tests.
5. Run `npm run validate`; use `npm ci` first when a clean install or dependency
   change must be verified.
6. Review the diff and secret-scan only the intended commit candidates.
7. Stage explicit paths, commit, push normally, and open a pull request.
8. Inspect CI, fix real failures without weakening checks, and merge only when
   protected-main requirements pass.
9. Confirm `main` is synchronized, then remove the completed worktree and its
   merged feature branch.

Do not create persistent worktrees merely as placeholders. One implementation
task normally owns one disposable worktree and branch.

## Environment boundaries

| Concern | Approved development boundary |
| --- | --- |
| Repository | `ACMInterline/VAX`; feature worktree derived from `main` |
| Local database | Neon VAX → `development` → `neondb` |
| Production database | Never use for normal development |
| Local application | Loopback only unless deployment is explicitly authorized |
| Runtime secret | Ignored `.env.local`; never commit, print, or copy into tracked configuration |
| Database mutation interlock | Explicit development label plus exact approved development database hostname and database name |
| Local authentication | Neon Auth endpoint for the VAX `development` branch only; synthetic identities only |
| CI | Credential-free; no live database, migration, or deployment step |

The tracked `.worktreeinclude` contains only the filename `.env.local`, never
its value. The ChatGPT desktop app may therefore copy the ignored file into a
local Codex-managed worktree. It remains ignored and local-only. Do not use this
mechanism to move secrets to cloud or remote worktrees, and remove completed
local worktrees promptly.

## Connection responsibilities

- GitHub integration owns repository discovery, branches, commits, pull
  requests, and CI inspection.
- Neon integration owns read-only project/schema inspection and branch or
  database administration only when the task explicitly authorizes it.
- Application runtime database access comes only from `DATABASE_URL` in the
  ignored local `.env.local` during development, or from a future authorized
  hosting environment.
- Application runtime authentication uses branch-specific
  `NEON_AUTH_BASE_URL` plus a local `NEON_AUTH_COOKIE_SECRET`; the management
  integration is not a browser/session connection.

`npm run db:migrate` and `npm run auth:bootstrap-owner` additionally require
`DATABASE_MUTATION_ENVIRONMENT=development` and
`DATABASE_MUTATION_EXPECTED_HOST` matching the hostname parsed from the approved
development `DATABASE_URL`, plus `DATABASE_MUTATION_EXPECTED_DATABASE` matching
its exact database name. These values contain no username, password or
connection string. Alternate host, database, port or identity query parameters
fail closed, while normal Neon TLS parameters remain supported. The scripts
intentionally cannot be reused as production mutation commands.

The Neon management integration is not an application runtime connection. Do
not request a connection string from it when `.env.local` already provides the
approved development runtime configuration.

## Database change path

Schema work follows this sequence:

> feature implementation → Drizzle schema change → generated migration → SQL
> and metadata inspection → explicitly authorized migration and deterministic
> canonical seed on Neon `development` only → schema/reference verification →
> tests → pull request and CI

Never use schema push or a schema reset as a substitute for reviewed
migrations. Never alter the Neon-managed `neon_auth` schema unless a future task
explicitly concerns Neon Auth. Production migration requires separate explicit
authorization and an impact review.

Phase 2 catalogue definitions are code-controlled and upserted after migrations
by `npm run db:migrate`. The seed is intentionally safe to rerun and contains no
customers, transactions or actual cleaning-product records. Phase 2A adds
insert-only, inactive provisional price-book and duration versions; reruns must
not update an existing commercial version. Phase 2B adds insert-only inactive
working-hour, appointment-window and travel versions plus idempotent neutral
team/equipment fixtures; it persists no occupancy or reservation.
Phase 3A adds a deterministic canonical role/permission seed plus runtime
application profile, assignment and sanitized auth-event records. Migration and
test identities target development only; mutation commands enforce the explicit
development label and exact-host-and-database interlock, and no script may query
or mutate `neon_auth` directly.

Phase 3C–3F add only application-owned CRM, request/Quote, acceptance/Booking,
occupancy, Job, inspection, treatment, Cleaning Passport and business-audit
structures through reviewed additive migrations. Phase 3G reuses those tables:
its additive migration creates no new business table, adds only controlled
occupancy-revision fields/checks and broadens the Booking audit allowlist. It
must not rewrite prior rows, weaken GiST overlap constraints or alter
provider-managed Auth.

For migration `0009_phase_3g_scheduling_dispatch.sql`, record the reviewed SQL
checksum before applying it, prove the exact VAX `development` / `neondb`
target, apply only the committed migration, then verify the Drizzle ledger
entry, resulting checks/indexes and unchanged prior migration checksums.
Production is never a verification target.

Credential-free CI cannot prove live PostgreSQL exclusion behavior. A separate
guarded, serialized development-only integration run may use deterministic
synthetic Booking/occupancy fixtures to prove same-team and same-equipment
conflicts, different-team concurrency, cancelled-capacity release and no
partial writes. Clean the fixtures and any safely supported synthetic Auth
identity afterward. Do not create an identity when its cleanup cannot be
proved, and never weaken or skip the development host/database interlocks to
run this test.

## Validation automation

`npm run validate` is the repository completion command. It runs lint,
typecheck, tests, the production build, Drizzle migration-history checking,
dependency audit, and `git diff --check`. GitHub Actions repeats the same
quality boundaries after a locked clean install and remains the merge gate.

No repository lifecycle hook is configured in Phase 0D. A full Stop hook would
rerun slow checks on every changed turn, including incomplete work, and every
new hook definition requires an explicit trust review. The one-command local
gate plus required CI is lighter and more predictable.

If a desktop convenience environment is added later, its exact recommended
settings are:

- worktree setup script: `npm ci`
- validation action: `npm run validate`
- local server action: `npm run dev -- --hostname 127.0.0.1`

Review and commit the desktop-generated project configuration before relying on
it. Do not put environment values, migration commands, pushes, or deployment
commands in setup scripts or actions.

## Repository visibility

The application, Neon project, CI workflow, and future deployment architecture
do not technically require a public GitHub repository. Before changing VAX to
private, confirm the account plan retains protected branches, the GitHub App is
granted access to the private repository, and private-repository Actions quota
is acceptable. Neon administration is independent of GitHub visibility.

Visibility remains a business-owner decision and must not be changed
automatically.

## Deployment gate

Phase 3J adopts the official patched Next.js 16.3.3 release and re-runs the
locked validation and security gates. That closes the time-bound framework
advisory only. Deployment remains blocked until the separate trusted-origin,
SMTP, shared-rate-limit, monitoring/recovery, least-privilege/RLS, production
configuration, production-migration and explicit authorization gates pass.
