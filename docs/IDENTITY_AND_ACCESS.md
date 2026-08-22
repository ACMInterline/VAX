# Identity and Access

## Phase 3A decision

VAX uses Neon Auth's managed Better Auth service through the supported
`@neondatabase/auth` Next.js server adapter. The selected package is
`0.5.0-beta`, the current Neon integration available during Phase 3A. Password
hashes, provider accounts, reset/verification tokens and provider sessions stay
in Neon-managed `neon_auth`. Application code and Drizzle never query or mutate
that schema directly.

The integration is deliberately split into three concepts:

1. **Provider identity** answers who authenticated. It owns credentials,
   verification and session lifecycle.
2. **Application profile and authorization** answer whether that identity may
   use VAX and which application actions it may perform.
3. **Future business ownership** will answer which customer, property, request,
   quote, booking or job records that actor may access.

These concepts must not be collapsed. A provider account is not a CRM customer,
and a `CUSTOMER` role alone will never prove ownership of a future business
record.

## Provider boundary

`src/auth/contracts.ts` defines provider-neutral `AuthenticatedUser`, `Session`,
`UserId` and `AuthenticationProvider` contracts. `src/auth/neon-provider.ts` is
the only application adapter that constructs the Neon server client or calls
Neon-specific methods. Domain permission policy imports neither Next.js nor the
provider SDK.

The Next.js integration consists of:

- server-only adapter calls to the managed Auth API, with no browser-facing
  provider catch-all or token endpoint;
- `src/proxy.ts`, an optimistic session gate for `/app` only;
- server-side session validation and application-profile lookup at the page or
  operation boundary; and
- Server Actions that validate input, rate-limit attempts and use fixed
  redirects.

The proxy improves early routing but is never the authorization authority.
Every future protected Server Action, route handler and data operation must call
the centralized server authorization service again.

## Runtime configuration

The server-side variables are:

| Variable | Purpose | Secret |
| --- | --- | --- |
| `DATABASE_URL` | Drizzle connection to the selected application database | Yes |
| `DATABASE_MUTATION_ENVIRONMENT` | Explicit `development` acknowledgement for migration/bootstrap commands | No |
| `DATABASE_MUTATION_EXPECTED_HOST` | Exact approved development database hostname interlock | Treat as server configuration |
| `NEON_AUTH_BASE_URL` | Branch-specific managed Auth service endpoint | Treat as server configuration |
| `NEON_AUTH_COOKIE_SECRET` | At least 32 characters; signs the local session-data cache cookie | Yes |
| `AUTH_REQUIRE_VERIFIED_EMAIL` | Optional development override; production always requires verification and ignores `false` | No |
| `AUTH_BOOTSTRAP_PROVIDER_USER_ID` | Temporary explicit provider subject for the owner command | Sensitive operator input; do not persist |
| `PUBLIC_SITE_URL` | Approved origin used for password-reset callbacks | No |

All remain empty in `.env.example`. Local values belong only in ignored
`.env.local`; deployment platforms must inject environment-specific values.
Importing application pages does not construct the provider, so credential-free
CI builds remain supported.

`AUTH_REQUIRE_VERIFIED_EMAIL=true` enables the verification gate during local
development. A development-only `false` value leaves that gate disabled for
provider-flow testing. In production the application always resolves this
policy to required; `AUTH_REQUIRE_VERIFIED_EMAIL=false` cannot weaken it.

## Session security

The server adapter owns cookie exchange. VAX configures:

- provider session cookies rather than browser `localStorage` tokens;
- signed `HttpOnly` session-data caching;
- a 300-second session-data cache TTL;
- `SameSite=Strict` for the current email/password-only flow;
- provider-controlled `Secure` behavior for HTTPS production;
- silent provider logging to prevent raw provider response leakage; and
- authoritative application status and permission lookup for every protected
  page or operation.

The managed provider owns session expiry, rotation and revocation. Logout calls
the provider's sign-out endpoint before redirecting. Next.js Server Actions add
their framework origin checks; fixed application redirects avoid open-redirect
input. A later social/OAuth decision must revisit `SameSite=Strict` because
cross-site callbacks may require `Lax`.

## Application-owned records

Phase 3A adds only these public-schema tables:

| Table | Ownership and purpose |
| --- | --- |
| `user_profiles` | Provider-subject mapping, display name, locale, nullable phone and application status; no credentials |
| `application_roles` | Stable machine role codes plus localized labels |
| `permissions` | Stable action capability codes |
| `role_permissions` | Code-owned canonical role-to-permission relationships |
| `user_roles` | Application profile role assignment, source, actor and revocation state |
| `auth_audit_events` | Append-oriented, sanitized application security events |

The provider subject is unique but is not the application's primary key.
Passwords, session tokens, reset tokens and provider secrets are never copied
into these tables.

## Roles and permission matrix

Canonical roles are `OWNER`, `ADMIN`, `DISPATCHER`, `TECHNICIAN` and
`CUSTOMER`. Codes are stable and untranslated; labels may evolve independently.
Canonical seeds are deterministic and restore the code-owned role-permission
mapping on migration runs.

| Permission | Owner | Admin | Dispatcher | Technician | Customer |
| --- | :---: | :---: | :---: | :---: | :---: |
| Identity self read/update | ✓ | ✓ | ✓ | ✓ | ✓ |
| User administration read/manage | ✓ | ✓ | — | — | — |
| Role assignment | ✓ | ✓, except Owner | — | — | — |
| System settings read | ✓ | ✓ | — | — | — |
| System settings manage | ✓ | — | — | — | — |
| Catalogue read | ✓ | ✓ | ✓ | — | — |
| Catalogue manage | ✓ | ✓ | — | — | — |
| Commercial rules read | ✓ | ✓ | ✓ | — | — |
| Commercial rules manage | ✓ | ✓ | — | — | — |
| Operations read | ✓ | ✓ | ✓ | ✓ | — |
| Operations manage | ✓ | ✓ | ✓ | — | — |
| Schedule read | ✓ | ✓ | ✓ | ✓ | — |
| Schedule manage | ✓ | ✓ | ✓ | — | — |
| Customer records read/manage | ✓ | ✓ | ✓ | — | — |
| Field jobs read | ✓ | ✓ | ✓ | ✓ | — |
| Field jobs update | ✓ | ✓ | — | ✓ | — |
| Own customer data read/update | ✓ | — | — | — | ✓ |
| Audit read | ✓ | ✓ | — | — | — |

`OWNER` receives the entire canonical permission set. `ADMIN` deliberately
lacks protected system-setting management and cannot assign `OWNER`.
`TECHNICIAN` has no broad CRM, commercial or security access. `CUSTOMER` has
only self and future own-record permissions. Resource ownership checks do not
yet exist because Phase 3A creates no business records.

## Central authorization

`src/auth/authorization-service.ts` loads a provider session, the mapped
application profile, active roles and active permissions. It exposes
`getAuthenticatedUser`, `requireAuthenticatedUser`, `requireUserPermission`,
`requireUserAnyPermission` and `principalHasPermission`. Pure policy functions
provide `hasPermission`, `requirePermission` and `requireAnyPermission`.

Authorization denies by default when:

- there is no provider session;
- no application profile maps to the provider subject;
- the profile is `SUSPENDED` or `DISABLED`;
- verification is required but the provider identity is not verified;
- no active role grants the permission; or
- the requested permission is unknown.

Navigation visibility uses the same permission vocabulary for convenience, but
does not authorize a server operation.

## Customer signup

Public self-registration collects only display name, email, password,
confirmation, locale and an acknowledgement hook. The server ignores unknown
fields and never accepts a role choice. Success and duplicate/provider-rejected
attempts return the same generic acknowledgement and leave no signed-in browser
session. Signup never creates an application profile. The first successful
policy-compliant login creates the profile and exactly one `CUSTOMER` role;
that healing path cannot assign a staff role. When email verification is
required, it must pass before application provisioning.

Passwords are managed only by the provider. VAX requires 12–128 characters,
permits paste and password managers, and adds no arbitrary composition rule.

## Owner bootstrap

The first owner is never selected by email, first signup or a default password.
After an intended provider account has an active application profile, an
operator may temporarily set `AUTH_BOOTSTRAP_PROVIDER_USER_ID`, confirm the
development-only mutation variables described above, and run:

    npm run auth:bootstrap-owner

The command refuses production mode and any database hostname other than the
explicit approved development host. Its transaction uses a database advisory
lock and assigns `OWNER` only when no owner assignment has ever existed. It is
idempotent while the same owner remains active and cannot reactivate bootstrap
after that assignment is revoked. It emits a sanitized audit event and records
the bootstrapped profile as the subject, not as the unauthenticated operator
actor. It never prints the provider identifier. Remove the temporary variable
after use.
No owner bootstrap is required merely to validate Phase 3A.

## Account status

Application profiles are `ACTIVE`, `SUSPENDED` or `DISABLED`. Both suspended
and disabled accounts fail closed even when the provider session remains valid
and roles still exist. Records are retained; deletion is not used as a status
transition. Future status and role management must be privileged, re-authorized
server-side and audited.

## Public authentication flows

Bulgarian primary routes and English counterparts are implemented for login,
customer signup, forgotten password, password reset and email verification.
All authentication and `/app` pages are `noindex`, excluded from the sitemap,
marked private/no-store at the route boundary and covered by baseline framing,
MIME, referrer and browser-permission headers.

Password reset uses the provider's time-limited token and an approved fixed
callback origin. Request responses are identical whether or not an account
exists. Reset and verification tokens are never logged or persisted by VAX.
The login error and generic signup completion state link visibly to the
localized verification page whenever runtime policy requires verification.
Reset-password pages hide the locale switch while a recovery token is active,
so changing languages cannot drop, duplicate or prefetch that credential.

Neon supports email verification and password reset. At the Phase 3A
development inspection, email/password and shared development email were
enabled, verification was not required, and verification used OTP. The shared
email service is limited and is not production delivery. Production requires
owner-approved trusted origins, required verification, custom SMTP and verified
end-to-end delivery; no paid email provider is selected here.

## Protected application namespace

`/app` is the authenticated operational/customer namespace. Its initial page
shows only display name, localized role labels, account status, verification
state, locale and logout. It does not expose provider tokens or identifiers.
Permission-aware placeholders distinguish future customer, staff and shared
areas without creating those modules. The root document language and skip-link
copy are derived from the validated application-profile locale.

`/internal/pricing-lab` and `/internal/availability-lab` remain separate local
development tools. Their existing production `notFound()` gate is unchanged;
authentication does not convert them into deployable internal pages.

## Rate limiting

Login, signup, reset and verification Server Actions use an in-memory bounded limiter
for loopback/local development. Keys are one-way hashes of the submitted account
key and available forwarded address and are not logged. Process-local memory is
not reliable across production instances, so the production adapter denies all
auth attempts until a shared/provider-backed limiter is selected and tested.
This is an intentional deployment blocker, not a production implementation.

## Audit events

`auth_audit_events` supports signup, login success/failure, logout, reset
request/completion, verification request/completion, role assignment/removal,
account status changes and owner bootstrap. Events store outcome, optional
application actor/subject, a correlation identifier, timestamp and allowlisted
safe metadata. They do not store email, password, OTP, reset token, session
token or raw provider error. Provider-owned security history is not copied.

Phase 3A creates the event model and records the implemented application flows.
Future privileged management must add events to the same boundary or a reviewed
general audit service; ordinary operators must not edit audit history.

## Environment and branch safety

Auth services and provider sessions are branch-specific. Development identities
belong only on Neon `development`; production accounts and sessions are outside
this phase. Migration `0004_add_identity_access.sql` is additive, creates only
application-owned public tables and never names `neon_auth`. Production remains
unmigrated. Migration and owner-bootstrap commands additionally require an
explicit development label and exact approved database hostname before opening
the database client.

The inspected development branch currently has the Neon Data API enabled while
the new application tables do not have reviewed row-level security policies.
VAX therefore exposes no provider token route and does not use the Data API from
the browser. Any future browser Data API design must first define least-privilege
grants and reviewed RLS for every reachable application table; until then it is
a deployment blocker, not an application connection path.

CI does not receive database or Auth secrets and therefore validates build,
types and pure policy contracts without contacting Neon. Live flow testing must
load ignored development-only configuration and must never print it.

## Future organization readiness

VAX initially represents one cleaning business and does not add `tenant_id` to
every identity table. Provider identity, application profile and future CRM
customer are separate, so an organization membership or business-ownership
layer can be introduced later without changing provider subjects into business
records. Organization scope must be designed before persistent CRM data.

## Production blockers and later work

Deployment remains blocked until at least:

- the scheduled patched Next.js 16.3 security release is available locally,
  adopted and validated; local installed, locked and cached package metadata
  checked on 23 August 2026 contains only 16.3.0 through 16.3.2, so dependency
  changes remain a later security-upgrade gate;
- Neon Auth Beta suitability and its transitive dependency tree are re-reviewed;
- owner-approved production trusted origins and custom SMTP are configured,
  with mandatory verification exercised against real delivery;
- a distributed or provider-backed shared rate limiter is selected and tested;
- sanitized authentication monitoring, alerting, session-revocation response,
  backup and recovery procedures are defined and rehearsed;
- reset links and verification OTPs receive live end-to-end validation without
  retaining tokens or provider details, and every synthetic development
  identity created for that validation is cleaned up afterward;
- the browser Data API remains unused until each reachable table has reviewed
  least-privilege database grants and row-level security policies;
- the explicit initial owner and future privileged role-management workflow is
  separately approved and tested; and
- production migration and deployment receive later, separate authorization
  and verification.

Phase 3B should add privileged user/status/role administration and invitations,
with owner protection, re-authentication, audit review and provider lifecycle
reconciliation. It should still precede customer CRM persistence.
