# Production Authorization Package

## Package purpose

This document defines the owner-facing evidence package and release gate for a
future VAX production launch. The generated application view must populate it
from the versioned Business Authority registry; this file supplies the
interpretation, manifest and ordered change plan.

It is not a legal certificate, an accounting opinion, a security guarantee or
a production runbook authorization. Phase 3N does **not** migrate Neon
production, deploy a production application, change production Auth/SMTP/DNS,
create a production Owner, activate production Invoice numbering, enable
payments/fiscal integration or communicate with customers.

Production remains `NOT_AUTHORIZED` until every required dependency is
currently effective for `PRODUCTION`, every technical gate passes against the
exact release target and the owner grants separate, explicit migration and
deployment authority bound to the exact release commit, target, active change
window and computed production-dependency fingerprint.

## How to read the generated report

For each of the 17 readiness categories, the report must show:

- approved records and exact versions;
- pending, rejected, future-effective, expired or superseded records;
- evidence class and safe source/evidence reference;
- required authority types and recorded decisions;
- effective-from and effective-until dates;
- environment scope;
- exact blocker codes and operational impact;
- known risk acceptances and mitigations; and
- the remaining sign-off requirement.

Every `CONFIG_REFERENCE` must resolve through a trusted server-side resolver
to an exact environment-matched `subjectType`, `subjectCode`, positive
`subjectVersion` and SHA-256 content digest (`contentSha256`). Merely storing a
well-formed reference is insufficient. A missing resolver, missing referenced
snapshot, provisional or unresolved snapshot, inactive effective window or
any type/code/version/digest mismatch is a technical blocker.
The Phase 3N PostgreSQL repository provides no universal resolver, so these
references remain blocked until a separately reviewed exact resolver is
available; the report must not infer resolution from the authority row.

The printable view is a review artifact only. Printing, exporting or signing a
copy does not mutate approval state. The report cannot accept a client-supplied
ready flag and cannot transform `APPROVED_FOR_STAGING` into
`APPROVED_FOR_PRODUCTION`.

Matrix statuses have these meanings:

| Status                         | Meaning                                                                                                          |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------- |
| `PASS`                         | All required, currently effective production authority and exact technical evidence for the category are present |
| `OWNER_APPROVAL_REQUIRED`      | A specific owner business decision is absent                                                                     |
| `ACCOUNTANT_APPROVAL_REQUIRED` | A qualified accounting/tax decision or evidence is absent                                                        |
| `LEGAL_REVIEW_REQUIRED`        | Qualified legal review is absent; an owner assertion is insufficient                                             |
| `PROVIDER_LIMITATION`          | A provider capability/contract limitation remains unresolved or awaits explicit risk disposition                 |
| `TECHNICAL_BLOCKER`            | A required control has not been proven against the exact production topology                                     |
| `NOT_AUTHORIZED`               | The operation is outside current authority even if preparatory evidence exists                                   |

For owner-facing review, these statuses roll up into five explicit
classifications: **SYSTEM VERIFIED** (controlled exact-target evidence),
**OWNER INPUT REQUIRED** (missing business choice), **ACCOUNTANT-LEGAL**
(qualified professional decision still required), **PROVIDER LIMITATION**, and
**NOT AUTHORIZED**. The presentation does not collapse a technical blocker into
Owner input or treat an Owner decision as professional/system evidence.

## Current Phase 3N starting position

The protected Phase 3M baseline provides hosted HTTPS staging, separated
runtime/migrator database roles, RLS/grant verification, shared fail-closed
rate limiting, a generated test-only email sink, synthetic Auth/business flows,
sanitized monitoring, branch recovery and portable logical restore evidence.
That evidence is nonproduction evidence.

The full hosted product path remains deliberately blocked after the immutable
issued-Quote acceptance and Booking because duration, availability and related
operational knowledge is provisional/inactive. No production business value,
seller/tax fact, legal term, provider acceptance or release decision is
inferred from the staging fixtures.

At package creation:

- no production operational authority is assumed;
- no staging approval counts as production approval;
- no current provisional price, duration, hour, zone, team or equipment fixture
  is automatically promoted;
- no product/claims evidence is fabricated;
- Neon production remains untouched and unmigrated; and
- the final deployment decision remains `NOT_AUTHORIZED`.

Having zero real authority rows is valid evidence that governance failed closed
instead of inventing operational knowledge. It is not a partial production
approval: every dependent category remains pending and deployment remains
`NOT_AUTHORIZED`.

## GO / NO-GO matrix

The generated evaluator is the source for current record-level results. Until
real approvals and exact production verification exist, the expected gate
classification is:

| Readiness category       | Required evidence/decision                                                                                                                                | Initial gate                                                                                                                  |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Brand/content            | Final brand/trademark/publication choice, verified public contacts, evidence-backed claim inventory                                                       | `OWNER_APPROVAL_REQUIRED`; claims also require external evidence and Content/Claims review                                    |
| Service scope            | Offered/assessment/refer/decline services, item/material/treatment/product/Job/Passport policy                                                            | `OWNER_APPROVAL_REQUIRED`; specialist/product/claim facts require external evidence                                           |
| Pricing                  | Exact residential/B2B books, minimums, modifiers, add-ons, timing and rounding                                                                            | `ACCOUNTANT_APPROVAL_REQUIRED` plus Owner commercial approval                                                                 |
| VAT/tax                  | Actual registration decision, basis and effective date                                                                                                    | `ACCOUNTANT_APPROVAL_REQUIRED`                                                                                                |
| Seller/legal             | Approved legal identity/contact/address/payment-instruction profile                                                                                       | `LEGAL_REVIEW_REQUIRED` and `ACCOUNTANT_APPROVAL_REQUIRED`                                                                    |
| Scheduling               | Approved duration, hours, windows, per-service availability/instant Quote/Booking scope and customer terms                                                | `OWNER_APPROVAL_REQUIRED`; global instant modes remain blocked until per-service authority exists; terms require Legal review |
| Travel                   | Verified Sofia boundaries, included/outside area, routing, buffers, parking and surcharges                                                                | `OWNER_APPROVAL_REQUIRED`; boundary/provider evidence remains required                                                        |
| Teams/equipment          | Actual teams, capacity, skills, equipment and maintenance/assignment state                                                                                | `OWNER_APPROVAL_REQUIRED`                                                                                                     |
| Auth                     | Neon Auth Beta/session/recent-auth limitation decision and session/emergency policy                                                                       | `PROVIDER_LIMITATION`                                                                                                         |
| Privacy/retention        | Category periods, erasure exceptions, notices/consent and deletion workflow                                                                               | `LEGAL_REVIEW_REQUIRED`                                                                                                       |
| Email                    | Production provider, sender identity, delivery policy and SPF/DKIM/DMARC evidence                                                                         | `PROVIDER_LIMITATION` until selected and verified; Owner/Technical approval required                                          |
| Monitoring               | Real alert recipients, response hours, severity/escalation and ownership                                                                                  | `OWNER_APPROVAL_REQUIRED`                                                                                                     |
| Backup/recovery          | Approved objectives, export/retention/offsite policy and restore authority                                                                                | `OWNER_APPROVAL_REQUIRED`; exact production rehearsal remains a technical gate                                                |
| Finance/fiscal           | Numbering, payment terms, document/cash/fiscal/accounting/refund decisions                                                                                | `ACCOUNTANT_APPROVAL_REQUIRED` and `LEGAL_REVIEW_REQUIRED`                                                                    |
| Database                 | Exact production branch protection, roles, migrations, grants, RLS, seeds and first-owner bootstrap evidence                                              | `NOT_AUTHORIZED` before a separate production migration approval                                                              |
| Domain/TLS               | Real public/app/canonical/Auth origins, DNS and certificate evidence                                                                                      | `OWNER_APPROVAL_REQUIRED`; configuration remains a technical gate                                                             |
| Deployment authorization | Exact reviewed release commit, target, active change window and production-dependency fingerprint, with all dependencies passing and an explicit final GO | `NOT_AUTHORIZED`                                                                                                              |

Any `PROVIDER_LIMITATION`, `TECHNICAL_BLOCKER`, `NOT_AUTHORIZED` or missing
required professional approval makes the package a NO-GO. A printable report
cannot override that result.

## Exact business decisions still required

### Owner

The Owner must supply or explicitly approve, without inference:

- final public brand/trademark posture and verified contact/service-area
  wording;
- exact service, item, material/specialist, treatment/product, drying and
  claim-publication scope;
- residential/B2B pricing, minimums, modifiers, add-ons, timing, commercial
  rounding and effective dates;
- teams, crew/capacity, equipment, operating days/hours, appointment windows,
  duration/buffer policy and Job/Passport process;
- Sofia boundaries, included/outside-area, routing-provider choice, travel,
  parking and surcharge policy;
- per-service instant Quote/Booking versus staff-review choices, Quote validity,
  Booking/rescheduling/cancellation policy;
- Auth-provider risk outcome and Auth session/emergency policy;
- real production SMTP/provider and sender choice;
- monitoring recipient/coverage/escalation and restore authority;
- proposed RPO/RTO and backup-retention objectives;
- real production domains/origins; and
- a final GO/NO-GO bound to the exact release commit, target, active change
  window and production-dependency fingerprint after every other gate passes.

### Accountant

A qualified Accountant must review and approve as applicable:

- actual VAT registration/status and effective date;
- tax basis and compatibility of the production price-book presentation;
- seller registration/VAT facts and customer-visible payment instructions;
- Invoice policy, document types, production numbering prefix/start/sequence;
- payment/due/prepayment terms, cash handling, credit/refund implications; and
- accounting/fiscal-system requirements and any legally required exports or
  receipts.

### Legal

Qualified Legal review remains required for:

- seller/business disclosures and customer-facing service/claim wording where
  applicable;
- Quote validity, Booking, cancellation, rescheduling, existing-damage and
  customer handover terms;
- privacy notices, retention periods, erasure exceptions, finance/legal record
  obligations and marketing-consent separation;
- Invoice/payment/fiscal/customer-document terms and correction/refund policy;
  and
- production incident/breach notification criteria and external commitments.

VAX does not offer a generic “legally compliant” approval action.

### Provider and technical decisions

The package must retain these exact limitations until resolved or explicitly
disposed through the appropriate governed record:

1. **Neon Auth:** the managed Better Auth path is Beta. Hosted staging proves
   core email/password flows, but reliable complete session inventory/revoke-
   all, provider-attested recent authentication and the complete suspended-user
   session contract are unavailable in the installed integration. The governed
   outcome is `ACCEPT_FOR_INITIAL_PRODUCTION`,
   `REQUIRE_ALTERNATIVE_PROVIDER` or `BLOCK_PRODUCTION`; Phase 3N chooses none.
2. **Pooled database credential invalidation:** fresh superseded credentials
   reject, but a previously authenticated pooled frontend survived backend
   termination and reacquired a backend. The available tooling supplies no
   approved endpoint restart/drain or frontend-revocation operation. A
   provider-supported procedure must be documented and rehearsed before the
   rotation control can pass.
3. **Recovery:** branch recovery and portable staging restore are proven, but
   the production history window, snapshot/Beta constraints, encrypted
   off-provider retention and exact restore ownership remain unapproved.
4. **Email:** the staging sink proves only synthetic nonproduction delivery.
   It is not a production provider or deliverability result.
5. **Production topology:** runtime/migrator/RLS evidence must be repeated
   against the exact future production branch and hosting configuration after
   separate authorization. Staging evidence is not substituted.

Owner risk acceptance does not change a failed technical result into
`SYSTEM_VERIFIED`. Where policy requires a technical invariant, the package
remains blocked until that invariant is proven or the reviewed architecture is
changed under separate authority.

## Production configuration manifest — names only

This manifest intentionally contains no values. Secrets belong in the approved
hosting/provider secret managers, never source, CI output, logs, the authority
report or customer-visible pages. Business facts belong in approved versioned
authority/configuration records, not environment variables.

### Application runtime

| Key                           | Purpose                                                                                      | Handling                                                                                                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `VAX_ENVIRONMENT`             | Select the production application boundary                                                   | Required, nonblank server-only exact value; `NODE_ENV` never selects production authority                                                                              |
| `DATABASE_URL`                | Pooled `vax_runtime` application connection                                                  | Server-only secret; runtime role only; `sslmode=verify-full`                                                                                                           |
| `PUBLIC_SITE_URL`             | Approved exact public application origin                                                     | Non-secret; exact HTTPS origin without path/query/credentials                                                                                                          |
| `NEON_AUTH_BASE_URL`          | Exact production-branch Auth endpoint                                                        | Server-only configuration; exact HTTPS endpoint                                                                                                                        |
| `NEON_AUTH_COOKIE_SECRET`     | Application session-cookie and domain- plus environment-separated Business Authority actor-context root secret | Server-only secret, independently generated per environment; its derived database verifier must be provisioned/rotated through the guarded migrator path without exposing either value |
| `AUTH_REQUIRE_VERIFIED_EMAIL` | Email-verification intent                                                                    | Production code remains fail-closed even if mis-set                                                                                                                    |
| `AUTH_TRUSTED_ORIGINS`        | Exact approved application origins                                                           | Non-secret allowlist; no wildcard/loopback                                                                                                                             |
| `RATE_LIMIT_BACKEND`          | Shared sensitive-action limiter selection                                                    | Must select the shared database boundary                                                                                                                               |
| `RATE_LIMIT_HASH_SECRET`      | HMAC material for limiter keys                                                               | Server-only secret, independent from Auth/DB secrets                                                                                                                   |
| `VAX_TRUSTED_PROXY_HOPS`      | Exact reviewed ingress forwarding topology                                                   | Positive bounded count; direct-origin access must be controlled                                                                                                        |
| `EMAIL_DELIVERY_MODE`         | Application email-readiness state                                                            | Production is ready only for the custom-SMTP mode                                                                                                                      |

`STAGING_ALLOW_LOCALHOST` and `STAGING_AUTH_EMAIL_ALLOWLIST` are staging-only
controls and must not be present as production escape hatches.

### Migration and operator trust manifest

These values belong only in a separately authorized, short-lived migration or
bootstrap context. They must not enter the hosted application runtime:

| Key                                     | Purpose                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| `MIGRATION_DATABASE_URL`                | Direct `vax_migrator` connection for reviewed migrations/seeds               |
| `DATABASE_ADMIN_URL`                    | Operator-only bootstrap/recovery connection                                  |
| `DATABASE_ADMIN_EXPECTED_ROLE`          | Independently reviewed administrator identity guard                          |
| `DATABASE_MUTATION_ENVIRONMENT`         | Explicit production mutation intent for a future production-specific command |
| `DATABASE_MUTATION_EXPECTED_PROJECT_ID` | Exact provider project guard                                                 |
| `DATABASE_MUTATION_EXPECTED_BRANCH_ID`  | Exact production branch guard                                                |
| `DATABASE_MUTATION_EXPECTED_HOST`       | Exact direct-host guard                                                      |
| `DATABASE_MUTATION_EXPECTED_DATABASE`   | Exact database-name guard                                                    |
| `NEON_AUTH_EXPECTED_BASE_URL`           | Independent production Auth endpoint guard                                   |
| `AUTH_BOOTSTRAP_PROVIDER_USER_ID`       | One-time provider identity input for the reviewed first-Owner bootstrap      |

The existing development/staging mutation commands deliberately refuse
production. Do not weaken or reuse them. A future production-specific executor
must be reviewed, accept only an independently verified fixed target manifest,
fail closed on any mismatch and require separate production mutation authority.

### Provider/control-plane configuration

The following are required configuration objects, not repository variable
values:

- protected Neon production branch/database and independent runtime, migrator
  and administrator identities;
- Neon Auth email/password, mandatory verification, exact trusted origin and
  approved session policy;
- production SMTP host/transport credentials stored by the provider, approved
  From and reply-to identity, and SPF/DKIM/DMARC DNS evidence;
- exact Vercel/hosting project, production domain/canonical origin, ingress
  forwarding contract and environment-secret scopes;
- sanitized production monitoring receiver, alert routing, service-health
  probes and incident ownership; and
- encrypted backup/export destination, retention/access policy and restore
  authority.

### Approved business configuration

The production database must contain approved, effective `PRODUCTION` versions
for all required Business Authority keys. At minimum this includes the real
seller legal profile, VAT status, price books, Invoice policy and numbering,
service/travel/scheduling/capacity policies, privacy/retention, provider risk,
email identity, monitoring, recovery, domains and final deployment decision.
The manifest names those dependencies but supplies none of their values.

## Expected production database bootstrap plan

This is a future plan, not executable authority:

1. Protect and independently identify the exact production branch/database;
   do not derive the trust manifest from a supplied credential URL.
2. Provision separate `vax_runtime` and `vax_migrator` identities. Runtime uses
   pooled application traffic; migrator and administrator use direct operator
   paths. No runtime role owns objects, administers roles, bypasses RLS or runs
   DDL.
3. Verify the empty/expected starting inventory and all historical repository
   migration checksums before mutation.
4. Apply the reviewed migrations in order with the exact release migrator.
   Each migration must remain transactionally atomic; never schema-push, edit
   history, split one reviewed migration across ad-hoc mutations or
   automatically down-migrate.
5. Through the guarded migrator path, provision the purpose- and
   environment-derived Business Authority actor-context verifier from the exact
   runtime cookie secret plus explicit `VAX_ENVIRONMENT`. Never
   store the root secret in the database or expose either value. Until this
   succeeds, authority mutations must remain fail closed.
6. Apply canonical non-business seeds only. Do not seed prices, seller/VAT,
   contacts, bank/payment facts or synthetic staging identities into
   production.
7. Verify table/function ownership, grants, RLS enable/force state, policies,
   constraints, indexes, migration ledger, canonical RBAC and runtime denials
   against the expected manifest.
8. Insert only separately approved production authority/configuration versions
   through their controlled workflows; retain evidence and effective dates.
9. Bootstrap the first Owner only from an already verified production provider
   identity through the separately reviewed one-time command. Remove the
   bootstrap input immediately after verification; never reuse staging
   identity material.
10. Confirm there is no browser/Data API authority and that public,
    authenticated and anonymous database roles have no unintended VAX table
    access.
11. Preserve an encrypted, verified pre-release recovery artifact and exact
    rollback/application compatibility evidence.

## Ordered production change plan

Every mutating step below needs a new, explicit authorization. Phase 3N stops
before step 1 is executed.

1. Complete all real Owner inputs and service/operational approvals.
2. Obtain qualified Accountant and Legal decisions with controlled evidence.
3. Resolve or explicitly disposition Auth/provider limitations and prove the
   required database credential/session invalidation procedure.
4. Approve monitoring ownership, incident contacts, recovery objectives,
   backup retention, restore owner, rollback compatibility and change window.
5. Approve exact public/app/Auth/canonical origins, hosting target, production
   email provider and sender/DNS identity.
6. Approve a cookie-secret/Business Authority derived-key provisioning and
   rotation runbook that blocks authority mutation during mismatch, drains old
   instances and proves new-write success plus old-signature rejection.
7. Freeze a reviewed protected-`main` commit, migration set, configuration
   manifest and production authorization report; require green CI/security and
   compute the canonical fingerprint of the exact effective production
   dependency records.
8. Grant separate production database bootstrap/migration authorization for
   the exact target and commit.
9. Provision the protected database roles, take recovery evidence, apply the
   atomic migration set, provision the derived actor-context verifier, apply
   canonical seeds and verify grants/RLS/ledger/state.
10. Create the approved production authority/configuration versions and verify
    their effective windows without rewriting historical data.
11. Create/verify the production provider identity and execute the one-time
    first-Owner bootstrap; verify Auth role separation.
12. Configure exact production Auth, custom SMTP, sender DNS, hosting secrets,
    monitoring and ingress/origin controls. Do not reuse staging values.
13. Recompute the authorization package. Require every category to pass and
    record a final Owner `GO` containing the exact release commit, target,
    active change window and just-computed dependency fingerprint.
14. Grant separate production deployment authorization and deploy only the
    reviewed immutable artifact.
15. Run bounded smoke, Auth/email, IDOR, rate-limit, finance-invariant,
    readiness, monitoring and rollback checks with non-customer validation
    identities. Abort before public exposure on any failure.
16. Observe the agreed stabilization window. Enable public indexing and any
    customer communication only through explicit final business authorization.

No step authorizes live payments, fiscal devices, accounting integration or
real customer communication unless a separately reviewed implementation and
approval expressly includes it.

## Hard abort conditions

Stop the release and leave production unavailable for mutation/traffic if any
of the following is true:

- production migration or deployment authority is absent, ambiguous, expired
  or applies to a different release commit, target, change window or dependency
  fingerprint;
- protected `main`, required CI, exact-snapshot security review or dependency
  audit is not green;
- any historical migration checksum/order differs from the reviewed manifest;
- the project, branch, host, database, role, Auth endpoint or hosting origin
  does not exactly match the independently reviewed production manifest;
- production credentials, provider identifiers or secrets appear in source,
  logs, reports, artifacts, browser code or command output;
- the Business Authority derived verifier is absent/mismatched, readable by the
  runtime, or was not coordinated with the exact cookie-secret deployment; a
  signed actor context is absent, stale, future-skewed, mismatched or forged;
- the runtime identity owns objects, can run DDL/role administration, has
  `BYPASSRLS`, can read the migration ledger directly or has broader privileges
  than the verified policy;
- grants, RLS, ownership, constraints, indexes, canonical RBAC or migration
  attestation differs from expectation;
- any required authority record is missing, staging-scoped, malformed,
  future-effective, expired, rejected, superseded or lacks all required
  authority evidence;
- a governed policy set is missing or adds a code, uses a numeric value/unit on
  a nonnumeric entry, or violates the exact unit and minimum/integer contract;
- any retention rule still carries the unresolved
  `LEGAL_REVIEW_REQUIRED` erasure exception;
- hosted `VAX_ENVIRONMENT` is missing, blank or invalid, or any process attempts
  to infer VAX production authority from `NODE_ENV`;
- any `CONFIG_REFERENCE` lacks a trusted resolver result or its exact
  type/code/version/content digest, environment, status, effective window,
  provisional state or manual-review state fails to match;
- the price book, VAT status, seller profile, Invoice policy/numbering or
  payment terms are unresolved while Invoice draft/issue is enabled;
- service area, durations, teams/equipment, hours, travel/buffers or per-service
  instant Quote/Booking policy is unresolved while automatic availability is
  enabled, or a global `INSTANT_*` value is offered as service-specific
  authority;
- Auth origin/canonical URL differs, verified-email is not mandatory, the Auth
  provider risk is undisposed or session/emergency behavior fails closed;
- production SMTP/sender identity or SPF/DKIM/DMARC evidence is incomplete
  while external email is enabled;
- the established-pooler invalidation limitation remains incompatible with the
  approved credential-rotation/incident policy;
- monitoring has no real receiver/owner/escalation or readiness cannot be
  safely observed;
- no approved recovery objective, portable recovery path, restore authority,
  rollback-compatible artifact or pre-release evidence exists;
- staging synthetic contacts, identities, credentials, numbers or business
  facts appear in production configuration;
- an immutable Quote, Booking, Job, Invoice or customer document would need to
  be refreshed, repaired, renormalized or repriced for the release to work;
- smoke/IDOR/Auth/rate-limit/finance/readiness/monitoring checks fail; or
- the final production deployment authority is anything other than an explicit
  current Owner `GO` after all dependencies pass.

Do not suppress a gate, edit the readiness result, weaken target validation,
reuse staging infrastructure or automatically roll back the database merely to
continue a release.

## Immutable history and rollback

Production authority applies prospectively. A changed price, VAT state, seller
fact, duration, service scope or customer term creates a new version; it does
not alter issued Quotes, accepted Bookings, scheduled/field evidence, issued
Invoices or rendered documents. Any provenance inconsistency fails to staff
review.

Application rollback redeploys the last reviewed schema-compatible artifact.
Database down-migration is not automatic. If data recovery is required, first
create and inspect a recovery branch, verify migration/RBAC/business
invariants, obtain restore authority and only then move an endpoint or restore
in place.

## Final authorization statement

The initial Phase 3N package outcome is:

```text
PRODUCTION NOT AUTHORIZED
```

That outcome remains in force until the generated report shows current,
production-scoped evidence for every required category, the exact production
topology passes the technical verification, all Owner/Accountant/Legal/provider
decisions are recorded and separate production migration and deployment
approvals are granted for the exact release commit, target, active change
window and current dependency fingerprint. Preparing or approving this
document alone performs no production change.
