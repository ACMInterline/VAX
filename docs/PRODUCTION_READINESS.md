# Production Readiness

## Phase 3N checkpoint

Phase 3M established a real HTTPS deployment in a dedicated nonproduction
Vercel project, exact staging Auth origin and test-only SMTP sink, synthetic
browser flows, alert plumbing and portable logical recovery on top of Phase
3L. Phase 3N adds the explicit versioned Business Authority workflow and
derived production-authorization package. It approves no missing fact, does
not deploy or migrate production and does not authorize production.

| Gate                                         | Current status through Phase 3N                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patched supported Next.js 16.3 line          | Implemented and validated in Phase 3J                                                                                                                                                                                                                    |
| Server/runtime database least privilege      | Verified on development and staging                                                                                                                                                                                                                      |
| Migration/runtime credential separation      | Verified; fresh old credentials reject, but live pooler-session revocation remains blocked                                                                                                                                                               |
| Browser/Data API access to VAX tables        | Denied; no browser database integration                                                                                                                                                                                                                  |
| Shared sensitive-action rate limiting        | PostgreSQL-backed, fail-closed and multi-instance verified                                                                                                                                                                                               |
| Staging database                             | Migrated through 0016; 100 public tables and 17 ordered ledger entries under the reviewed security contract                                                                                                                                              |
| Staging Auth                                 | Branch-isolated; six synthetic identities; verification/reset/login/logout and suspension exercised                                                                                                                                                      |
| Hosted HTTPS staging application/origin      | Dedicated Vercel project and exact HTTPS staging origin operational                                                                                                                                                                                      |
| External staging email                       | Generated test-only sink with exact recipient allowlist; no real delivery                                                                                                                                                                                |
| Role browser/IDOR/session rehearsal          | OWNER/DISPATCHER/TECHNICIAN/CUSTOMER fixtures; ADMIN/revoke-all/recent-auth remain fail-closed provider gates                                                                                                                                            |
| Health/readiness and safe structured logging | Hosted endpoints operational; GitHub staging issue receiver defined                                                                                                                                                                                      |
| Recovery                                     | Branch recovery and migration-failure paths rehearsed; production objectives/ownership remain unapproved                                                                                                                                                 |
| Portable logical export                      | Phase 3M PostgreSQL 18 restore/secret scan passed for the historical 98-table/16-entry snapshot; the 0016 delta still needs a later approved portable-restore rerun                                                                                      |
| Business-authority workflow                  | Versioned/effective/environment-scoped and Owner-controlled; exact closed policy semantics and unresolved-retention blocking enforced; no real authority row is seeded or automatically approved                                                         |
| Production readiness evaluator               | Deterministic 17-category blocker report; `CONFIG_REFERENCE` requires exact type/code/version/content-digest resolution, the final GO is release/dependency-snapshot-bound, all missing evidence remains fail-closed and there is no editable ready flag |
| Staging finance scope                        | Derived from explicit `VAX_ENVIRONMENT=staging`; hosted/production scope fails closed when missing and `NODE_ENV` never selects production; no seller/VAT/numbering policy supplied                                                                      |
| Customer/technician actor-aware RLS          | Deferred; server repository authorization remains authoritative                                                                                                                                                                                          |
| Neon Auth provider review                    | Managed Better Auth remains Beta; session/recent-auth gates remain                                                                                                                                                                                       |
| Provider production-branch protection        | Not enabled at this checkpoint; review before production authority                                                                                                                                                                                       |
| Production database migration                | Not authorized; production remains unmigrated                                                                                                                                                                                                            |
| Deployment                                   | Staging-only Vercel deployment authorized; production forbidden                                                                                                                                                                                          |

Hosted infrastructure, database, Auth, migration, limiter, email and recovery
paths are operational. The authority mechanism is implemented, but complete
product acceptance remains `NOT_READY` because the issued-quote Booking cannot
be scheduled without genuine staging-approved duration/availability and its
related operational dependencies; downstream Job, Passport, finance and final
communications remain blocked. Provider Beta/session/recent-auth,
small-viewport/cookie inspection, pooled-credential invalidation and every
production Owner/Accountant/Legal/operational approval remain separate gates.
The Phase 3M portable restore remains valid historical evidence but is not
misreported as proof of the later 100-table/17-entry snapshot.

The current authorization result is `PRODUCTION NOT AUTHORIZED`. A staging
approval cannot satisfy a production dependency, an Owner attestation cannot
replace required external/system evidence and the final deployment decision
cannot pass while any other production dependency is pending.

Zero real authority rows is a valid fail-closed governance outcome, not a
readiness failure in the mechanism. Operationally it means **OWNER INPUT
REQUIRED**, **ACCOUNTANT-LEGAL**, **PROVIDER LIMITATION** and **NOT AUTHORIZED**
gates remain, while only exact controlled evidence may be classified **SYSTEM
VERIFIED**.

See [STAGING_READINESS.md](STAGING_READINESS.md) for the exact evidence and
blockers, [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) for the guarded release
sequence, [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) for recovery limits,
and [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for safe outage handling.
The governed decision model and names-only production manifest are in
[BUSINESS_AUTHORITY.md](BUSINESS_AUTHORITY.md) and
[PRODUCTION_AUTHORIZATION_PACKAGE.md](PRODUCTION_AUTHORIZATION_PACKAGE.md).
