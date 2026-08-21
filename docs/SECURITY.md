# Security

## Security posture for Phase 0A

This phase establishes safe defaults; it does not claim production security
readiness. Authentication, authorization, rate limiting, deployment controls,
monitoring, recovery, and production data governance remain future work.

## Time-bound framework advisory

As of 22 August 2026, Next.js has announced an upcoming 26 August security
release for the 16.3 line that includes a critical fix. This repository uses
the current stable 16.3.2 package and must not be deployed until it has been
upgraded to the patched stable release and the full validation suite has been
rerun. Update or remove this note after that upgrade.

Reference: [Upcoming Next.js August Security Release](https://nextjs.org/blog/upcoming-nextjs-security-release-august-2026)

Deployment remains blocked until all of the following are complete:

1. The scheduled patched stable Next.js 16.3 release is available.
2. The repository is upgraded to that patched release.
3. The full validation suite passes again.
4. A security review is complete.
5. Deployment is explicitly authorized.

## Secrets and environment configuration

- DATABASE_URL is the only current runtime secret-bearing variable.
- Read it from the environment through the validated server-side boundary.
- Never hard-code, log, return, test-fixture, or commit a real connection value.
- Never commit .env, .env.local, credentials, tokens, keys, or certificates.
- Keep .env.example limited to variable names and empty values.
- Use separate credentials and databases per environment.
- Local development must use the VAX Neon `development` branch, never the
  production branch.
- Future staging and production environments must inject DATABASE_URL through
  their deployment platform rather than use a committed environment file.
- GitHub Actions must validate without a live database credential and must not
  apply migrations.
- Rotate credentials if exposure is suspected; do not merely delete a committed
  secret.

Client components and browser bundles must never import server environment or
database modules.

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

The current migration was generated locally and applied only to the VAX Neon
`development` branch during Phase 0B. Applying any migration to production
requires separate explicit authorization.

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

## Future identity and authorization

- Keep the authentication provider replaceable.
- Store application-owned user identity separately from provider subject IDs.
- Deny by default and grant the minimum required permissions.
- Enforce authorization in use cases and data access, not only in UI controls.
- Protect privileged role changes and recovery flows with strong
  re-authentication where appropriate.
- Invalidate or re-evaluate sessions after material permission changes.

Detailed RBAC is intentionally deferred to Phase 3.

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

- CSRF protection appropriate to the chosen session architecture
- Safe output encoding and content security policy
- Rate and abuse controls for quote, booking, login, and messaging paths
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
