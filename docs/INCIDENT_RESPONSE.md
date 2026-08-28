# Incident Response

## Scope

This runbook covers the VAX application, Neon Postgres/Auth, shared rate
limiting, communications and finance invariants. It defines a staging-ready
process, not a staffed production on-call service.

## Safe detection signals

Alert on:

- liveness or application availability failure;
- readiness not-ready/degraded;
- database or Auth dependency failure;
- migration mismatch;
- elevated 5xx/error rate;
- shared limiter failure or unusual denial volume;
- finance invariant violation; and
- communication failure/backlog growth.

Logs and alerts may include only a correlation ID, controlled event/route,
status, duration, sanitized error class and a justified application profile ID.
Never attach request bodies, contact values, addresses, passwords, OTP/reset
tokens, session cookies, provider responses, connection details, payment/bank
data or documents.

## Response sequence

1. **Detect and classify.** Confirm liveness/readiness category and whether the
   event affects confidentiality, integrity or availability.
2. **Contain.** Stop the affected mutation or service; sensitive operations
   fail closed when Auth/rate limiting/database authority is uncertain.
3. **Preserve evidence.** Record safe timestamps, commit/migration identity and
   correlation IDs. Do not copy secrets or personal data into tickets/chat.
4. **Recover.** Rotate only the affected nonproduction credential, restore via
   an inspected recovery branch, roll back the application to a schema-
   compatible commit, or keep the dependency disabled.
5. **Validate.** Recheck identity, migration hashes, grants/RLS, RBAC/reference
   counts, business invariants, Auth/session state, readiness and user flow.
6. **Communicate and review.** Use owner-approved contacts/templates; document
   impact, timeline, root cause and preventive action.

Suspected secret exposure requires immediate credential revocation/rotation and
repository/log/artifact review. Deleting a leaked file is not remediation.

## Phase 3L tabletop: Auth unavailable

Scenario: the Auth provider is unreachable while PostgreSQL remains available.

- Detection: the safe Auth readiness category becomes `NOT_READY`; liveness
  remains healthy.
- User impact: new login/signup/reset/verification and session refresh cannot
  be trusted; user-facing actions return generic failure without provider
  detail or account enumeration.
- Containment: keep readiness at 503, do not bypass authentication, do not
  fabricate a session and pause high-risk authenticated operations.
- Data behavior: unrelated committed business transactions are not rolled
  back merely because notification/Auth is unavailable; new identity-dependent
  changes fail closed.
- Recovery: verify provider status/configuration and exact branch origin,
  restore availability, then test a synthetic session before reopening.
- Validation: readiness/Auth returns ready, no session/profile drift exists,
  audit/log data contains no token/contact leakage, and any synthetic identity
  is removed.

Unit outage simulations also prove DB, Auth, email and limiter failures do not
turn a sensitive endpoint into an unlimited or authenticated path. The current
provider-neutral reporter has no external destination, so automated alert
delivery and on-call acknowledgement remain staging blockers.

## Severity guide

- **Critical:** credential exposure, cross-customer access, unauthorized
  payment/finance mutation, production data loss or Auth bypass.
- **High:** widespread Auth/DB outage, persistent migration mismatch, limiter
  fail-open suspicion or incorrect financial state.
- **Medium:** bounded staging outage, failed external communication with intact
  business state, or degraded noncritical monitoring.
- **Low:** isolated cosmetic/non-sensitive issue with no integrity or access
  impact.

Production contacts, response times, breach-notification/legal criteria and
support escalation paths require owner/legal/provider approval before launch.
