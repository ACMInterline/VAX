# Staging Readiness

## Phase 3L checkpoint

VAX now has a dedicated Neon `staging` branch created from the controlled
`development` branch. It has independent compute/Auth endpoints and rotated
runtime, migrator and administrator credentials. Neon `production` was not
used as a parent, target or credential source and remains unmigrated.

The application has not been deployed. The only application rehearsal in this
phase runs on `http://127.0.0.1:3000` with the explicit
`STAGING_ALLOW_LOCALHOST=true` local-only gate. That exception is not valid for
a hosted build and is not a staging-domain substitute.

## Environment topology

| Environment | Database | Application | Data rule |
| --- | --- | --- | --- |
| Local development | Neon `development` | local | synthetic/development only |
| Staging rehearsal | Neon `staging` | local loopback until hosting is approved | synthetic only |
| Production | Neon `production` | not deployed | untouched and unmigrated |

Staging uses three distinct database authorities:

- `vax_runtime`: pooled application traffic, no ownership, DDL, role admin,
  `BYPASSRLS`, Data API or browser authority;
- `vax_migrator`: direct reviewed migration/seed traffic and ownership of VAX
  objects, with no role administration; and
- the Neon administrator: direct operator-only bootstrap/recovery authority,
  never imported by runtime modules.

The local staging launcher passes a strict runtime-only environment to Next.js.
Migrator, administrator, mutation-authority and rotation values are masked, and
the launcher audits every Next.js development dotenv file before startup so an
ignored development file cannot reintroduce operator credentials or an unknown
secret. Ambient Node code-loading and custom-CA overrides are not inherited.

The staging credential-rotation work replaced the two VAX role passwords and
the staging administrator password, proved all replacement identities, rejected
fresh connections with every superseded credential and preserved schema/data
state. Recovery from the durable ignored pending file was also exercised: the
current owner-only staging file contains the verified replacement set and no
pending artifact remains. Auth-cookie and limiter HMAC secrets are preserved
rather than coupled to database-role rotation.

The full rotation command deliberately did **not** declare success. Exact
pre-rotation PostgreSQL backend PIDs could be terminated across databases, but
an already-authenticated Neon pooled frontend transparently acquired another
backend and remained usable. The exposed provider tooling has no endpoint
restart or pooler-frontend revocation operation. Password replacement alone is
therefore not proof of live-session revocation. Until a provider-supported
staging endpoint restart/drain sequence is approved and rehearsed, rotation
must fail closed and this remains a production blocker.

The replacement file is written and fsynced before the transactional password
change; its containing directory is fsynced after both creation and final
rename. A pre-existing, linked or non-regular pending credential file fails
exclusive creation instead of being overwritten. The command captures the
immutable pre-rotation backend PID set, verifies none remain, and separately
tests held sessions and fresh superseded credentials.

## Configuration contract

Staging secrets live only in ignored `.env.staging.local` with owner-only file
permissions during local rehearsal. A separate ignored, owner-only
`.env.staging.target.local` is the operator-provisioned target trust manifest.
It contains only the exact staging project, branch, host, database,
administrator-role and canonical Auth base-URL expectations plus the staging
mutation label. It must be
reviewed against the provider control plane independently of the credential
file. Staging commands neither generate nor accept per-run overrides for that
manifest. Both files are opened without following links and must be regular,
single-link files owned by the current user. A future host must inject the same
separation through its secret manager. Never copy these values into GitHub
Actions, logs, browser code or tracked files.

The contract separates:

- `DATABASE_URL`, `MIGRATION_DATABASE_URL`, `DATABASE_ADMIN_URL`;
- exact nonproduction mutation controls from the separate target manifest;
- `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`;
- `PUBLIC_SITE_URL`, `AUTH_TRUSTED_ORIGINS`;
- `RATE_LIMIT_BACKEND`, `RATE_LIMIT_HASH_SECRET`, trusted proxy hops;
- `EMAIL_DELIVERY_MODE`; and
- `VAX_ENVIRONMENT` plus the local-rehearsal switch.

Credential rotation accepts only `--local-rehearsal`; it receives no target
identifier from command arguments or ambient rotation variables. The opaque
authorization object can be created only by securely loading the independent
target manifest, so a self-consistent credential file cannot authorize its own
target.

The staging credential file is authoritative for its allowlist: after a
successful secure parse, every managed key is cleared before the file values
are applied, so an omitted value cannot fall back to an ambient development or
production secret. The local launcher also binds the pooled runtime database
URL to the manifest's exact direct-host sibling/database and binds the
canonical Auth base URL to the independent manifest before it starts Next.js.

Hosted staging must use one exact HTTPS public origin and include that same
origin in the Auth allowlist. Wildcards, credentials, paths, queries, fragments
and loopback origins fail closed. The loopback exception requires both a
non-production Node runtime and the explicit local-rehearsal flag.

## Database and migration rehearsal

Migration `0014_phase_3l_shared_rate_limiting.sql` is additive and follows
`0013`. It creates only `operational_rate_limits`, its expiry index, checks,
exact runtime DML grant and command-scoped RLS policies. Migration
`0015_phase_3l_readiness_attestation.sql` adds one migrator-owned,
security-definer function that exposes only the ordered migration hashes to
`vax_runtime`; the runtime still cannot read the Drizzle ledger. Readiness
compares that exact 16-entry ledger plus the exact table, column, constraint,
index, policy, ownership and privilege contract. Prior migrations remain
byte-for-byte guarded.

Phase 3L verified:

- 98 VAX public tables, all owned by the migrator and protected by RLS;
- 16 ordered Drizzle ledger entries with repository hashes;
- five roles, 28 permissions and 76 role-permission mappings;
- no remaining application business rows, Auth users or Auth sessions;
- PUBLIC, `authenticated` and `anonymous` have no VAX table access;
- runtime DDL/role/default-privilege bypass is denied while representative
  application repository paths work; and
- a fixed-name temporary staging database can be rebuilt from all migrations
  and canonical seeds, survive a controlled transactional DDL failure with an
  unchanged ledger/no residue, and be removed.

Before the cold rebuild executes any migration or seed, its live migrator is
also checked for LOGIN, no elevated PostgreSQL role attributes or memberships,
the exact database/schema CREATE authority, and zero pre-migration owned VAX
objects.

The normal persistent staging database was never reset. Synthetic fixtures and
the recovery marker were removed after verification.

## Authentication

Staging Auth is branch-isolated and currently contains no users or sessions.
Email/password signup and sign-in are enabled and verification-at-signup is
enabled. Provider localhost support remains enabled only for the explicitly
gated local rehearsal. No production callback or credential is present.

The provider console and installed SDK identify this managed Better Auth path
as Beta. The application can list users through its reviewed privileged
boundary, but reliable session listing, revoke-all, provider-attested recent
authentication and the complete disabled/suspended-provider contract remain
fail-closed/unavailable. These are production blockers.

The provider shared development email server is not an approved VAX mail sink.
No signup, verification or reset email was sent in Phase 3L. No synthetic Auth
identity was created. Live one-time-token, expiry, invalidation, enumeration,
cookie and five-role browser rehearsals therefore remain blocked until an
approved test mailbox/sandbox and hosted HTTPS origin exist.

## Shared rate limiting

Sensitive Server Actions now select a shared PostgreSQL limiter in staging and
production-like configuration. With an exact trusted proxy hop count, every
account-bearing attempt consumes domain-separated source-only, account-only and
source-account HMAC buckets in that order. The account-only bucket aggregates a
target account across distributed source addresses. Anonymous public intake
deliberately omits the account-only bucket so its fixed `anonymous-request` key
cannot become a global denial-of-service bucket. A missing or malformed trusted
forwarding chain is denied before consuming any bucket. Local loopback
development deliberately trusts no proxy and therefore uses account-only and
source-account buckets for account-bearing actions; it never collapses all
users into one global source bucket. Hosted staging and
production fail configuration closed unless a positive exact hop count is
present. Per-account policy is unchanged; the source budget is five times the
per-account limit. Equivalent IPv6 forms are canonicalized. Raw email, phone,
IP, token and body values are never stored. The table uses one row per
scope/key/window, database time, atomic upsert, a bounded `limit + 1` counter,
an expiry index and bounded expired-row pruning.

Two logical limiter instances were proven to share one atomic window: five
login attempts were allowed, seven denied, and the stored count remained
bounded at six. A backend error denies the sensitive action and emits only a
sanitized event. Forwarded addresses are ignored unless an exact trusted proxy
hop count is configured. Reverse-proxy limits remain an optional extra layer,
not a replacement for application limits. Before hosted staging, verify the
provider's append/overwrite contract, match the configured hop count, and block
direct access to the application origin; otherwise leave proxy trust disabled.

## Monitoring and outage states

`/api/liveness` reports only process availability. `/api/readiness` reports
safe category states for database, Auth, migration state, shared limiter and
staging email. It returns no host, schema, credential or provider response. The
Auth availability check disables the provider SDK's signed-session cookie
cache, so readiness requires a live provider response. A
per-process coordinator shares an in-flight probe and reuses its safe snapshot
for at most five seconds while still returning a fresh no-store HTTP response.
After expiry, a failed refresh returns 503 and never serves the earlier ready
snapshot. Each response probe has a three-second ceiling; if dependency work
remains hung, the coordinator retains that single underlying probe and returns
safe not-ready snapshots without launching more work. After the original work
settles, a later fresh probe may recover. Hosted ingress must network-restrict readiness;
high-frequency public
health polling must use liveness. Each application instance still performs its
own readiness probe.

| Condition | Liveness | Readiness | Sensitive behavior |
| --- | --- | --- | --- |
| healthy configured dependencies | 200 | 200 | enabled |
| email blocked/unconfigured | 200 | 503 | business writes remain independent; external send unavailable |
| DB unavailable/migration mismatch | 200 | 503 | database work fails closed |
| Auth unavailable | 200 | 503 | authentication fails generically |
| rate-limit store unavailable | 200 | 503 | sensitive mutations remain limited by denial |

The local staging result is deliberately `NOT_READY`: database, Auth,
migrations and rate limiting are ready; email is not ready.

Safe structured operational events allow only a correlation ID, event code,
route, controlled actor profile ID, status, duration and sanitized error class.
Passwords, tokens, cookies, bodies, contacts, payment data and provider errors
are dropped. The reporter remains provider-neutral; a hosted monitoring and
alert destination is not selected.

## Rehearsal evidence

Completed against staging:

- live runtime/migrator/database-security verification;
- multi-instance shared limiter and bounded pruning;
- scheduling exclusion/confirmation and dispatcher race checks;
- local browser rendering of Bulgarian and English Auth pages;
- protected `/app` redirect, global noindex, private/no-store sensitive
  caching and baseline CSP/frame/referrer/permissions headers;
- a recovery child branch reproduced a synthetic marker, all 98 tables, all 16
  migrations and canonical RBAC, then the branch and marker were deleted; and
- cold rebuild plus controlled migration-failure rollback and cleanup.

Partially completed and fail-closed:

- database passwords were rotated and fresh superseded credentials rejected,
  but an established pooler frontend survived backend termination; full
  provider-level session invalidation remains unproven.

Not executed as live end-to-end staging flows:

- five-role authenticated browser/IDOR, reset/OTP and cookie inspection;
- external email delivery/retry/backlog;
- customer/finance/Job/document business fixtures through the UI; and
- `pg_dump` export, because no compatible PostgreSQL client is installed in the
  workspace. Neon branch recovery was rehearsed instead; export remains a gate.

The credential-free CI workflow intentionally does not mutate persistent
staging. A future manual integration workflow must use a protected staging
environment, minimal permissions and fixed targets; it must not accept an
arbitrary database URL or default to production.

## Recovery, reset and proposed objectives

The current Neon project exposes a six-hour history window. Branch-from-current
state recovery was proven; instant/PITR restore and snapshots must still be
approved and rehearsed for the exact future production plan. Snapshots are a
Beta capability and root-branch constraints apply.

Proposed owner-review targets, not SLAs:

- RPO: at most 24 hours for the initial small-business service; and
- RTO: within several hours during supported operating time.

Staging reset should normally delete/recreate the staging branch from the
controlled release base, rotate environment credentials, apply reviewed
migrations/seeds, and rerun the verification commands. Do not casually delete
append-only evidence in a production-like persistent branch.

## Security and indexing

Staging responses set `X-Robots-Tag: noindex, nofollow, noarchive`; robots.txt
disallows all crawling; staging metadata does not emit canonical/hreflang or
business JSON-LD URLs. Sensitive/Auth/app routes are private and no-store. The
baseline disables framing, MIME sniffing, camera/microphone/geolocation and
object embedding. HSTS is emitted only for an actual HTTPS production build,
never for loopback HTTP.

Database connections retain TLS and staging credentials use
`sslmode=verify-full`. Application configuration rejects `sslmode=disable` in
all environments and requires exactly `verify-full` for staging, production or
any production-mode process. The installed `pg` 8.23.0,
`pg-connection-string` 2.14.0 and Neon serverless 1.1.0 are the current package
versions at this checkpoint. The upstream pg 9 warning announces future SSL
semantic changes; no newer package exists today. Keep explicit verify-full.
The node-postgres transactional test adapter serializes queries on its single
test connection, while production's Neon HTTP adapter retains its intended
concurrency.

Deployment hosts must provide reliable NTP. PostgreSQL/server timestamps remain
authoritative; Europe/Sofia is display/input policy only. Existing Sofia DST
tests remain part of the full suite.

## Decision

**NOT READY** for a complete controlled staging rehearsal.

Exact blockers:

1. no approved hosted HTTPS staging application/origin;
2. no staging-only SMTP sandbox/mail sink and therefore no live verification,
   reset, token, delivery, retry or enumeration rehearsal;
3. no synthetic authenticated five-role browser/IDOR/session-cookie rehearsal;
4. provider Beta acceptance, session revocation/recent-auth capability and
   support/SLA review remain owner gates;
5. no hosted monitoring/error/alert receiver or exercised on-call delivery;
6. no verified portable database export; and
7. production legal/seller/VAT/fiscal/accounting/payment configuration,
   production topology review, migration, deployment and authorization all
   remain absent.

No operational knowledge, provider, rule, staging email path, production
configuration or production migration was automatically approved.
