# Deployment Runbook

## Authority boundary

This runbook documents controlled staging and a future production release. It
does not authorize a production migration or deployment. Phase 3M authorizes
only the dedicated Vercel staging project and Neon `staging`. Production
requires a new explicit approval after all readiness gates pass.

Phase 3N adds the governed production-authorization package but performs no
production step. A generated report, an `APPROVED_FOR_PRODUCTION` record or an
Owner signature on a printout is not by itself migration/deployment authority.
The exact release commit, target, active change window and production-
dependency fingerprint still require separate explicit authorization. See
[PRODUCTION_AUTHORIZATION_PACKAGE.md](PRODUCTION_AUTHORIZATION_PACKAGE.md).

## Staging preflight

1. Start from a reviewed commit on protected `main` with green required CI.
2. Confirm the target is the VAX Neon `staging` branch and `neondb`, never a
   value supplied ad hoc at workflow dispatch.
3. Confirm production is neither the parent/target nor represented in any
   runtime, migration, Auth, email or monitoring value.
4. Load `.env.staging.local` only on an operator workstation; require an
   owner-only regular single-link file. Load the independently reviewed
   `.env.staging.target.local` trust manifest under the same file constraints.
   Hosted staging must preserve that credential/target separation in its secret
   manager instead.
5. Confirm the target manifest's database and canonical Auth endpoint
   expectations against the provider control plane, then confirm distinct
   runtime, migrator and administrator identities. Never derive the target
   manifest from the credential URLs it constrains.
6. Review new migration SQL, metadata, order and checksums. Never edit an old
   migration or use schema push.

## Staging database sequence

Run in this order:

```text
npm ci
npm run db:check
npm run db:migrate:staging
npm run db:verify-security:staging
npm run db:verify-state:staging
npm run db:rehearse-staging-rebuild
```

The rotation command is an operator-only rehearsal. It accepts only the
explicit local-rehearsal acknowledgement and requires the exact live staging
project, branch, host, database and administrator identity from the independent
target manifest. It writes only the ignored staging
environment, rotates `vax_runtime`, `vax_migrator` and the staging
administrator, verifies every replacement identity, and refuses finalization
unless superseded sessions across connectable databases and the exact old
pooled/direct runtime, migrator and administrator credentials all reject. The
ignored pending file is created exclusively, fsynced
before the database password transaction and never overwrites a prior recovery
artifact; the final rename and containing directory are also synced. The
database-role operation preserves Auth-cookie and rate-limit HMAC secrets. The
command cannot create or override its target manifest. Confirm the manifest
against the staging control plane before execution. Phase 3L never authorizes a
production target.

Current operational result: password replacement and fresh superseded-
credential rejection work, but a Neon pooled frontend that authenticated before
rotation survives PostgreSQL backend termination. The command correctly leaves
durable recovery credentials and refuses to report success. Do not use it as a
production rotation procedure until a provider-supported endpoint restart or
pooler-session revocation step is approved, integrated and rehearsed. Recover a
failed staging attempt only after independently verifying every pending
identity; never discard the only valid replacement set.

Stop immediately if identity, checksum, table, RBAC, data, Auth or role counts
diverge. Never weaken the guard to make a command pass.

## Application configuration and start

For the authorized loopback-only rehearsal:

```text
npm run dev:staging
```

The launcher accepts only the explicit staging/local combination and binds to
127.0.0.1. Its child receives runtime values only; operator variables are
masked against Next.js dotenv reload, omitted staging keys cannot inherit
ambient values, and an unknown development dotenv key blocks startup. Before
spawn it binds both the pooled runtime database and canonical Auth base URL to
the independent target manifest. A future hosted release must remove the localhost exception,
inject an exact HTTPS `PUBLIC_SITE_URL` and matching `AUTH_TRUSTED_ORIGINS`,
configure the exact trusted proxy hop count, and keep database/Auth secrets
server-only. The ingress must overwrite or append `X-Forwarded-For`
consistently with that count and must prevent direct access to the application
origin. Hosted staging/production configuration fails closed when that positive
hop count is absent; loopback mode trusts no proxy and intentionally applies
account-only plus source-account buckets to account-bearing actions.

Hosted Phase 3M uses a dedicated Vercel project, the Preview environment and the
stable exact origin `https://vax-phase3m-staging-preview.vercel.app`. Deploy from
a clean reviewed snapshot with `npm ci` and the repository build command. Do
not use Vercel's production target, connect a production domain or upload a
migrator/administrator URL. Reconcile the stable alias to the merged `main`
commit after the protected merge.

Before serving traffic, verify:

- liveness is 200;
- readiness is 200 (not degraded/not-ready);
- database/Auth/migrations/rate limiting/email are all ready;
- global staging noindex and sensitive cache headers are present;
- the HTTPS terminator supplies a valid certificate and HSTS is present only
  after HTTPS is real;
- no production canonical, callback, cookie or credential is visible; and
- the staged commit exactly matches the reviewed/CI-tested commit.

## Auth and email release gate

Do not enable public staging signup until an approved test-recipient-only mail
sink/sandbox is configured. Then use only synthetic recipients and verify
signup, verification, login/logout, reset request/completion, token expiry and
reuse denial, session behavior, generic enumeration-resistant responses and
cleanup. Confirm HttpOnly, Secure, SameSite and expiry attributes over HTTPS.

Provider shared development email is not production or staging deliverability
evidence. Production requires owner-approved custom SMTP, SPF/DKIM/DMARC,
suppression/bounce/retry policy and monitoring.

## Monitoring and rollback

Route sanitized structured events and safe health metrics to an approved
receiver. Alert on app/readiness/DB/Auth outages, migration mismatch, high 5xx,
rate-limit failures, finance invariants and communication backlog/failures.
Network-restrict readiness and poll it at a bounded interval; use liveness for
high-frequency process health. The application coalesces readiness dependency
work only within each instance, returns a safe timeout response after three
seconds, and retains one underlying probe until it settles rather than launching
more dependency work. This does not replace ingress controls.

The Phase 3M staging monitor uses the protected GitHub `staging` environment,
an exact `STAGING_ORIGIN` environment variable and minimal `contents: read` /
`issues: write` permissions. It checks liveness/readiness without recording
response bodies. A failed probe opens or updates one sanitized staging issue; a
healthy recovery run comments and closes it. The repository owner who receives
GitHub issue/workflow notifications is the staging incident owner. This is not
a production on-call commitment.

Application rollback means redeploying the last compatible reviewed image. Do
not automatically down-migrate. Before a schema change, document the previous
application's forward compatibility with the new schema. If data recovery is
required, create/inspect a recovery branch first and follow
[BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md).

## Production gate

Before a production runbook can be executed, require all of the following:

- a current Phase 3N report with every production-required authority dependency
  effective and passing, including a trusted exact resolver result for every
  configuration reference and the explicit final Owner GO;
- explicit valid `VAX_ENVIRONMENT=production`; never infer the VAX environment
  from `NODE_ENV` or continue when the explicit value is missing/blank;
- hosted staging and complete synthetic role/IDOR/Auth/email rehearsals;
- owner acceptance of Neon Auth Beta/support/session limitations;
- a provider-supported database pooler-session invalidation procedure for
  credential rotation;
- reviewed monitoring, alert delivery and incident ownership;
- proven portable export plus approved backup retention/RPO/RTO;
- exact production runtime/migrator/admin credentials and least-privilege/RLS
  review on the production topology;
- a reviewed maintenance-window procedure that provisions and rotates the
  domain-separated Business Authority actor-context verifier with the Auth
  cookie secret, drains all application instances and proves new-signature
  success plus old-signature rejection without exposing either value;
- approved seller identity, VAT/fiscal/accounting, Invoice numbering, payment,
  privacy/retention and legal configuration;
- a reviewed production migration plan, rollback compatibility and change
  window;
- an Owner GO bound to the exact release commit, target, active change window
  and current production-dependency fingerprint; and
- separate explicit production migration and deployment authorization.

Pending migrations and their ledger writes must run through the atomic
node-postgres migrator path. Provisioning the secret-derived actor-context
verifier is a separate guarded migrator step after schema commit; until it and
the exact application secret agree, keep Business Authority mutations closed.

Never force-push, bypass protected `main`, reuse staging credentials, accept a
free-form production target or run a production mutation from this Phase 3L
command set.
