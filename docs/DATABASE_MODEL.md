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

## Long-term relationship

The central durable hierarchy is:

> Customer → Property → Room → Cleaning Item → Cleaning History

Expected cardinalities:

- one customer may own or manage many properties;
- one property contains many rooms;
- one room contains many durable cleaning items;
- one cleaning item may appear in many booking and job events;
- one cleaning item accumulates many cleaning-history entries.

A booking item refers to a cleaning item. It does not own or replace that item.
This distinction enables a Digital Cleaning Passport across repeat visits.

## Planned domains

The following catalog records the intended model vocabulary. Columns,
constraints, identifiers, lifecycle states, retention, and deletion behavior
must be designed in the owning phase before migration.

### Identity

The initial application profile, role, permission, assignment and authentication
event tables are implemented in Phase 3A. Privileged role/status management,
invitations, organization membership and provider lifecycle reconciliation
remain planned; see `docs/IDENTITY_AND_ACCESS.md`.

### CRM

| Planned table | Responsibility |
| --- | --- |
| customers | Durable residential or business customer record |
| customer_contacts | Contact people and channels associated with a customer |
| customer_preferences | Consent, service, language, and communication preferences |

### Properties

| Planned table | Responsibility |
| --- | --- |
| properties | Service locations associated with customers |
| rooms | Durable spaces within a property |
| cleaning_items | Durable carpets, rugs, upholstery, mattresses, and other serviceable items |

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

| Planned table | Responsibility |
| --- | --- |
| bookings | Customer request and reserved service context |
| booking_items | Requested service scope linked to durable cleaning items |
| booking_time_slots | Candidate, held, or confirmed booking windows |
| booking_notes | Timestamped contextual notes without overwriting history |

### Operations

| Implemented or planned table | Responsibility |
| --- | --- |
| operations_teams | Implemented team-capacity reference without employee identity |
| team_capabilities | Implemented capability foundation |
| equipment_resources, team_equipment_assignments | Implemented lightweight capacity foundation; maintenance history remains planned |
| employees | Staff and technician employment profiles |
| jobs | Executable operational work created from accepted scope |
| job_assignments | Employee or team assignment history |
| job_status_history | Append-oriented job lifecycle events |

### Inspection

| Planned table | Responsibility |
| --- | --- |
| inspections | Inspection event and responsible technician |
| inspection_items | Cleaning items included in an inspection |
| surface_assessments | Material, condition, and treatment-risk findings |
| identified_stains | Stain observations and confidence |
| existing_damage | Pre-service damage and customer acknowledgement |

### Treatment

| Planned table | Responsibility |
| --- | --- |
| job_treatments | Treatment performed for a job item |
| products_used | Product, quantity, and treatment usage records |
| technician_notes | Timestamped operational notes |

### Media

| Planned table | Responsibility |
| --- | --- |
| attachments | Metadata and object-storage references |
| job_photos | Job-specific photo metadata and classification |

Binary data must not be stored in PostgreSQL. These tables will reference
objects held by a separate storage provider.

### Commercial

| Planned table | Responsibility |
| --- | --- |
| price_rules | Implemented versioned pricing inputs and applicability |
| price_books | Implemented version, segment, currency, VAT and lifecycle authority |
| duration_models, duration_rules | Implemented independent operational-estimate configuration |
| quotes | Proposed commercial scope and validity |
| quote_items | Itemized quoted work |
| discounts | Explicit discount definitions and approvals |
| payments | Payment intent and settlement records |
| invoices | Invoice identity, totals, status, and document reference |

### Customer experience

| Planned table | Responsibility |
| --- | --- |
| reviews | Customer feedback and publication state |
| claims | Complaint or damage-claim lifecycle |
| messages | Conversation records across supported channels |
| notifications | Delivery intent and outcome |

### Maintenance

| Planned table | Responsibility |
| --- | --- |
| cleaning_history | Completed cleaning events tied to durable items |
| care_recommendations | Item-specific aftercare guidance |
| reminders | Scheduled maintenance and follow-up prompts |

### Business control

| Planned table | Responsibility |
| --- | --- |
| equipment | Durable company equipment |
| equipment_maintenance | Inspection, service, and repair history |
| inventory | Consumable stock and movement basis |
| audit_logs | Security and critical business-operation audit records |
| activity_logs | Lower-risk operational activity stream |

## Future modeling rules

- Prefer explicit foreign keys and constraints over application-only
  assumptions.
- Separate mutable current state from append-oriented history when both are
  required.
- Preserve the quoted and performed facts needed for later explanation.
- Use explicit money currency and integer minor units or another reviewed exact
  numeric strategy; never floating-point amounts.
- Model scheduling with instants, service time zones, and unambiguous duration.
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
