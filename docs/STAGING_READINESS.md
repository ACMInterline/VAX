# Staging Readiness

## Phase 3N authority checkpoint

Phase 3N adds the reviewed `0016_phase_3n_business_authority.sql` migration to
the authorized development and staging targets only. The current
nonproduction contract is 100 VAX public tables and 17 ordered migration
entries. The two new tables hold immutable versioned authority proposals and
append-only transition/approval evidence; no business-authority, seller, VAT,
price, Invoice-numbering, provider-risk or deployment decision is seeded.
Canonical RBAC remains five roles, 28 permissions and 76 role-permission
mappings.

The protected staging application can display the 17-category readiness
registry and production-authorization report. `SYSTEM_SETTINGS_READ` controls
the report; every proposal, review, approval, rejection and supersession still
requires an active Owner with `SYSTEM_SETTINGS_MANAGE`, and the database repeats
that boundary. Staging approval is distinct from production approval. Missing
authority remains a blocker rather than an invitation to copy a provisional
Phase 2A/2B value.

Phase 3N also gives the existing finance configuration an explicit `STAGING`
scope. Hosted finance actions derive `STAGING` from `VAX_ENVIRONMENT`; they do
not mistake Next.js production build mode for VAX `PRODUCTION`. No staging
seller, VAT, Invoice policy or numbering authority is inserted, so Invoice
creation/issue remains fail-closed until genuine staging configuration is
approved. Historical issued Quote, acceptance and Booking snapshots are not
refreshed or rewritten.

The Phase 3M identities, profiles and request/Quote/Booking chain remain
controlled synthetic evidence. Phase 3N does not add an Auth identity, alter a
provider session, seed operational facts or automatically activate any value.
The hosted workflow therefore still stops at the scheduling-authority gate;
Job, Passport, finance and final communication/document acceptance may proceed
only after real staging authority exists.

## Phase 3M hosted checkpoint

Phase 3M deploys the reviewed VAX application to a dedicated Vercel project at
`https://vax-phase3m-staging-preview.vercel.app`. The project is staging-only,
uses the Vercel Preview environment, has no Git production-domain binding and
injects only Neon `staging` runtime/Auth and application secrets. The migrator
and Neon administrator URLs are not present in the hosted runtime. Staging
responses are private/no-store, emit global noindex headers and identify the
environment as staging. Neon `production`, production Auth, production DNS and
production deployment remain untouched.

The hosted readiness endpoint is green for the database, exact migration
attestation, Auth, shared rate limiter and test-only email boundary. A generated
SMTP sink is configured in Neon staging Auth with the exact hosted origin and no
wildcard or localhost origin. Application Auth actions additionally permit only
the exact synthetic staging recipient allowlist; disallowed signup, reset and
verification attempts remain generic and never reach the provider.

Six synthetic Auth identities cover OWNER, an ADMIN candidate, DISPATCHER,
TECHNICIAN and two CUSTOMER scenarios. The supported staging bootstrap created
exactly one OWNER and its audit event. Login, protected refresh, logout,
verification, one-time password reset, suspension/reactivation and cross-
customer denial were exercised. Managed Auth does not expose reliable session
listing/revoke-all or provider-attested recent-authentication in the installed
integration. The Phase 3M evidence records eight active synthetic staging
sessions; Phase 3N retains that count as controlled acceptance evidence, not as
a newly provider-attested inventory, and performs no direct provider-table
cleanup. ADMIN assignment and other operations requiring those guarantees
remain disabled rather than being bypassed.

The hosted request path reached a persisted synthetic request, staff linkage,
immutable normalization, reviewed estimate, issued quote, customer acceptance
and exactly one Booking. Scheduling then stopped safely because the available
duration, price and scheduling knowledge remains provisional/inactive and is
not publication-approved. Phase 3D provenance was not reinterpreted or repaired.
Job, Cleaning Passport, finance and final communication/document workflows were
therefore not fabricated merely to complete a rehearsal.

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
| Staging rehearsal | Neon `staging` | dedicated Vercel HTTPS staging project | synthetic only |
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
- at the Phase 3L checkpoint, no remaining application business rows, Auth
  users or Auth sessions;
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

At the historical Phase 3L checkpoint, staging Auth was branch-isolated and
contained no users or sessions. Phase 3M subsequently added the controlled
synthetic identities and recorded sessions described in the current checkpoint
above.
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

The hosted staging result has database, Auth, migrations, rate limiting and the
test-recipient-only email boundary ready. This does not make the incomplete
business acceptance path or provider operational gates ready.

Safe structured operational events allow only a correlation ID, event code,
route, controlled actor profile ID, status, duration and sanitized error class.
Passwords, tokens, cookies, bodies, contacts, payment data and provider errors
are dropped. The reporter remains provider-neutral. Phase 3M adds the sanitized
GitHub staging issue receiver described in the deployment runbook; it is not a
production on-call service.

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

Phase 3M additionally completed:

- hosted BG/EN public, Auth, customer and staff browser flows with no observed
  console error or horizontal overflow at the available hosted viewport;
- live verification and password-reset delivery through the generated
  test-only sink, including replay denial and generic unknown-account results;
- shared hosted login throttling and database-backed fail-closed simulations;
- CUSTOMER A/B CRM, request, quote and Booking access checks, plus deliberate
  cross-customer route attempts; and
- a PostgreSQL 18 portable logical export of `public` and `drizzle`, exact
  secret scan, clean restore into a disposable Neon branch/database, migration
  and representative-data fingerprint verification, followed by deletion.

Not fully executed or not supported:

- actual browser cookie-store inspection is restricted by the available
  browser-control boundary; source/library attributes and real HTTPS
  create/refresh/logout behavior were verified instead;
- exact hosted 320/375/390/430/768/1024 viewport control was unavailable; the
  repository responsive suite remains the evidence below the hosted viewport;
- provider session list/revoke-all, standalone OTP sign-in and
  provider-attested recent-auth are unavailable in the configured model;
  verification-code replay was exercised through the configured email
  verification flow; and
- scheduling, Job, Passport, finance and final document/communication flows are
  blocked by the deliberate provisional-knowledge review gate described above.

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

## Phase 3M fixture policy

The six Auth identities, six application profiles, two customers, two
properties, two assets and the single request/quote/Booking chain are controlled
staging fixtures. They contain synthetic labels only and no real address,
contact, seller, bank, tax or payment data. Passwords and provider identifiers
are excluded from Git, Vercel build output, runbooks and logs. Before reuse,
credentials must be retrieved from an approved secret store or reset through
the staging sink; rotate or remove fixtures when their rehearsal purpose ends.
They must never be copied to production. Audit evidence is intentionally
retained with the fixture chain until a separately reviewed staging reset. The
recorded eight active synthetic sessions are retained under the same policy;
because the provider boundary cannot reliably list or revoke all sessions,
their count is not conflated with the six identity records or claimed as a
freshly verified provider inventory.

## Decision

**NOT READY** for complete product acceptance or production promotion.

Exact blockers:

1. the Phase 3N evaluator has no genuine staging-approved duration, price,
   availability, team/equipment, travel or related operational authority, so
   Job, Passport, finance and final communication/document acceptance cannot
   proceed;
2. Neon Auth remains Beta and lacks the required session revoke-all,
   provider-attested recent-authentication and complete privileged-ADMIN proof;
3. exact small-viewport hosted-browser and cookie-store inspection remain
   unavailable through the current safe browser-control boundary;
4. the credential-rotation rehearsal still cannot invalidate a previously
   authenticated Neon pooled frontend, even though fresh old credentials fail;
5. alert ownership is the repository's GitHub staging environment/issue
   receiver, not a staffed production on-call service;
6. production seller/VAT/fiscal/accounting/payment/privacy configuration,
   production topology, provider acceptance, migration, deployment and explicit
   authorization all remain absent; and
7. the Phase 3M portable restore proves the historical 98-table/16-entry
   snapshot, not the Phase 3N 100-table/17-entry delta, which needs a later
   approved portable-restore rerun before production recovery authority.

No operational knowledge, provider, rule, staging email path, production
configuration or production migration was automatically approved.

See [BUSINESS_AUTHORITY.md](BUSINESS_AUTHORITY.md) for the approval model and
[PRODUCTION_AUTHORIZATION_PACKAGE.md](PRODUCTION_AUTHORIZATION_PACKAGE.md) for
the exact remaining business, professional, provider and release gates.
