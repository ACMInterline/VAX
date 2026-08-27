# Database Model

## Current implementation

Phase 0A implements the infrastructure table `system_metadata`.

| Column | PostgreSQL type | Rules | Purpose |
| --- | --- | --- | --- |
| id | integer identity | Primary key, generated always | Stable internal identifier |
| key | varchar(255) | Required, unique | Metadata lookup key |
| value | jsonb | Required | Small structured infrastructure value |
| created_at | timestamptz | Required, defaults to now | Creation time |
| updated_at | timestamptz | Required, defaults to now | Last application-managed update time |

The schema is defined in src/db/schema.ts. The corresponding SQL and Drizzle
metadata live in drizzle/. The updated_at value is maintained by Drizzle on
ORM-driven updates; the database does not contain a provider-specific trigger.

Phase 0B applied this initial schema only to the VAX Neon `development` branch
and its `neondb` database. Drizzle also maintains its normal migration ledger.

Phase 2 adds canonical service-catalogue reference structures to development.
They define vocabulary and permitted relationships; they are not customer or
transaction records.

| Structure | Responsibility |
| --- | --- |
| `service_categories` | Stable high-level commercial and operational groupings |
| `services` | Stable service identities, public-slug mapping and nullable duration inputs |
| `cleaning_item_types` | Types of durable physical object or textile surface |
| `measurement_modes` | Area, item, seat, linear and custom-assessment modes |
| `cleaning_item_type_measurement_modes` | Permitted modes and exactly one default per item type |
| `fibre_materials` | Fibre-composition vocabulary |
| `surface_constructions` | Separate construction and finish vocabulary |
| `condition_levels` | Neutral customer/inspection condition scale |
| `issue_handling_classifications`, `issue_types` | Structured issue vocabulary and handling boundary |
| `risk_flags` | Assessment and sensitivity flags, not diagnoses |
| `treatment_levels` | Five non-customer-selectable treatment levels |
| `mechanical_action_levels` | Mechanical-action intensity independent of treatment level |
| `treatment_approaches` | Provider-neutral moisture and extraction approaches |
| `reuse_advisory_categories` | Controlled return-to-use guidance category |
| `cleaning_product_categories`, `cleaning_products` | Product evidence foundation; no actual products seeded |
| `service_addons` | Price-free optional or conditional treatment vocabulary |
| `capability_statuses` | Standard, assessment, specialist and unavailable relationship status |
| `service_item_capabilities` | Service ↔ item applicability and inspection/instant-quote controls |
| `service_treatment_levels` | Service ↔ treatment-level availability |
| `material_treatment_considerations` | Explicit material ↔ treatment cautions |
| `service_addon_capabilities` | Service ↔ add-on availability |

All canonical rows use stable codes, Bulgarian and English labels and
descriptions, ordering, active state and timestamps where appropriate. The
code-controlled definitions and idempotent upsert seeder are described in
`docs/SERVICE_CATALOGUE.md`.

Phase 2 introduces no monetary column, price row, customer, durable cleaning
item, quote, booking, job or payment. The production branch remains without VAX
application tables, and Neon Auth-managed schemas are not part of Drizzle.

Phase 2A adds versioned commercial configuration only to development:

| Structure | Responsibility |
| --- | --- |
| `commercial_condition_bands` | Commercial complexity independent of treatment level |
| `parking_policies` | Included, pass-through, estimated or custom parking semantics |
| `travel_zones` | Canonical Sofia travel-zone foundation with unresolved thresholds |
| `timing_categories` | Standard, early, evening, weekend and urgent timing vocabulary |
| `price_books` | EUR market/segment/version, lifecycle, effective window and VAT basis |
| `price_rules` | Version-owned item, area, minimum, modifier, add-on, travel and timing rules |
| `duration_models` | Versioned operational-estimate configuration |
| `duration_rules` | Setup, inspection, cleanup, item, productivity and complexity inputs |

Money is stored as integer EUR minor units. VAT and percentage modifiers use
integer basis points; measured area boundaries use integer hundredths. Draft
price books and rules are insert-only seed records and must not be overwritten
when historically referenced. The initial residential and B2B books and the
duration model are provisional, inactive and not approved for publication.

These tables contain configuration, not transactions. No quote, snapshot,
booking, customer, durable cleaning item, job, payment or invoice table is
introduced. Future accepted quotes and bookings must persist an immutable
snapshot of the exact price-book version, rules, inputs, lines and tax result.

Phase 2B extends scheduling reference/configuration on development only:

| Structure | Responsibility |
| --- | --- |
| extended `travel_zones` | Service eligibility, optional minimum/base-travel semantics, confirmation and future geography |
| `working_hour_policies`, `working_hour_rules` | Versioned local operating windows and optional team overrides |
| `operations_teams`, `team_capabilities` | Dispatchable team identity, crew size and capability foundation without employee identities |
| `equipment_resources`, `team_equipment_assignments` | Lightweight equipment availability and team assignment |
| `appointment_window_definitions` | Versioned customer request-window vocabulary, separate from exact slots |
| `travel_time_profiles`, `travel_time_matrix_rules` | Versioned provider-independent travel fallback configuration |

Working-hour and travel profiles and appointment-window versions use
insert-only seed behavior. The initial rows are inactive provisional drafts.
There is intentionally no scheduling-block, occupancy, reservation or booking
table. Breaks, sample jobs and future occupancy are typed ephemeral contracts in
the pure availability module. A future accepted booking must preserve immutable
price, duration, travel, working-hours, equipment and scheduling provenance.

Phase 3A adds application-owned identity and authorization structures on
development only:

| Structure | Responsibility |
| --- | --- |
| `user_profiles` | Unique provider-subject mapping, display name, preferred locale, nullable phone and ACTIVE/SUSPENDED/DISABLED status |
| `application_roles` | Stable role codes and localized labels |
| `permissions` | Stable action capability codes |
| `role_permissions` | Deterministically seeded canonical role mapping |
| `user_roles` | Active/revoked assignment state, source, time and optional application actors |
| `auth_audit_events` | Append-oriented sanitized application security events |

These tables contain no password, session, reset token, provider secret,
customer, property, request, quote or booking. Neon continues to own accounts,
credentials and sessions in `neon_auth`, which remains outside Drizzle.
Canonical seeds insert new roles and permissions as active but preserve an
existing row's operator-managed active/inactive state on conflict; the
role-to-permission mapping remains code-controlled and deterministic. The
application profile UUID is distinct from the provider subject and from any
future CRM customer identifier.

Phase 3B requires no schema or migration. Privileged list/detail reads use the
existing profile, assignment and audit tables. Role changes update the existing
assignment row's active/revocation state and preserve each change in the
append-oriented audit stream. Status changes update `user_profiles.status`.
Each successful state change and its sanitized audit insert execute atomically;
the same transaction explicitly selects `READ COMMITTED`, then acquires a shared
transaction advisory lock before any state is read. The mutation statement then
rechecks the actor, target and database-side active-owner count from a fresh
snapshot before changing state and appending its audit. Index additions are
deferred until real query-volume evidence justifies them.

Phase 3C adds the first runtime business records on development:

| Structure | Responsibility |
| --- | --- |
| `customers` | Individual/business identity, contact summary, locale, lifecycle and staff-only internal summary |
| `customer_contacts` | Multiple named contact channels, one active primary contact at most |
| `customer_identity_links` | Explicit active/revoked application-profile access relationship; never inferred from email |
| `properties` | Customer-owned service locations, sensitive address/access facts, optional coordinates and travel-zone reference |
| `property_areas` | Lightweight typed rooms/areas with optional custom label and floor |
| `cleaning_assets` | Stable physical item identity and customer-described profile linked to canonical item/material/construction/condition definitions |
| `cleaning_asset_reported_issues` | Current customer-reported issue associations using canonical issue types |
| `cleaning_asset_reported_risk_flags` | Current customer-reported risk associations using canonical risk flags |

Customers, properties and assets use `ACTIVE`, `INACTIVE` and `ARCHIVED`
lifecycle states. Mutable records carry a monotonic version, timestamps and
nullable application-profile actor metadata. Identity links retain creation and
revocation provenance. Ownership and canonical foreign keys use restrictive
deletion; only actor metadata may become null when its profile is removed. No
business record is cascade-deleted when an identity link is revoked.

The asset-to-area relationship includes property ownership in its foreign key,
so an area from one property cannot be attached to another property's asset.
The asset UUID is the future Cleaning Passport attachment point. Reported
condition/issues/risks are current descriptive facts, not a professional
assessment or completed treatment event.
Delicate, valuable and antique/vintage declarations reuse the canonical risk
flags rather than introducing duplicate asset booleans.

There is no Phase 3C CRM seed. The migration creates no request, quote, booking,
job, cleaning history, payment or invoice table and does not alter
provider-managed `neon_auth`. See `docs/CRM_AND_PRIVACY.md` for sensitive-data,
archive and deferred retention decisions.

Phase 3D adds persistent request, estimate, quote and business-audit structures
to development:

| Structure | Responsibility |
| --- | --- |
| `service_requests` | Anonymous, linked-customer or staff-created request, random public reference, immutable original submission, CRM resolution, lifecycle and optimistic version |
| `service_request_items` | Staff-normalized scope separate from the submitted description, with optional catalogue, CRM asset and measurement references |
| `service_request_item_issues` | Relational customer-reported/staff-confirmed issue provenance |
| `service_request_item_addons` | Relational customer-requested/staff-included add-on provenance |
| `request_estimates` | Append-only estimate versions with complete immutable price and duration snapshots, exact model identities, searchable totals and review state |
| `quotes` | Versioned staff-reviewed commercial offer, estimate provenance, frozen terms/totals/validity, nullable database-built Phase 3E acceptance-source snapshot and optimistic draft version |
| `quote_items` | Frozen bilingual line descriptions, measurements, exact integer amounts and calculation evidence |
| `business_audit_events` | Separate append-oriented, allowlisted request/estimate/quote event stream with safe metadata |

Request references carry 96 bits of random entropy and reveal no sequential
identifier. Original submissions are retained as validated JSON snapshots;
structured normalization does not overwrite them. Contact equality is never a
foreign-key or ownership rule. `requesting_profile_id` records provenance only,
while customer access is derived from the current active
`customer_identity_links` relationship.

Estimates use a unique `(request_id, estimate_version)` and are inserted rather
than updated. Each stores the resulting optimistic `source_request_version`.
Complete price, duration and advisory readiness input/result evidence remains
in JSONB, while EUR minor-unit totals, VAT basis points and duration minutes
remain searchable exact scalar values. The initial configurations are still
provisional, inactive or unpublished, so review state is retained and no public
automatic-price claim follows from persistence.

Customer type and property travel zone are independently mutable CRM facts.
Estimate append and quote create/update/issue rederive their effective
commercial values under row locks and compare them with the immutable estimate
input snapshot. This value-based freshness check invalidates semantically stale
commercial evidence without coupling request history to unrelated CRM version
increments.

Quotes use a unique `(request_id, quote_version)`, a separate optimistic
`record_version`, a frozen `source_request_version`, restrictive
estimate/request provenance and a partial unique index that permits only one
`ISSUED` version per request. Draft update and issue fail closed if request
scope has since advanced. An issued quote has
frozen commercial and terms snapshots and may only move to `SUPERSEDED`,
`EXPIRED` or `WITHDRAWN`; edited commercial terms require a new draft/version.
The schema creates no acceptance, booking, reservation, occupancy, payment,
invoice, upload, message or notification record. Phase 3D does not alter Neon
Auth or production. See `docs/REQUEST_AND_QUOTE.md`.

Phase 3E adds the acceptance and Booking boundary to development:

| Structure | Responsibility |
| --- | --- |
| `quote_acceptances` | Immutable agreement to one exact issued quote/version, including actor/source and copied commercial, terms, price, duration and provenance snapshots |
| `bookings` | Durable operational commitment with customer-safe random reference, accepted customer/property relationship, immutable snapshots, separate booking/scheduling state, cancellation evidence and optimistic version |
| `booking_items` | Append-oriented copies of issued quote lines, bilingual descriptions, measurement/calculation evidence and integer minor-unit amounts |
| `booking_occupancies` | Append-oriented schedule versions with one team, optional equipment, service/operational instants, policy identities and full availability/travel/working-hours evidence |
| `booking_audit_events` | Separate allowlisted acceptance, Booking, scheduling and cancellation event stream |

One quote can have only one acceptance and one Booking, and each acceptance can
have only one Booking. Composite restrictive foreign keys bind acceptance to
the exact quote/request/customer/property graph and bind the Booking to that
exact acceptance graph. Business/history references use `ON DELETE RESTRICT`;
only application-profile actor metadata may become null.

Acceptance does not update its source rows. The quote remains `ISSUED`, the
request remains `QUOTED`, and `quote_acceptances` is the authoritative
acceptance relation. The DRAFT-to-ISSUED statement constructs the new quote's
canonical acceptance-source snapshot under source-row locks. It contains the
issued quote/items, raw reported and normalized request-item graph, complete
estimate, allowlisted CRM/property versioned presentation and travel-zone
semantics. Acceptance locks and reconstructs those sources, requires exact
JSONB equality, and copies booking content only from the issued snapshot. No
normalization, price, duration, CRM or commercial row is recalculated,
refreshed or repaired. A legacy `NULL`, malformed value or mismatch writes
nothing and returns staff review.

All newly accepted Bookings are `PENDING_SCHEDULING` with scheduling status
`REVIEW_REQUIRED`. Their scheduling snapshot records that operational
requirements are not frozen and scheduling configuration is not approved;
preferred date/window remains a preference, exact scheduling columns remain
null, and acceptance inserts no occupancy.

Migration 0007 installs `btree_gist` and adds team and equipment GiST exclusion
constraints over half-open `[)` operational ranges for `PENDING`/`CONFIRMED`
occupancy. PostgreSQL therefore rejects concurrent overlap for the same team or
non-null equipment resource. `CANCELLED` rows remain as history but leave the
blocking predicate, releasing capacity. Phase 3G implements the authorized
schedule and reschedule command by appending a new snapshot version linked to
its prior occupancy and adding audited scheduling evidence; Phase 3E itself
continues to create no occupancy.

Money copied into booking items remains exact integer EUR minor units. Acceptance,
booking and occupancy evidence uses reviewed JSONB snapshots plus searchable
relational/scalar facts. The migration is additive, creates no payment, invoice,
Job, treatment, message or upload table, never names `neon_auth`, is authorized
only for Neon development and requires a separate production gate. See
`docs/BOOKING_ENGINE.md`.

Phase 3F adds operational Job execution and Cleaning Passport structures to
development:

| Structure | Responsibility |
| --- | --- |
| `team_memberships` | Time-bounded active application-profile membership in one operations team; operational authorization only, not HR/payroll |
| `jobs` | One Booking-derived field Job with immutable provenance/schedule/property/contact snapshots, controlled lifecycle, server timestamps and actual duration |
| `job_items` | Planned executable scope copied from immutable Booking/issued-Quote evidence, with separate reported/normalized provenance and no money |
| `job_item_inspections` | One immutable professional observation per Job item, including observed measurement, condition, material, construction, damage and feasibility |
| `job_item_inspection_issues`, `job_item_inspection_risks` | Canonical observed issue and risk relationships scoped to the exact inspection, item and Job |
| `job_item_treatment_plans` | One confirmed professional decision per inspected item: perform, perform with limitations, decline, refer or require review |
| `job_item_treatment_plan_addons` | Exact add-ons authorized by the issued Quote for the confirmed plan |
| `job_item_treatment_executions` | One performed-treatment record per planned item, with controlled result, completion evidence and optimistic version |
| `cleaning_passport_entries` | Append-only, customer-safe completed-treatment history for an exact durable cleaning asset |
| `job_audit_events` | Append-oriented allowlisted Job, inspection, treatment, completion and Passport lifecycle evidence |

Exactly one Job can consume a Booking, and every Job item maps to one Booking
item. Composite restrictive foreign keys preserve the Booking/customer/
property, current confirmed occupancy, asset, inspection, plan and execution
graph. Job creation reads planned scope only from the Booking chain and the
immutable issued-Quote `acceptance_source_snapshot`; current request, estimate
and mutable CRM attributes are not fallback inputs. A current active primary
contact may be copied only into a separate visit-contact snapshot.

An exact confirmed Booking occupancy is required before a Job can be `READY`.
A provenance-valid Booking without exact schedule/team/equipment evidence can
produce only a review-gated `PREPARED` Job. Planned, observed, confirmed and
performed facts occupy separate columns/records. Safety, capability, scope or
execution divergence cannot overwrite source history and instead produces a
review, decline or referral outcome.

Job completion freezes actual server-derived productive and occupied-team
minutes. Eligible `cleaning_passport_entries` are created atomically only for
asset-linked treatments actually completed within their confirmed plan. One
restrictive composite key binds each Passport row to the exact completed
execution timestamp, result and performed treatment facts. Inspection-only,
declined, referred, review-required, unperformed, stopped-for-safety and no-
observable-improvement items create no treatment entry. Passport and Job-audit rows have no
ordinary update/delete application path; database-level append-only grants and
reviewed RLS remain a production gate. The additive Phase 3F migration is
authorized only for Neon development, does not alter `neon_auth`, and requires
a separate production migration decision. See `docs/JOB_EXECUTION.md`.

Phase 3G reuses the Phase 3E Booking and occupancy structures rather than
creating a second calendar table:

| Existing structure | Phase 3G responsibility |
| --- | --- |
| `bookings` | Current exact appointment, team/equipment assignment, optimistic version and the small `UNSCHEDULED` / `REVIEW_REQUIRED` / `SCHEDULED` lifecycle |
| `booking_occupancies` | One current blocking row plus immutable linked historical schedule versions with exact service/operational instants and reviewed policy, requirements, location, travel, working-hour, availability and equipment snapshots |
| `booking_audit_events` | Allowlisted scheduling, rescheduling, team/equipment assignment, review, cancellation and occupancy-release evidence |
| `operations_teams`, `team_capabilities` | Current team-resource and capability revalidation at confirmation |
| `equipment_resources`, `team_equipment_assignments` | Current equipment activity, capability, assignment and conflict revalidation |
| scheduling/working/travel configuration | Exact version references retained by each occupancy while the source development rows remain visibly DRAFT/provisional |

The additive `0009_phase_3g_scheduling_dispatch.sql` migration adds only
`revision_kind`,
`revision_reason_category` and `revision_note` to `booking_occupancies`, with
controlled initial/reschedule consistency, reason-category and bounded-note
checks, and broadens the Booking audit event allowlist. It creates no business
table, duplicate schedule record, payment, invoice, notification or Neon Auth
object and does not rewrite existing Booking or occupancy rows.

Initial confirmation locks the Booking, revalidates immutable issued-Quote
provenance and frozen operational requirements, calculates authoritative Sofia
instants on the server, inserts the first occupancy, updates the matching
Booking fields and appends audit evidence atomically. Rescheduling locks the
current blocking occupancy, changes it to `CANCELLED`, inserts a linked higher
snapshot version and updates the Booking/audit stream in the same operation.
PostgreSQL's partial unique index and GiST exclusions remain the final guard for
one current occupancy and no same-team/equipment operational overlap.

Historical occupancy snapshots are interpreted as the evidence captured at
their creation. Later travel, working-hour, team, equipment or service-zone
changes never reinterpret them. A current `READY` Job prevents the scheduling
command from silently replacing its exact occupancy binding. See
`docs/SCHEDULING_AND_DISPATCH.md`.

Phase 3H adds controlled finance configuration and settlement structures to
development:

| Structure | Responsibility |
| --- | --- |
| `customer_billing_profiles` | Versioned customer invoice identity/address and controlled VAT-identifier state |
| `business_legal_profiles` | Environment-scoped versioned seller legal identity and optional approved payment instructions |
| `invoice_numbering_policies` | Environment/document-scoped, versioned prefix and serialized next sequence |
| `invoice_policies` | Environment-scoped draft/issue eligibility, payment terms, due days, currency and exact seller/numbering relationships |
| `invoices` | Accepted-commercial financial claim, immutable issue-time snapshots, exact totals, lifecycle and generated outstanding balance |
| `invoice_items` | Frozen bilingual Quote/Booking lines with exact money, VAT, measurement and optional Job-item provenance |
| `payments` | Manually recorded external receipts with explicit confirmation/reversal and generated unallocated balance |
| `payment_allocations` | Append-oriented allocation and compensating-reversal ledger between a Payment and Invoice |
| `payment_reversals` | One immutable, reasoned reversal fact for an original Payment |
| `finance_audit_events` | Separate allowlisted Invoice, Payment, allocation, reversal and settlement evidence |

Financial amounts use integer EUR minor units, VAT uses integer basis points,
and generated balances are exact differences. Invoice line sums must reproduce
the stored net/VAT/gross totals. Draft creation copies the Quote Acceptance,
Booking, Booking items and issued Quote/Quote-item evidence. It does not run
pricing, normalization or CRM repair. Exact composite restrictive foreign keys
bind each Invoice and item to that source graph; missing, stale or inconsistent
evidence remains review-gated.

`JOB_COMPLETED` at draft eligibility blocks insertion until the exact Job/item
graph is complete. `BOOKING_ACCEPTED` draft eligibility paired with
`JOB_COMPLETED` issue eligibility may insert only a completion-waiting `DRAFT`
with sole reason `JOB_COMPLETION_REQUIRED`; issue later revalidates every source,
item, configuration and Job fact without modifying the frozen snapshots.

Customer billing, seller, numbering and invoice policy use `DRAFT`, `APPROVED`
and `SUPERSEDED` history. Seller, numbering and policy authority is also scoped
to `DEVELOPMENT` or `PRODUCTION`. The migration seeds none of these facts.
Production issue requires approved, non-provisional production configuration;
development placeholders cannot become production authority implicitly.

One live standard Invoice may exist per Booking. Formal number allocation locks
and increments one approved numbering policy during issue; unique constraints
protect both the formatted number and source sequence. Issued Invoice headers,
items and configuration already referenced by history are protected from
ordinary mutation. `OVERDUE` remains derived from due date and outstanding
balance rather than stored as a scheduled transition.

Payments are recorded as `RECORDED`, explicitly move to `CONFIRMED`, and only
then become allocatable. Allocation requires matching customer/currency, locks
Payment before Invoice, and cannot exceed either unallocated Payment value or
Invoice outstanding value. Partial and exact coverage derive
`PARTIALLY_PAID`/`PAID`. Excess value remains unallocated; there is no customer-
credit asset or automatic overpayment policy.

Reversal deletes nothing. It appends one `payment_reversals` row and one
compensating `payment_allocations` row per effective allocation, restores
Invoice balances and marks the Payment `REVERSED` atomically. Idempotency keys
and payload fingerprints protect payment recording, allocation and reversal
retries. Append-only ledger/audit enforcement, production least-privilege and
RLS remain deployment gates. The additive
`0010_phase_3h_finance_invoicing.sql` migration creates no Auth object and is
authorized only for Neon development. See
`docs/FINANCE_AND_INVOICING.md`.

Phase 3I adds customer-safe communication and immutable document structures:

| Structure | Responsibility |
| --- | --- |
| `communication_templates` | Versioned Bulgarian/English plain-text templates with exact allowlisted-variable contracts |
| `customer_communication_preferences` | Customer channel, service-purpose, marketing-consent and durable locale choices |
| `communication_intents` | Exact customer, source/audit event, source version, template, channel, snapshots, lifecycle and idempotency evidence |
| `documents` | Final structured HTML/print content, template/renderer/source versions, SHA-256 checksum and supersession relationship |
| `delivery_attempts` | Append-only local portal attempt evidence; the database permits only `PORTAL_LOCAL` in this phase |
| `delivery_results` | One append-only local terminal result per attempt |
| `customer_communication_history_entries` | Customer-visible publication timeline tied to the exact intent, document and result |
| `communication_audit_events` | Sanitized intent/render/publication/preference lifecycle evidence |

The owning request/Quote, Booking, Job and finance audit streams remain the
business-event authority. Staff explicitly materialize an eligible event; the
application does not automatically scan or reinterpret source tables.
Source-specific restrictive foreign keys and database checks bind each intent
to exactly one matching customer/source/audit graph. Booking confirmations and
reschedules also bind the exact occupancy revision.

The customer-safe projection excludes source payloads such as access notes,
coordinates, staff notes, request free text, estimate internals, external
payment references and provider details. Templates render only an exact
allowlisted variable contract into validated structured content. A stable
SHA-256 checksum binds that content to template key/version, locale and
renderer version. Unique source-event and payload-bound idempotency keys block
duplicate or conflicting materialization.

Current portal publication atomically inserts the `DELIVERED_LOCAL` intent,
final document, completed local attempt, `PORTAL_PUBLISHED` result, customer
history and audit evidence. `DELIVERED_LOCAL` is an application-local state,
not external delivery or customer-read proof. Customer reads require the exact
active profile/customer link and return only final/superseded documents with a
matching local result.

Migration `0011_phase_3i_communications_documents.sql` also adds the supporting
same-customer unique indexes needed by its composite foreign keys and installs
template/intent/document/delivery graph and append-only guards. It rewrites no
prior migration, creates no Auth/provider object, stores no binary PDF and is
authorized only for Neon development. Email/SMS/provider delivery, external
retries/callbacks, manual free-form messages, automatic event materialization,
binary storage, production migration and deployment remain deferred. See
`docs/COMMUNICATIONS_AND_DOCUMENTS.md`.

## Long-term relationship

The implemented durable hierarchy foundation is:

> Customer → Property → Property Area → Cleaning Asset → Cleaning Passport history

The implemented commercial-intake relationship is:

> Customer or anonymous intake → Service Request → Estimate versions → Quote
> versions → Quote Acceptance → Booking → occupancy versions → Job → Invoice
> → Payment allocations

The implemented customer-document relationship is:

> owning immutable audit event → Communication Intent → final Document → local
> Delivery Result → Customer Communication History

Expected cardinalities:

- one customer may own or manage many properties;
- one property contains many rooms;
- one room contains many durable cleaning items;
- one cleaning asset may appear in many Booking and Job events; and
- one cleaning asset may accumulate many append-only Cleaning Passport entries;
- one Booking may create at most one live standard Invoice; and
- one Payment may allocate across several Invoices while one Invoice may receive
  several Payments; and
- one eligible source event/template/channel combination may materialize at
  most one communication intent, while a customer may retain many history
  entries.

A Booking item can retain an indirect relationship to a cleaning asset through
its source request item. It does not own or replace that asset. This distinction
enables a Digital Cleaning Passport across repeat visits.

## Planned domains

The following catalog records implemented and intended model vocabulary.
Planned entries still require their columns, constraints, identifiers,
lifecycle states, retention and deletion behavior to be designed in the owning
phase before migration.

### Identity

The initial application profile, role, permission, assignment and authentication
event tables are implemented in Phase 3A. Phase 3B implements privileged
application role/status management and read-only reconciliation states without
new tables. Invitations, organization membership, provider lifecycle repair,
and reliable session administration remain planned; see
`docs/IDENTITY_AND_ACCESS.md`.

### CRM

| Implemented or planned table | Responsibility |
| --- | --- |
| customers | Implemented durable individual or business customer record |
| customer_contacts | Implemented contact people and channels associated with a customer |
| customer_identity_links | Implemented explicit application-profile access relationship |
| customer_preferences | Consent, service, language, and communication preferences |

### Properties

| Implemented or planned table | Responsibility |
| --- | --- |
| properties | Implemented service locations associated with customers |
| property_areas | Implemented lightweight durable spaces within a property |
| cleaning_assets | Implemented durable carpets, rugs, upholstery, mattresses, and other serviceable physical items |
| cleaning_asset_reported_issues, cleaning_asset_reported_risk_flags | Implemented customer-described current asset profile associations |

### Requests and quotes

| Implemented table | Responsibility |
| --- | --- |
| service_requests | Persistent intake, ownership/resolution and controlled lifecycle |
| service_request_items | Original-description-preserving structured scope with separate reported and normalized condition/material/construction facts |
| service_request_item_issues, service_request_item_addons | Relational issue and add-on provenance |
| request_estimates | Append-only price/duration calculation history |
| quotes, quote_items | Versioned reviewed offer and frozen customer-visible lines |
| business_audit_events | Safe request/estimate/quote state-change evidence |

### Service catalogue

| Implemented or planned table | Responsibility |
| --- | --- |
| service_categories | High-level catalogue grouping |
| services | Bookable or quotable service definitions |
| fibre_materials | Fibre composition relevant to inspection and treatment |
| surface_constructions | Surface construction or finish, separate from fibre composition |
| treatment_levels | Standardized effort or treatment classifications |
| cleaning_products | Approved products and handling information |
| issue_types | Standard issue and contamination taxonomy with handling classification |

### Booking

| Implemented table | Responsibility |
| --- | --- |
| quote_acceptances | Immutable explicit acceptance of one issued quote |
| bookings | Operational commitment and lifecycle created from that acceptance |
| booking_items | Frozen quote-line copies and commercial/duration evidence |
| booking_occupancies | Versioned team/equipment operational intervals with PostgreSQL overlap protection |
| booking_audit_events | Allowlisted acceptance, Booking, scheduling, rescheduling, assignment, review, cancellation and occupancy-release history |

Candidate holds, customer-controlled appointment movement, exceptional
post-readiness overrides and timestamped contextual-note history remain
planned. Phase 3G implements ordinary exact confirmation and controlled
rescheduling through append-oriented occupancy versions. Booking items may
retain an optional relationship to the implemented cleaning asset through their
request-item provenance; they do not own or replace the durable CRM asset.

### Operations

| Implemented or planned table | Responsibility |
| --- | --- |
| operations_teams | Implemented team-capacity reference without employee identity |
| team_capabilities | Implemented capability foundation |
| equipment_resources, team_equipment_assignments | Implemented lightweight capacity foundation; maintenance history remains planned |
| employees | Staff and technician employment profiles |
| team_memberships | Implemented time-bounded application-profile membership in an operations team |
| jobs, job_items | Implemented Booking-derived executable work and immutable planned item scope |
| job_assignments | Richer employee or multi-team assignment history remains planned; Phase 3F binds one exact occupancy team on `jobs` |
| job_audit_events | Implemented append-oriented Job/item lifecycle events |

### Inspection

| Implemented or planned table | Responsibility |
| --- | --- |
| job_item_inspections | Implemented one professional observation per exact Job item, including responsible application profile |
| job_item_inspection_issues, job_item_inspection_risks | Implemented canonical observed issues and risks |
| surface_assessments | Phase 3F stores confirmed material/construction, observed condition and feasibility on the item inspection; richer amendment/evidence history remains planned |
| identified_stains | Canonical observed issue relationships are implemented; confidence/evidence detail remains planned |
| existing_damage | Phase 3F records presence and notes on the inspection; customer acknowledgement and media evidence remain planned |

### Treatment

| Implemented or planned table | Responsibility |
| --- | --- |
| job_item_treatment_plans, job_item_treatment_plan_addons | Implemented confirmed treatment decision and issued-Quote-authorized add-ons |
| job_item_treatment_executions | Implemented performed treatment, result and immutable completion snapshot |
| products_used | Phase 3F permits one optional verified canonical product reference; quantity/consumption history remains planned |
| technician_notes | Phase 3F separates internal and customer-visible notes on owned workflow records; richer timestamped amendment history remains planned |

### Media

| Planned table | Responsibility |
| --- | --- |
| attachments | Metadata and object-storage references |
| job_photos | Job-specific photo metadata and classification |

Binary data must not be stored in PostgreSQL. These tables will reference
objects held by a separate storage provider.

### Commercial

| Implemented or planned table | Responsibility |
| --- | --- |
| price_rules | Implemented versioned pricing inputs and applicability |
| price_books | Implemented version, segment, currency, VAT and lifecycle authority |
| duration_models, duration_rules | Implemented independent operational-estimate configuration |
| quotes | Implemented proposed commercial scope, version, validity and immutable issued history |
| quote_items | Implemented itemized quoted work with frozen bilingual descriptions and exact amounts |
| discounts | Explicit discount definitions and approvals |
| customer_billing_profiles | Implemented versioned invoice-time customer billing identity |
| business_legal_profiles | Implemented versioned seller legal-identity configuration; no real values seeded |
| invoice_numbering_policies, invoice_policies | Implemented environment-scoped issue/terms/numbering configuration; no operational values seeded |
| invoices, invoice_items | Implemented immutable accepted-commercial financial documents and line provenance |
| payments | Implemented manual external-receipt record and confirmation/reversal lifecycle; no provider processing |
| payment_allocations | Implemented allocation/compensation ledger for partial and full settlement |
| payment_reversals | Implemented append-only payment reversal fact; no money-out refund |

### Customer experience

| Implemented or planned table | Responsibility |
| --- | --- |
| `communication_templates`, `communication_intents` | Implemented versioned template and exact immutable event-to-intent authority |
| `documents` | Implemented checksummed customer-safe HTML/print snapshot; binary PDF remains planned |
| `delivery_attempts`, `delivery_results` | Implemented local portal publication evidence; external adapters/results remain planned |
| `customer_communication_history_entries`, `customer_communication_preferences` | Implemented linked-customer history and separate channel/purpose/marketing/locale choices |
| reviews | Customer feedback and publication state |
| claims | Complaint or damage-claim lifecycle |
| messages | Conversation records across supported channels |
| external notification adapters | Email/SMS provider delivery, retries, suppression, callbacks and external results |

### Maintenance

| Implemented or planned table | Responsibility |
| --- | --- |
| cleaning_passport_entries | Implemented append-only completed-treatment history tied to one durable cleaning asset and exact execution |
| care_recommendations | Phase 3F stores optional customer-safe advice and evidence-scoped review date/interval on the Passport entry |
| reminders | Scheduled maintenance and follow-up prompts |

### Business control

| Implemented or planned table | Responsibility |
| --- | --- |
| equipment | Durable company equipment |
| equipment_maintenance | Inspection, service, and repair history |
| inventory | Consumable stock and movement basis |
| business_audit_events | Implemented request/estimate/quote business events; broader business-audit coverage remains planned |
| booking_audit_events, job_audit_events | Implemented owning streams for acceptance/Booking and Job execution respectively |
| finance_audit_events | Implemented owning stream for Invoice, Payment, allocation, reversal and settlement evidence |
| communication_audit_events | Implemented sanitized communication/render/local-publication/preference evidence |
| audit_logs | Planned broader cross-domain critical-operation audit records or reviewed extensions of the owned streams |
| activity_logs | Lower-risk operational activity stream |

## Future modeling rules

- Prefer explicit foreign keys and constraints over application-only
  assumptions.
- Separate mutable current state from append-oriented history when both are
  required.
- Preserve the quoted and performed facts needed for later explanation.
- Use explicit money currency and integer minor units or another reviewed exact
  numeric strategy; never floating-point amounts.
- Model scheduling with absolute instants, explicit service time zones,
  unambiguous duration and tested daylight-saving conversion.
- Design tenant or organizational ownership before storing business data.
- Define archival, retention, and legal deletion behavior per domain.
- Keep external provider identifiers as adapter data, not primary domain
  identity.
- Add indexes from demonstrated query and constraint needs.
- Introduce enum-like lifecycle values through backward-compatible migrations.

## Migration discipline

Every schema change requires:

1. a typed schema change;
2. a generated migration;
3. inspection of generated SQL and metadata;
4. compatibility and rollback analysis;
5. tests at the lowest level that proves the affected behavior; and
6. explicit authorization before applying to production.

Destructive edits must never be hidden inside an unrelated migration.
