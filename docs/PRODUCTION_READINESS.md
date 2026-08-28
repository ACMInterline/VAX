# Production Readiness

## Current checkpoint

Phase 3L closes the repository-owned staging database, shared-rate-limit,
readiness/logging and basic recovery-branch foundations. It creates an isolated
Neon `staging` branch, rehearses fail-closed runtime/migrator credential
replacement, applies and
verifies migrations through 0015, and proves local application access to
staging services. It does not deploy an application or authorize production.

| Gate | Status after Phase 3L |
| --- | --- |
| Patched supported Next.js 16.3 line | Implemented and validated in Phase 3J |
| Server/runtime database least privilege | Verified on development and staging |
| Migration/runtime credential separation | Verified; fresh old credentials reject, but live pooler-session revocation remains blocked |
| Browser/Data API access to VAX tables | Denied; no browser database integration |
| Shared sensitive-action rate limiting | PostgreSQL-backed, fail-closed and multi-instance verified |
| Staging database | Created, migrated through 0015, clean and rebuild-rehearsed |
| Staging Auth | Branch-isolated; verification required; zero users/sessions |
| Hosted HTTPS staging application/origin | Not configured; local loopback rehearsal only |
| External staging email | Blocked; no approved sink/sandbox or live reset/OTP test |
| Five-role browser/IDOR/session rehearsal | Blocked by hosted origin and mail/identity gates |
| Health/readiness and safe structured logging | Implemented; no hosted receiver/alert destination |
| Recovery | Current-state branch and migration-failure rehearsal passed |
| Portable logical export | Not executed; compatible `pg_dump` is unavailable locally |
| Customer/technician actor-aware RLS | Deferred; server repository authorization remains authoritative |
| Neon Auth provider review | Managed Better Auth remains Beta; session/recent-auth gates remain |
| Provider production-branch protection | Not enabled at this checkpoint; review before production authority |
| Production database migration | Not authorized; production remains unmigrated |
| Deployment | Not authorized |

The actual local staging readiness result is `NOT_READY`: database, Auth,
migration state and shared rate limiting are ready, while staging email is not.
No complete staging rehearsal may be claimed until a hosted exact HTTPS origin,
approved test-only email transport and synthetic authenticated role/IDOR/session
run exist.

See [STAGING_READINESS.md](STAGING_READINESS.md) for the exact evidence and
blockers, [DEPLOYMENT_RUNBOOK.md](DEPLOYMENT_RUNBOOK.md) for the guarded release
sequence, [BACKUP_AND_RECOVERY.md](BACKUP_AND_RECOVERY.md) for recovery limits,
and [INCIDENT_RESPONSE.md](INCIDENT_RESPONSE.md) for safe outage handling.
