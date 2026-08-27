# Production Readiness

## Current checkpoint

Phase 3K closes the repository and development-database least-privilege
architecture: distinct migrator/runtime roles, non-owner runtime, exact DML,
role/command-scoped RLS, Data API denial, safe defaults and live development
verification. It does not authorize deployment or make production ready by
itself.

| Gate | Status after Phase 3K |
| --- | --- |
| Patched supported Next.js 16.3 line | Implemented and validated in Phase 3J |
| Server/runtime database least privilege | Implemented and verified on development only |
| Migration/runtime credential separation | Implemented and verified on development only |
| Browser/Data API access to VAX tables | Denied; no browser integration |
| Customer/technician row-aware RLS | Deferred; server repository authorization remains authoritative |
| Staging database and staging Auth | Not created or configured |
| Production database migration | Not authorized; production remains unmigrated |
| Production trusted origins/custom SMTP | Not configured |
| Shared rate limiting | Not configured |
| Monitoring, alerting, backup/restore and recovery rehearsal | Not completed |
| Neon Auth beta/provider-admin review and live reset/OTP tests | Still required |
| RLS/grant review on the exact production topology | Still required before migration |
| Deployment | Not authorized |

See [DATABASE_SECURITY.md](DATABASE_SECURITY.md) for the database threat model,
role contract, DML matrix, staging checklist and recovery boundary. The
remaining Auth and operational gates are maintained in
[IDENTITY_AND_ACCESS.md](IDENTITY_AND_ACCESS.md) and
[SECURITY.md](SECURITY.md).
