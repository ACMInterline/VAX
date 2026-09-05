# Production Readiness

## ATTELIER finalization checkpoint

Phase 3M established a real HTTPS deployment in a dedicated nonproduction
Vercel project, exact staging Auth origin and test-only SMTP sink, synthetic
browser flows, alert plumbing and portable logical recovery on top of Phase
3L. Phase 3N adds the explicit versioned Business Authority workflow and
derived production-authorization package. ATTELIER finalization uses that
boundary for an exact staging-only calibration. It does not deploy or migrate
production and does not authorize production.

| Gate                                         | Current ATTELIER closure status                                                                                                                                                                                                                          |
| -------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Patched supported Next.js 16.3 line          | Implemented and validated in Phase 3J                                                                                                                                                                                                                    |
| Server/runtime database least privilege      | Verified on development and staging                                                                                                                                                                                                                      |
| Migration/runtime credential separation      | Verified; fresh old credentials reject, but live pooler-session revocation remains blocked                                                                                                                                                               |
| Browser/Data API access to VAX tables        | Denied; no browser database integration                                                                                                                                                                                                                  |
| Shared sensitive-action rate limiting        | PostgreSQL-backed, fail-closed and multi-instance verified                                                                                                                                                                                               |
| Staging database                             | Migrations 0017/0018 define 100 public tables and 19 ordered ledger entries; guarded live evidence is recorded in the finalization report                                                                                                                     |
| Staging Auth                                 | Branch-isolated; six synthetic identities; verification/reset/login/logout and suspension exercised                                                                                                                                                      |
| Hosted HTTPS staging application/origin      | Dedicated Vercel project and exact HTTPS staging origin operational                                                                                                                                                                                      |
| External staging email                       | Generated test-only sink with exact recipient allowlist; no real delivery                                                                                                                                                                                |
| Role browser/IDOR/session rehearsal          | OWNER/DISPATCHER/TECHNICIAN/CUSTOMER fixtures; ADMIN/revoke-all/recent-auth remain fail-closed provider gates                                                                                                                                            |
| Health/readiness and safe structured logging | Hosted endpoints operational; GitHub staging issue receiver defined                                                                                                                                                                                      |
| Recovery                                     | Branch recovery and migration-failure paths rehearsed; production objectives/ownership remain unapproved                                                                                                                                                 |
| Portable logical export                      | Phase 3M PostgreSQL 18 restore/secret scan passed for the historical 98-table/16-entry snapshot; the final 0016–0018 delta still needs a later approved portable-restore rerun                                                                           |
| Business-authority workflow                  | 29 exact staging proposals: 16 staging-approved and 13 deliberately under review; no production record or universal resolver                                                                                                                            |
| Production readiness evaluator               | Deterministic 17-category blocker report; `CONFIG_REFERENCE` requires exact type/code/version/content-digest resolution, the final GO is release/dependency-snapshot-bound, all missing evidence remains fail-closed and there is no editable ready flag |
| Staging finance scope                        | Owner-approved gross prices can be estimated; VAT/rate/net remain unresolved and Quote/Invoice issue stays blocked without seller, VAT, numbering and professional authority                                                                            |
| Customer/technician actor-aware RLS          | Deferred; server repository authorization remains authoritative                                                                                                                                                                                          |
| Neon Auth provider review                    | Managed Better Auth remains Beta; session/recent-auth gates remain                                                                                                                                                                                       |
| Provider production-branch protection        | Not enabled at this checkpoint; review before production authority                                                                                                                                                                                       |
| Production database migration                | Not authorized; production remains unmigrated                                                                                                                                                                                                            |
| Deployment                                   | Staging-only Vercel deployment authorized; production forbidden                                                                                                                                                                                          |

Hosted infrastructure, database, Auth, migration, limiter, email and recovery
paths are operational. The authority mechanism is implemented, but complete
product acceptance remains `NOT_READY`. ATTELIER brand, scope, duration,
hours/windows, zones and staff-confirmation policy close much of the earlier
operational-authority gap. The lifecycle now stops honestly at a gross estimate:
the current Quote representation cannot issue gross-only unknown-tax quotes;
its unresolved-source-VAT gate must not be bypassed with staff numeric tax. This
implementation limitation is distinct from statutory invoice readiness, while
real teams/equipment/routes/products remain absent for later scheduling and Job
execution. Provider Beta/session/recent-auth,
small-viewport/cookie inspection, pooled-credential invalidation and every
production Owner/Accountant/Legal/operational approval remain separate gates.
The Phase 3M portable restore remains valid historical evidence but is not
misreported as proof of the final 100-table/19-entry snapshot.

The current authorization result is `PRODUCTION NOT AUTHORIZED`. A staging
approval cannot satisfy a production dependency, an Owner attestation cannot
replace required external/system evidence and the final deployment decision
cannot pass while any other production dependency is pending.

The exact staging records are genuine Owner-directed nonproduction authority,
not production authority. **ACCOUNTANT-LEGAL**, **OPERATIONAL EVIDENCE**,
**PROVIDER LIMITATION** and **NOT AUTHORIZED** gates remain, while only exact
controlled evidence may be classified **SYSTEM VERIFIED**.

See [STAGING_READINESS.md](STAGING_READINESS.md) for the exact evidence and
blockers, [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) for the guarded release
sequence, [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) for recovery limits,
and [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for safe outage handling.
The governed decision model and names-only production manifest are in
[BUSINESS_AUTHORITY.md](BUSINESS_AUTHORITY.md) and
[PRODUCTION_AUTHORIZATION_PACKAGE.md](PRODUCTION_AUTHORIZATION_PACKAGE.md).
