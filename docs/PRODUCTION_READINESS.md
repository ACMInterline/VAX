# Production Readiness

## Current checkpoint

Phase 3M adds a real HTTPS deployment in a dedicated nonproduction Vercel
project, exact staging Auth origin and test-only SMTP sink, synthetic browser
flows, alert plumbing and portable logical recovery on top of Phase 3L. It does
not deploy or migrate production and does not authorize production.

| Gate | Status after Phase 3M |
| --- | --- |
| Patched supported Next.js 16.3 line | Implemented and validated in Phase 3J |
| Server/runtime database least privilege | Verified on development and staging |
| Migration/runtime credential separation | Verified; fresh old credentials reject, but live pooler-session revocation remains blocked |
| Browser/Data API access to VAX tables | Denied; no browser database integration |
| Shared sensitive-action rate limiting | PostgreSQL-backed, fail-closed and multi-instance verified |
| Staging database | Created, migrated through 0015, clean and rebuild-rehearsed |
| Staging Auth | Branch-isolated; six synthetic identities; verification/reset/login/logout and suspension exercised |
| Hosted HTTPS staging application/origin | Dedicated Vercel project and exact HTTPS staging origin operational |
| External staging email | Generated test-only sink with exact recipient allowlist; no real delivery |
| Role browser/IDOR/session rehearsal | OWNER/DISPATCHER/TECHNICIAN/CUSTOMER fixtures; ADMIN/revoke-all/recent-auth remain fail-closed provider gates |
| Health/readiness and safe structured logging | Hosted endpoints operational; GitHub staging issue receiver defined |
| Recovery | Branch recovery, migration-failure and portable logical restore rehearsed |
| Portable logical export | PostgreSQL 18 public+ledger export/restore and secret scan passed |
| Customer/technician actor-aware RLS | Deferred; server repository authorization remains authoritative |
| Neon Auth provider review | Managed Better Auth remains Beta; session/recent-auth gates remain |
| Provider production-branch protection | Not enabled at this checkpoint; review before production authority |
| Production database migration | Not authorized; production remains unmigrated |
| Deployment | Staging-only Vercel deployment authorized; production forbidden |

Hosted infrastructure, database, Auth, migration, limiter, email and recovery
paths are operational. Complete product acceptance remains `NOT_READY` because
the issued-quote Booking cannot be scheduled without publication-approved
duration/availability provenance; downstream Job, Passport, finance and final
communications must remain blocked. Provider Beta/session/recent-auth,
small-viewport/cookie inspection, pooled-credential invalidation and all
production business/legal/operational approvals remain separate gates.

See [STAGING_READINESS.md](STAGING_READINESS.md) for the exact evidence and
blockers, [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) for the guarded release
sequence, [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) for recovery limits,
and [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for safe outage handling.
