# Identity and Access

## Phase 3A–3D decision

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
3. **Business ownership** answers which implemented customer, property, area
   and cleaning-asset records that actor may access. Phase 3D extends the same
   boundary to requests and issued quotes; bookings and jobs remain future.

These concepts must not be collapsed. A provider account is not a CRM customer,
and a `CUSTOMER` role alone never proves ownership of a business record.

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
| Role assignment | ✓, subject to protected-flow gates | Dispatcher, Technician, Customer only | — | — | — |
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
lacks protected system-setting management and may assign or revoke only
`DISPATCHER`, `TECHNICIAN` and `CUSTOMER`. It cannot manage an `OWNER` or
another `ADMIN`, and cannot assign either privileged role.
`TECHNICIAN` has no broad CRM, commercial or security access. `CUSTOMER` has
only self and own-record permissions. Phase 3C additionally requires an active
application-owned identity/customer link before that own-record read permission
can resolve any CRM data.

## Phase 3C customer record authorization

`customer_identity_links` explicitly connects a `user_profiles.id` to a
`customers.id` with a controlled relationship and active/revoked lifecycle.
Provider subjects, provider roles and matching email addresses are not link
inputs. A CRM record may exist without any login, and one application profile
may be linked to multiple customers for future household, property-manager and
company-contact cases.

Staff reads require `CUSTOMER_RECORDS_READ`; staff mutations require
`CUSTOMER_RECORDS_MANAGE`. Creating or revoking an identity/customer link also
requires `USER_ADMIN_MANAGE`, limiting that authority to Owner/Admin under the
current canonical mapping. Dispatcher may manage CRM records but cannot grant
CRM identity access. Technician receives no unrestricted CRM access.

Customer self-service requires `OWN_CUSTOMER_DATA_READ` and an active link to
the exact owning customer. It is deliberately read-only in Phase 3C even though
the canonical future `OWN_CUSTOMER_DATA_UPDATE` permission already exists.
Self-service methods derive customer scope from the authenticated application
profile and never accept a caller-selected access mode. Staff and customer DTOs
are separate; customer responses exclude internal summaries, access/parking
notes, operational notes, actor metadata and link-administration details.

Every route and mutation treats customer, property, area and asset IDs as
untrusted. The server derives each nested object's owning customer through
database relationships and repeats current actor status, permission, parent and
link checks at the operation boundary. Missing and cross-customer identifiers
produce the same safe external result. Archive state is used for normal
deactivation; link revocation does not delete CRM data.

## Phase 3D request and quote authorization

The existing permission vocabulary is sufficient; Phase 3D adds no role or
permission. Staff request/quote reads require the conjunction of
`CUSTOMER_RECORDS_READ` and `OPERATIONS_READ`. Staff creation, normalization,
CRM linking, lifecycle, estimate and quote mutations require both
`CUSTOMER_RECORDS_MANAGE` and `OPERATIONS_MANAGE`. Policy evaluates permissions,
not role labels; current mappings admit Owner, Admin and Dispatcher while
excluding unrestricted Technician access.

Customer-portal request submission requires `OWN_CUSTOMER_DATA_UPDATE` and an
exact active identity/customer link. Own-request and issued-quote reads require
`OWN_CUSTOMER_DATA_READ` and the same current link. The repository also checks
that any property and cleaning asset belong to that exact active customer
graph. `requesting_profile_id` is submission provenance, not enduring access
authority. Submitted email or phone never creates a customer, profile, role or
link and is never used to authorize a read.

Anonymous public intake creates an unresolved request only. Staff and customer
routes use different projections; customers cannot read draft quotes, internal
estimates, staff notes, actor identifiers or unrelated IDs. Once issued, a
customer-authorized historical quote may remain visible after supersession,
expiry or withdrawal, but there is no quote acceptance control in Phase 3D.
Every identifier is treated as untrusted and missing/forbidden results remain
indistinguishable. See `docs/REQUEST_AND_QUOTE.md`.

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
transition. Phase 3B status and role management is privileged, re-authorized
server-side and audited atomically. Self-status changes are blocked, and the
last active owner cannot be suspended or disabled. `DISABLED` is additionally
fail-closed until reliable recent authentication is available; `SUSPENDED` and
reactivation remain usable under the documented target-management policy.

## Phase 3B privileged administration

The protected `/app/admin/users` and `/app/admin/users/[id]` routes list and
inspect application profiles by application UUID. The list supports safe name
or profile-identifier search, canonical role and status filters, bounded
pagination, localized role/status labels, creation time and last safe audit
activity. Detail shows application profile state, current and historical role
assignments, a sanitized audit view and explicit provider/session capability
state. Email search/display is deliberately unavailable until a narrowly
scoped Provider Admin connection is proven; no provider subject, token, cookie,
session credential, reset value or raw provider response reaches the UI.

Every page read requires `USER_ADMIN_READ` on the server. Every mutation is a
Next.js Server Action that revalidates the current provider session, active
application profile, role and permissions; validates canonical input; applies
the administrative attempt limiter; and rechecks actor, target, active role,
owner count and permissions in the database statement. Navigation visibility
is convenience only. URLs and form inputs never carry provider subjects.

Role assignment and revocation follows this initial policy:

- `OWNER` may manage another profile, subject to protected-flow and last-owner
  gates;
- `ADMIN` may manage only non-privileged targets and only the `DISPATCHER`,
  `TECHNICIAN` and `CUSTOMER` roles;
- `ADMIN` cannot manage, grant or revoke `ADMIN` or `OWNER`;
- self role and self status changes are blocked; and
- `DISPATCHER`, `TECHNICIAN`, `CUSTOMER`, suspended/disabled identities and
  unauthenticated requests cannot administer identities.

Assignment rows are reactivated or revoked rather than deleted. Repeated
assignment/revocation and same-status requests are safe no-ops. Successful
changes append `ROLE_ASSIGNED`, `ROLE_REMOVED` or `ACCOUNT_STATUS_CHANGED` in
the same PostgreSQL statement as the state change. Metadata is allowlisted to
role, prior/new status and the privileged-administration source. A shared
transaction explicitly selects `READ COMMITTED`, then acquires the advisory
lock before any state is read. The authoritative actor, target and active-owner
checks run in the following statement with a fresh snapshot; that statement
keeps the state change and sanitized audit insert atomic. This ordering prevents
queued changes from using authority or an owner count captured before the lock
was acquired.

Native modal confirmations separate intent from submission for all role and
status changes, support Escape/cancel, restore focus to the invoking control,
and disable pending controls. Every distinct mutation error response focuses
the accessible alert, including consecutive errors, without focusing again on
an unrelated render.

### Provider operations and reconciliation

The provider-neutral privileged-auth contract reports each capability
explicitly. The pinned Neon adapter supports a safely projected, paginated
provider user list through the documented Admin API, but the call additionally
requires a Better Auth provider-admin role. VAX `OWNER` and `ADMIN` are not and
must never be translated into that provider role. Direct provider user detail
is absent from the pinned endpoint map. The session-list contract conflicts
with the bundled provider route and remains unvalidated. No direct
`neon_auth` query or fallback exists.

The pure reconciliation policy can distinguish aligned records,
provider-only identities, profile-only identities, no-active-role profiles,
blocked profiles with active sessions, no record and unknown provider state.
The current UI reports `PROVIDER_STATE_UNKNOWN` because it cannot correlate a
safe provider projection to an application profile without exposing or
duplicating the provider subject. It never treats an unavailable provider as a
missing identity and never repairs a discrepancy automatically.

The provider documents revoke-all-sessions, but VAX cannot yet perform it
safely: provider-admin authority is broad, reliable recent-authentication is
unavailable, and the 300-second signed session cache needs a proved
authoritative invalidation path. Session listing and revoke-all therefore
remain fail-closed capabilities with visible admin-state messaging. Application
`SUSPENDED`/`DISABLED` checks still re-read VAX status on every protected
boundary and block immediately even while provider sessions exist.

### Recent authentication and invitations

The managed provider does not expose a reliable recent-authentication or
step-up signal through the pinned server adapter, and provider Admin routes do
not require a fresh session. VAX does not invent password replay or trust a
client timestamp. The administration actor contract carries authoritative
authentication time when a future provider can supply it; absence is denied.
Consequently `OWNER`/`ADMIN` grant or revocation, `DISABLED`, and provider
session revocation are production gates. Ordinary non-privileged role changes,
`SUSPENDED` and reactivation remain available within policy.

Staff invitation remains architecture-only. A later design must record an
intended canonical role, send through production-ready email, require verified
provider acceptance, and activate the role only through an explicit audited
operation. Provider account creation is not treated as an invitation, and no
fake delivery, invite record or implicit staff provisioning is implemented.

### Initial owner production runbook

No default owner, hard-coded email or first-signup elevation exists. A future
authorized production setup must separately: (1) run a production-specific,
reviewed variant of the VAX owner bootstrap against the intended active
application profile, and (2) only if provider administration is actually
needed, assign the matching Better Auth provider-admin authority out-of-band in
the Neon Console. The current bootstrap command remains development-only and
must not be reused against production. Both operations require an approved
operator runbook, audit evidence, rollback/recovery planning and separate
production authorization.

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
Permission-aware navigation exposes staff Customers and Requests plus
linked-customer My Properties, My Requests and My Quotes destinations.
`/app/customers` and `/app/requests` repeat their respective permission checks
on the server; own-record routes always derive linked-only scope. Draft quotes
and estimate internals have no customer route. Authorized identities
additionally see Administration → Users. The root document language and
skip-link copy are derived from the validated application-profile locale.

`/internal/pricing-lab` and `/internal/availability-lab` remain separate local
development tools. Their existing production `notFound()` gate is unchanged;
authentication does not convert them into deployable internal pages.

## Rate limiting

Login, signup, reset, verification, anonymous request intake and privileged
mutation Server Actions use bounded in-memory limiting for loopback/local
development. Auth keys are one-way hashes of the submitted account/actor key
and available forwarded address; public intake uses an address-scoped constant
instead of contact details. Keys are not logged. Process-local memory is not
reliable across production instances, so production remains blocked until a
shared/provider-backed limiter is selected and tested.

## Audit events

`auth_audit_events` supports signup, login success/failure, logout, reset
request/completion, verification request/completion, role assignment/removal,
account status changes and owner bootstrap. Events store outcome, optional
application actor/subject, a correlation identifier, timestamp and allowlisted
safe metadata. They do not store email, password, OTP, reset token, session
token or raw provider error. Provider-owned security history is not copied.

Phase 3A creates the event model. Phase 3B appends successful role and status
mutations atomically with their state change. Repeated no-op requests do not
fabricate change events. Database-level append-only grants and immutability are
still a production least-privilege gate; ordinary operators receive no audit
editing UI.

Phase 3D does not add request/quote vocabulary to this security stream.
`business_audit_events` separately records allowlisted request, estimate and
quote lifecycle changes and never stores provider subjects, contact details,
addresses, notes, tokens or secrets. That separation prevents business history
from weakening or overloading authentication audit policy.

## Environment and branch safety

Auth services and provider sessions are branch-specific. Development identities
belong only on Neon `development`; production accounts and sessions are outside
this phase. Migration `0004_add_identity_access.sql` is additive, creates only
application-owned public tables and never names `neon_auth`. Phase 3D adds only
application-owned public-schema request/quote tables on development and does
not query or mutate Auth-managed tables. Production remains unmigrated.
Migration and owner-bootstrap commands additionally require an explicit
development label and exact approved database hostname before opening the
database client.

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

VAX represents one cleaning business and does not add `tenant_id` to every
identity or transaction table. Provider identity, application profile and CRM
customer are separate, so a future organization membership or
business-ownership layer need not turn provider subjects into business records.
Organization scope must be designed before VAX becomes multi-organization.

## Production blockers and later work

Deployment remains blocked until at least:

- the scheduled patched Next.js 16.3 security release is available locally,
  adopted and validated; local installed, locked and cached package metadata
  checked on 23 August 2026 contains only 16.3.0 through 16.3.2, so dependency
  changes remain a later security-upgrade gate;
- Neon Auth Beta suitability, provider-admin breadth and its transitive
  dependency tree are re-reviewed;
- owner-approved production trusted origins and custom SMTP are configured,
  with mandatory verification exercised against real delivery;
- a distributed or provider-backed shared rate limiter for authentication,
  anonymous request intake and privileged mutations is selected and tested;
- sanitized authentication monitoring, alerting, session-revocation response,
  backup and recovery procedures are defined and rehearsed;
- reset links and verification OTPs receive live end-to-end validation without
  retaining tokens or provider details, and every synthetic development
  identity created for that validation is cleaned up afterward;
- the browser Data API remains unused until each reachable table has reviewed
  least-privilege database grants and row-level security policies, including
  append-only audit enforcement;
- reliable provider-attested recent authentication, authoritative session
  invalidation, and the provider session-list/revoke contracts are proven on a
  disposable development identity before enabling high-risk operations;
- the explicit initial-owner production runbook and any separate provider-admin
  elevation are approved and rehearsed; and
- production migration and deployment receive later, separate authorization
  and verification.

Phase 3C implements the initial Customer and Property CRM with application
identity separate from explicit CRM ownership and server-side per-record
authorization. Phase 3D applies that boundary to persistent requests and issued
quotes, with a separate scoped business-event stream. Direct browser database
access remains prohibited. Organization scope, reviewed production
least-privilege/RLS and append-only grants, final privacy/retention policy,
data-subject workflows and broader business-audit coverage remain production or
future-phase gates; see `docs/CRM_AND_PRIVACY.md` and
`docs/REQUEST_AND_QUOTE.md`.
