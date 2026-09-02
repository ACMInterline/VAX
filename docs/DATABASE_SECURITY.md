# Database Security and Least Privilege

## Scope and status

Phase 3K separates VAX database authority without changing product behavior:

> Neon administrator ≠ VAX migrator ≠ VAX server runtime ≠ browser/Data API

The repository implementation and migration are production-capable controls,
but Phase 3K applies them only to Neon `development`. It does not migrate or
configure production, create a staging branch, enable browser database access,
or change the provider-managed `neon_auth` and `auth` schemas.

## Roles and credentials

| Identity                                 | Purpose                                                                                                | Explicitly absent authority                                                                     |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Neon administrator                       | One-time role provisioning, recovery and controlled ownership administration                           | Application runtime use                                                                         |
| `vax_migrator`                           | Own VAX public objects and the Drizzle ledger objects, run reviewed migrations and deterministic seeds | Role/database creation, replication, RLS bypass, provider Auth ownership                        |
| `vax_runtime`                            | Server-side application queries with the exact DML matrix below                                        | Object ownership, DDL, role/database creation, replication, RLS bypass, migration-ledger access |
| `authenticated` / `anonymous` / `PUBLIC` | No VAX application access                                                                              | All VAX table, sequence and trigger-function privileges                                         |

The ignored local environment uses three independent URLs:

- `DATABASE_URL` must authenticate as `vax_runtime`;
- `MIGRATION_DATABASE_URL` must authenticate as `vax_migrator`; and
- `DATABASE_ADMIN_URL` is accepted only by the explicit role-provisioning
  command, with its expected role named separately.

There is no migration fallback from `MIGRATION_DATABASE_URL` to
`DATABASE_URL`. URL validation rejects a role mismatch before a connection is
constructed. Development mutation commands also require exact hostname,
database, Neon project and Neon branch expectations; after connection they
verify the live project, branch, database and role again.

The first development provisioning run may explicitly adopt the previous
owner-class `DATABASE_URL`:

    npm run db:provision-roles -- --adopt-current-database-url \
      --environment development \
      --project-id <approved-development-project-id> \
      --branch-id <approved-development-branch-id> \
      --host <approved-development-hostname> \
      --database neondb

The command generates independent role credentials, writes them only to the
ignored mode-0600 `.env.local`, and never prints them. Rerunning the command
does not rotate or reset an existing role password. A partial role set or
missing local credentials fails closed for operator review.

## Development object inventory

The pre-change development catalog contains 97 VAX public tables, no public
views or materialized views, 40 public sequences, 331 public indexes, 1,914
public constraints and 37 non-internal public triggers. Nineteen public
functions are VAX trigger functions. Of the remaining 213 public functions,
212 are extension-managed capabilities and one is a pre-existing,
administratively owned, invoker-security catalog helper. Phase 3K does not
transfer or broadly revoke those non-VAX functions. The live verification
classifies every non-system function, fails on an unexpected unmanaged public
function or any provider `SECURITY DEFINER` drift, and confirms that the known
catalog helper cannot elevate above its caller. The Drizzle ledger table and
sequence live in the separate `drizzle` schema.

Provider-managed `auth`, `neon_auth`, Neon catalog schemas, roles and objects
are outside the VAX ownership inventory. Their ownership and structure are not
changed. The live verification queries catalogs for schemas, relations,
indexes, constraints, functions, triggers, owners, grants, defaults, RLS and
policies and fails if the expected inventory diverges. Phase 3L adds only the
`operational_rate_limits` table, bringing the current contract to 98 public
tables while preserving the 97-table Phase 3K baseline. Phase 3N then adds only
`business_authority_records` and `business_authority_audit_events`, bringing
the current nonproduction contract to 100 public tables and 17 ordered
migrations. The historical 97-table/98-table and 16-entry checkpoints remain
unchanged evidence rather than being restated as Phase 3N results.

## Ownership and defaults

- The VAX public tables, their sequences, VAX trigger functions, and the
  Drizzle ledger table and sequence are owned by `vax_migrator`.
- The `public` schema remains administratively owned. `vax_migrator` receives
  `USAGE, CREATE`; `vax_runtime` receives `USAGE` only.
- The `drizzle` schema also remains administratively owned while granting
  `USAGE, CREATE` only to `vax_migrator`; the runtime has no schema access.
- `vax_migrator` receives `CREATE` on the current database because Drizzle
  performs `CREATE SCHEMA IF NOT EXISTS drizzle` before reading its ledger.
  The role remains `NOCREATEDB`: it can create migration schemas inside this
  database but cannot create databases or administer roles.
- Shared `public` schema `USAGE` is retained for PostgreSQL/extension
  compatibility, but PUBLIC `CREATE` is revoked. Schema visibility alone grants
  no VAX object access; table grants plus RLS remain deny-by-default.
- Provider-managed objects and schemas retain provider ownership.
- New migrator-created tables, sequences and functions grant no runtime,
  Data API or PUBLIC access by default. Every later migration must declare its
  exact runtime grants and RLS policies.
- New functions created by `vax_migrator` do not inherit PostgreSQL's default
  PUBLIC `EXECUTE` privilege.
- The runtime owns no object and receives no sequence privilege because its
  current INSERT paths use UUIDs rather than identity sequences.

## Runtime DML classification

`S`, `I`, `U`, and `D` mean runtime `SELECT`, `INSERT`, `UPDATE`, and `DELETE`.
The machine-verifiable authority is
`src/db/database-security-policy.ts`; migration 0012 must match it exactly.

| Category                 | Runtime privileges | Tables                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Reference/configuration  | S                  | `appointment_window_definitions`, `capability_statuses`, `cleaning_item_type_measurement_modes`, `cleaning_item_types`, `cleaning_product_categories`, `cleaning_products`, `commercial_condition_bands`, `communication_templates`, `condition_levels`, `duration_models`, `duration_rules`, `equipment_resources`, `fibre_materials`, `issue_handling_classifications`, `issue_types`, `material_treatment_considerations`, `measurement_modes`, `mechanical_action_levels`, `operations_teams`, `parking_policies`, `price_books`, `price_rules`, `reuse_advisory_categories`, `risk_flags`, `service_addon_capabilities`, `service_addons`, `service_categories`, `service_item_capabilities`, `service_treatment_levels`, `services`, `surface_constructions`, `team_capabilities`, `team_equipment_assignments`, `timing_categories`, `travel_time_matrix_rules`, `travel_time_profiles`, `travel_zones`, `treatment_approaches`, `treatment_levels`, `working_hour_policies`, `working_hour_rules` |
| Identity/RBAC            | S                  | `application_roles`, `permissions`, `role_permissions`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Identity/RBAC            | S/I/U              | `user_profiles`, `user_roles`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| CRM                      | S/I                | `cleaning_asset_reported_issues`, `cleaning_asset_reported_risk_flags`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| CRM                      | S/I/U              | `cleaning_assets`, `customer_contacts`, `customer_identity_links`, `customers`, `properties`, `property_areas`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Request/Quote            | S/I                | `request_estimates`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Request/Quote            | S/I/U              | `quotes`, `service_request_items`, `service_requests`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| Request/Quote            | S/I/D              | `quote_items`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Request/Quote            | S/I/U/D            | `service_request_item_addons`, `service_request_item_issues`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Booking/scheduling       | S/I                | `booking_items`, `quote_acceptances`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Booking/scheduling       | S/I/U              | `booking_occupancies`, `bookings`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Job execution            | S                  | `team_memberships`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Job execution            | S/I                | `job_item_inspection_issues`, `job_item_inspection_risks`, `job_item_inspections`, `job_item_treatment_plan_addons`, `job_item_treatment_plans`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| Job execution            | S/I/U              | `job_item_treatment_executions`, `job_items`, `jobs`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Finance                  | S                  | `business_legal_profiles`, `customer_billing_profiles`, `invoice_policies`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Finance                  | S/U                | `invoice_numbering_policies`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Finance                  | S/I                | `invoice_items`, `payment_allocations`, `payment_reversals`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| Finance                  | S/I/U              | `invoices`, `payments`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Communications/documents | I                  | `communication_audit_events`, `delivery_attempts`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Communications/documents | S/I                | `communication_intents`, `customer_communication_history_entries`, `delivery_results`, `documents`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| Communications/documents | S/I/U              | `customer_communication_preferences`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Business authority       | S/I/U              | `business_authority_records`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| Business authority       | S/I                | `business_authority_audit_events`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| Audit/history            | S/I                | `auth_audit_events`, `booking_audit_events`, `business_audit_events`, `cleaning_passport_entries`, `finance_audit_events`, `job_audit_events`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| Migration/system         | none               | `system_metadata`; the Drizzle ledger is outside the runtime schema contract                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |

Ordinary runtime DELETE is limited to the three mutable draft/scope child
tables shown above. Audit/history, accepted Booking facts, Job evidence,
Cleaning Passport entries, issued Invoice items, allocation/reversal ledgers,
immutable documents, delivery evidence and Business Authority audit events
receive no runtime UPDATE or DELETE. Business Authority records receive no
DELETE; their governed payload is immutable and only the exact audited status/
version transition may update them. Existing trigger and lifecycle protections
remain authoritative where a record is conditionally immutable.

### Row-lock-only authority

PostgreSQL requires UPDATE authority for `SELECT ... FOR SHARE/UPDATE`, even
when the statement never changes a row. Existing VAX repositories use those
locks to preserve concurrent provenance, commercial and scheduling decisions.
Migration 0013 therefore grants `UPDATE` only on one primary-key column of 28
locked read-only tables and adds a separate `vax_runtime_lock` UPDATE policy with
`USING (true)` and `WITH CHECK (false)`. This permits row locks while ordinary
UPDATE remains outside the DML matrix and fails closed. The live harness proves
both a successful reference-row lock and a rejected data update.

The exact lock-only inventory is `vaxRuntimeLockTableNames` in
`src/db/database-security-policy.ts`. It covers locked reference/configuration,
issued provenance and finance-policy records; it does not give the runtime a
general table-level UPDATE grant.

## RLS model and threat boundary

Migration 0012 enables RLS on every VAX public table. Policies are granted only
to `vax_runtime` and only for the commands in the reviewed matrix, with the
restrictive migration-0013 lock policies described above. No policy is
created for `authenticated`, `anonymous`, or PUBLIC, so those identities remain
default-denied even if a future table grant is accidentally reintroduced.
`vax_runtime` is neither owner nor `BYPASSRLS`; the policies therefore apply.

This RLS layer stops:

- accidental browser/Data API access to VAX tables;
- accidental use of a DML command outside the table contract; and
- default-privilege drift that would otherwise recreate broad Data API access.

It does **not** claim customer-row or technician-team isolation inside the
server runtime. Current repositories authorize with server-resolved profile
IDs and database-side role, permission, ownership and team-link checks, but
they do not establish transaction-local actor context on every Neon HTTP query.
Although Neon HTTP batches are transactional, ordinary reads are independent
HTTP queries, and a connection-role-set custom setting would not itself be a
tamper-proof authorization assertion. Adding `USING (true)` policies for a
browser role or pretending that client input is trusted actor context would be
false assurance.

Accordingly:

- missing actor context is not treated as customer-level RLS;
- customer A/B, technician scope and staff authority continue to be enforced
  and tested at the server repository boundary;
- arbitrary client fields never become database authorization context; and
- future actor-aware RLS requires one transaction-scoped server adapter for
  every sensitive query, server-derived context, pooling/reuse leakage tests,
  and a separate security review.

Table owners normally bypass RLS. `FORCE ROW LEVEL SECURITY` is intentionally
not used because `vax_migrator` must perform migrations and controlled seeds;
the runtime is non-owner and cannot switch to the owning role.

## Functions, triggers and sequences

All VAX PostgreSQL functions are trigger functions, use invoker security, and
have no direct runtime API. Migration 0012 removes direct EXECUTE from PUBLIC,
Data API roles and `vax_runtime`. Trigger behavior is verified after revocation.
Future `SECURITY DEFINER` functions are prohibited unless they have a fixed
safe `search_path`, validated inputs, a controlled non-runtime owner, minimal
EXECUTE grants and focused abuse tests.

The runtime cannot alter or disable triggers. It receives no public-sequence
privilege or ownership. The migrator owns VAX sequences and must explicitly
grant a future sequence only when a reviewed runtime INSERT actually needs it.

## Development verification

The live Phase 3K harness uses the real runtime and migrator credentials. It
verifies role attributes, object ownership, exact grants/policies, Data API and
anonymous denial, migration-ledger denial, runtime DDL/role/grant/trigger
denial, trigger behavior, default-deny future objects, representative allowed
reads/writes, and controlled migrator DDL with no residual object. Pre/post
snapshots compare all VAX row counts, prior migration hashes, canonical RBAC
counts and a structural Neon Auth fingerprint.

Credential-free CI verifies the static policy/migration contract. It cannot
substitute for the guarded live development harness.

## Staging and production gate

Phase 3L created an isolated Neon `staging` branch from `development`, rotated
its distinct runtime, migrator and administrator credentials, applied
the additive migrations `0014` and `0015`, and
re-ran the low-privilege, zero-data-loss, rebuild, rollback and branch-recovery
checks. Staging Auth remains separate and browser Data API access remains
prohibited. The exact evidence and incomplete hosted/email/session/export gates
are recorded in `docs/STAGING_READINESS.md`.

Phase 3N applies migration 0016 only to the authorized development and staging
branches. It extends the static policy to exactly 100 tables, preserves the
five-role/28-permission/76-mapping canonical RBAC contract and inserts no
authority or finance configuration. The migration replaces only four existing
finance environment checks to add the explicit `STAGING` scope; it does not
alter any Invoice, seller, numbering or payment row.

Production remains untouched and contains no VAX migration ledger. A later
production migration, credential/configuration change, Data API change or
deployment requires separate authorization.

Migration `0015_phase_3l_readiness_attestation.sql` adds one
`vax_migrator`-owned security-definer function with a fixed safe search path.
Only `vax_runtime` can execute it, and it returns only the ordered ledger
hashes. Runtime, browser/Auth roles and PUBLIC remain denied direct ledger
access. The readiness query uses the function to compare the exact 16-entry
Phase 3L history and exact operational table shape without broadening runtime
authority. After Phase 3N, the repository attestation expects the 17-entry
history and the two additional authority tables.

Migration `0016_phase_3n_business_authority.sql` grants the runtime only
SELECT/INSERT/UPDATE on the authority record and SELECT/INSERT on its audit
stream, with matching command-scoped RLS. Three migrator-owned trigger guards
enforce immutable payloads, legal environment/status transitions, complete
conceptual approval evidence and exact audit/record correlation. A fourth,
narrow security-definer function validates the fresh transaction-local HMAC
binding of application profile, provider subject, primary/secondary correlation
and issue time, then repeats the live active-Owner plus
`SYSTEM_SETTINGS_MANAGE` check. Four triggers protect both sides of the deferred
graph. PUBLIC, `authenticated` and `anonymous` cannot execute any function;
runtime can execute only the actor assertion required by the triggers and
cannot read or write its protected derived key. Guard execution and ordinary
deletion remain absent.

The derived actor-context verifier is purpose-derived from
`NEON_AUTH_COOKIE_SECRET` plus the explicit validated `VAX_ENVIRONMENT` and
written to protected `system_metadata` by the
migrator seed after the atomic migration set succeeds. The root secret never
enters the database or migration SQL. Missing/mismatched metadata or environment
selection fails closed. Environment-separated derivation prevents a staging
signature from validating in production even if the same root secret were
mistakenly configured.
Rotating the root secret therefore requires an authorized maintenance window,
blocked authority mutations, a migrator-only verifier update, full application
instance drain/restart and explicit new-signature/old-signature verification.

## Recovery

Role provisioning and migration are forward-only repository operations. Before
any non-development use, capture ownership, grants, policies, object counts,
row counts, migration ledger and Auth fingerprint. Recovery must use an
approved database restore or a separately reviewed inverse grant/ownership
plan. Do not disable RLS or restore owner-class runtime credentials as an
unreviewed incident workaround.
