# Security

## Security posture through Phase 3A

The repository now has a development authentication, session and RBAC boundary,
but it does not claim production security readiness. Production-grade shared
rate limiting, email delivery, trusted origins, monitoring, recovery and
production data governance remain gated.

## Time-bound framework advisory

Next.js has announced an upcoming 26 August 2026 security release for the 16.3
line that includes a critical fix. Local installed, locked and cached package
metadata was rechecked on 23 August 2026 and contains only 16.3.0 through
16.3.2. This repository therefore remains on 16.3.2 without dependency churn
and must not be deployed until the patched stable release is locally available,
adopted and followed by the full validation suite. Update or remove this note
after that upgrade.

Reference: [Upcoming Next.js August Security Release](https://nextjs.org/blog/upcoming-nextjs-security-release-august-2026)

Deployment remains blocked until all of the following are complete:

1. The scheduled patched stable Next.js 16.3 release is available.
2. The repository is upgraded to that patched release.
3. The full validation suite passes again.
4. A security review is complete.
5. Deployment is explicitly authorized.

## Secrets and environment configuration

- Runtime secret-bearing variables include `DATABASE_URL` and
  `NEON_AUTH_COOKIE_SECRET`; Auth endpoint and bootstrap subject configuration
  must also remain server-only.
- Read it from the environment through the validated server-side boundary.
- Never hard-code, log, return, test-fixture, or commit a real connection value.
- Never commit .env, .env.local, credentials, tokens, keys, or certificates.
- Keep .env.example limited to variable names and empty values.
- Use separate credentials and databases per environment.
- Local development must use the VAX Neon `development` branch, never the
  production branch.
- Database mutation commands require an explicit `development` acknowledgement
  and an exact expected development database hostname in addition to
  `DATABASE_URL`; those non-secret controls must never contain credentials.
- Future staging and production environments must inject DATABASE_URL through
  their deployment platform rather than use a committed environment file.
- GitHub Actions must validate without a live database credential and must not
  apply migrations.
- Rotate credentials if exposure is suspected; do not merely delete a committed
  secret.

Client components and browser bundles must never import server environment or
database modules.

## Codex development boundary

- Normal implementation work occurs on a focused feature branch in a local
  disposable worktree, never directly on protected `main`.
- `.worktreeinclude` contains only the ignored `.env.local` path. It may copy
  that file into local Codex-managed worktrees but never exposes or tracks its
  value. Do not use it for cloud or remote worktrees.
- The Neon management integration is for authorized administration and schema
  inspection; it is not the application's runtime connection.
- Codex must never force-push, bypass failed validation or CI, deploy, or modify
  production resources without explicit authorization.
- Remove completed local worktrees so ignored credentials and build artifacts
  do not persist in unnecessary checkouts.

## Database access

- PostgreSQL is accessed through the isolated src/db adapter.
- Use least-privilege application and migration roles when environments are
  provisioned.
- Use parameterized Drizzle queries; never concatenate untrusted SQL.
- Make schema changes through explicit, reviewable migrations.
- Do not run destructive migrations or access production data without explicit
  instruction and an impact review.
- Back up and rehearse recovery before destructive production changes.
- Do not store binary files or photos in PostgreSQL.

Application migrations are applied only to the VAX Neon `development` branch.
The Phase 3A migration creates additive public-schema identity/RBAC tables and
must never target production or directly change provider-managed `neon_auth`.
The current migration and owner-bootstrap commands refuse production mode,
non-development mutation labels and unexpected database hostnames before
opening a database client. Applying any migration to production requires a
separately designed command and explicit authorization.

## Health endpoint

GET /api/health exposes only bounded status values:

- status: ok or degraded
- database: connected or unavailable

It returns HTTP 503 when configuration or connectivity fails and sets
Cache-Control to no-store. It does not return stack traces, hostnames,
usernames, passwords, connection values, driver errors, or raw exceptions.

Future public deployment work must decide whether this endpoint remains public,
is split into liveness and readiness endpoints, or receives network controls.

## Trust boundaries

Validate and normalize all data entering through:

- HTTP requests and form submissions;
- environment variables;
- authentication callbacks and sessions;
- payment, email, SMS, or storage webhooks;
- imported files and external APIs;
- object metadata and upload declarations; and
- admin and technician actions.

Validation does not replace authorization. Every protected use case must verify
actor, action, resource ownership, and relevant organization scope on the
server.

## Phase 1 public request and content claims

The public request form is a frontend-only prototype. It prevents native
submission, has no action or server mutation, writes no database record and
uploads no file. Its acknowledgement explicitly states that nothing was sent,
stored, priced, scheduled or booked. Zod validation demonstrates the future
input contract but is not a server security boundary.

Before request persistence is added, complete a focused threat and privacy
review covering server-side validation, rate and abuse controls, consent,
retention, logging, duplicate submission, idempotency, file metadata, object
storage and operational acknowledgements.

Public hygiene, stain, acoustic, timing and product-performance claims are also
a trust boundary. `src/content/public-site/claims.ts` classifies important
claims as `verified`, `qualified`, `manufacturer_evidence_required`,
`legal_verification_required` or `prohibited`, with tests over publishable
Bulgarian and English content. `docs/CONTENT_AUTHORITY.md` records the approved
publication boundary and evidence needed for any stronger statement. Content
review remains required; a passing pattern test is not evidence for a marketing
claim.

The language selector uses deterministic public URLs and stores no locale
preference. Both locale versions preserve the same non-persistent request-form
boundary and must not import server environment or database code.

## Phase 2 catalogue safeguards

Phase 2 adds only canonical reference and capability data. The seeder contains
no customers, bookings, prices, credentials or actual cleaning-product rows.
Issue handling distinguishes assessment, specialist and decline/referral
boundaries; it does not claim medical or biohazard capability. Antibacterial,
allergen, manufacturer and product-origin capabilities remain evidence-gated
and are not seeded.

Only the Neon `development` branch may receive the reviewed Phase 2 migration.
The migration must remain additive, must not touch `neon_auth`, and must be
followed by a schema and row-count inspection. Production remains outside this
authorization.

## Phase 2A commercial safeguards

Phase 2A commercial rows are development-only, inactive drafts and explicitly
not approved for publication. Prices use exact integer minor units and tax
rates use basis points. Version-owned price books and rules are seeded with
insert-only conflict handling so reruns do not silently rewrite history.

The pure calculation engine validates quantities, measurement boundaries, VAT
configuration and manual-assessment conditions. Biological contamination is
decline/referral-only; no antibacterial, allergen, sanitisation or medical
capability is created. Unknown or unsupported scope suppresses the final price
and/or duration rather than fabricating an answer.

The `/internal/pricing-lab` route contains bundled provisional values for local
testing. It is not linked publicly, is absent from the sitemap, is disallowed
by robots rules and emits no-index/no-follow metadata. The shared internal
layout also returns not-found outside the Next.js development server. Those
controls do not provide authenticated internal access; any future deployed lab
needs an explicit authorization design, and draft books must never be selected
by a customer-facing use case.

Only the reviewed additive migration and commercial seed may run against Neon
`development`. Production and `neon_auth` remain outside Phase 2A authority.

## Phase 2B availability safeguards

Phase 2B persists only team/equipment, working-window, appointment-window,
service-area and travel configuration. It creates no customer, property,
request, occupancy, reservation, booking, employee-account or payment record.
All sample jobs and breaks are ephemeral development fixtures.

The pure engine validates dates, minutes, coordinate pairs, team capability,
equipment state, complete working-window fit and occupancy overlap. It never
assumes zero time for an unconfirmed neighbouring route. Malformed or failed
injected travel estimates fail closed to manual review. Phase 2A manual or
decline/referral results, outside-Sofia work, inactive/unapproved zones,
parking uncertainty, large jobs and two-team requests cannot become automatic
slots.

`/internal/availability-lab` bundles internal team codes, draft price/duration,
travel and utilisation values. Like the pricing lab it has no mutation or
database access, is absent from public navigation and emits no-index/no-follow.
The shared server layout makes both labs development-only by returning not-found
from production builds. This is not a substitute for authentication if an
internal tool is deliberately deployed later, and no customer-facing calendar
is present.

Only the reviewed additive Phase 2B migration and deterministic seed may run on
Neon `development`. Production and Neon Auth-managed schemas remain outside the
phase authorization. No map credential or live provider is introduced.

## Phase 3A identity and authorization

- Neon Auth owns passwords, verification, reset tokens and provider sessions;
  application code never manipulates its schema.
- Application profiles and RBAC are separate public-schema records linked by a
  unique opaque provider subject.
- Signed HttpOnly cookies, `SameSite=Strict`, fixed redirects and server-side
  session checks are used; session credentials never enter localStorage.
- Provider calls remain server-only. No public catch-all, raw sign-in/signup or
  provider-token route is mounted by VAX.
- Every protected operation must re-authorize server-side. Proxy and hidden
  navigation are defense in depth only.
- `SUSPENDED`, `DISABLED`, no-role and missing-permission states deny access.
- Self-registration is fixed to `CUSTOMER`; owner bootstrap is explicit,
  provider-subject-based, idempotent and disabled after ownership exists.
- Login and recovery errors avoid account-existence disclosure and provider
  detail leakage. Passwords, OTPs, reset/session tokens and raw provider errors
  are neither logged nor stored by VAX.
- Production email verification is mandatory in application policy; a false
  environment override is honored only outside production.
- Local auth attempt limiting is process-local. Production auth fails closed
  until a distributed/provider-backed limiter is selected.
- Auth and `/app` routes are private/no-store and noindex, with deny framing,
  MIME-sniffing, referrer and browser-permission headers.
- The enabled development Data API is not an application/browser integration.
  Because application tables do not yet have reviewed RLS, browser token access
  is prohibited until least-privilege grants and row-level policies are designed
  and verified.

Detailed roles, sessions, audit events and remaining production blockers are in
`docs/IDENTITY_AND_ACCESS.md`.

## Auditability

Critical future operations must create durable audit records, including:

- role and permission changes;
- access to sensitive customer information;
- quote, discount, invoice, and payment state changes;
- booking, assignment, and job-status overrides;
- inspection, damage, treatment, and claim changes;
- exports, deletions, and retention actions;
- security-setting changes; and
- equipment or inventory adjustments with business impact.

Audit records should capture actor, action, target, time, source, result, and
correlation context while avoiding secret values and unnecessary sensitive
payloads. Audit logs must not be silently editable by ordinary operators.

## Application safeguards for future phases

- Reconfirm CSRF and cookie policy if social/OAuth or cross-site embedding is added
- Safe output encoding and content security policy
- Distributed rate and abuse controls for quote, booking, authentication, and messaging paths
- Idempotency for bookings, payments, notifications, and webhooks
- File type, size, malware, and authorization controls for uploads
- Encryption in transit and provider-supported encryption at rest
- Dependency and lockfile review
- Centralized sanitized logging and alerting
- Backup, point-in-time recovery, and restoration exercises
- Defined retention and deletion workflows
- Security review before every production gate

## Incident rule

Do not copy suspected secrets into issues, chat, logs, screenshots, or test
output. Preserve minimal evidence, revoke or rotate affected credentials through
the owning provider, assess exposure, and document remediation through an
authorized incident process.
