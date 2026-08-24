# Customer CRM and Privacy

## Phase 3C scope

Phase 3C introduces the first persistent VAX business records: customers,
contacts, identity-to-customer links, properties, property areas and physical
cleaning assets. It does not persist public requests, quotes, bookings, jobs,
payments, invoices, files, messages, notifications or completed cleaning
history.

The model serves one VAX cleaning business. It is not a general multi-tenant
platform and does not claim that future organization, retention or data-subject
requirements are solved.

## Separate identities and ownership

Three identifiers remain deliberately distinct:

1. Neon Auth owns the provider identity, credentials, verification and
   sessions.
2. `user_profiles` owns the application's profile, status, roles and
   permissions.
3. `customers` owns the residential or business CRM record.

An active `customer_identity_links` row is the only Phase 3C relationship that
can grant a signed-in customer profile access to a CRM customer. Matching an
email address never creates or proves that relationship. Removing or revoking a
link does not delete the customer, contacts, properties or assets.

Staff access requires the existing CRM permissions. `OWNER`, `ADMIN` and
`DISPATCHER` may read and manage CRM records under the application policy.
`TECHNICIAN` receives no unrestricted CRM access. A later technician workspace
must expose only the minimum property/job facts needed for an assigned job.

The customer self-service surface is read-only in this phase. It always derives
linked customers from the authenticated application profile and never accepts a
client-selected ownership scope. An unlinked customer receives a safe empty
state. Missing and unauthorized record identifiers are not distinguished to
the caller.

## Data categories and purpose

| Category | Examples | Current purpose |
| --- | --- | --- |
| Customer identity | Display and legal names, individual/business type, locale | Identify the contracting or service relationship |
| Contact data | Contact name, email, phone, role/title, preference | Coordinate future service and maintain the CRM relationship |
| Property data | Label, address, coordinates, access and parking notes | Identify and prepare for a service location |
| Cleaning asset data | Item type, room/area, measurements, material, construction, condition, issues and risks | Describe a physical item for future assessment and repeat service |
| Internal operational data | Customer summaries, access notes and operational notes | Help authorized staff administer the relationship and prepare work |
| Authorization metadata | Application-profile link, relationship, actor and timestamps | Prove explicit record ownership and administrative provenance |

Full addresses and coordinates are sensitive operational data. They are shown
only to staff with CRM access or to application profiles explicitly linked to
the owning customer. Customer-facing projections omit internal customer
summaries, access/parking notes, asset operational notes, link-administration
metadata and staff actor identifiers.

Internal notes are for concise operational context only. Passwords, tokens,
payment details, identity documents, health information and other secrets must
never be placed in free-text notes. Customer-visible notes, if needed, require a
separate reviewed field and policy.

## Lifecycle, archive and deletion

Customers, properties and cleaning assets use `ACTIVE`, `INACTIVE` and
`ARCHIVED` states. Contacts and property areas have an active state. Ordinary
deactivation or relationship closure uses these states rather than hard
deletion. Phase 3C exposes archive actions, not delete actions.

Ownership and canonical-reference foreign keys use restrictive deletion
semantics. Removing an identity link cannot cascade into business data, and a
customer cannot be deleted while contacts, links or properties reference it.
Actor metadata alone may be set to null if an application profile is removed,
preserving the business record without retaining an unusable actor reference.

Archiving a parent does not fabricate a cascade of child changes. Services
validate parent state before new child records are added; retained children
remain available for authorized historical review. Exact restoration,
customer-merge and property-move workflows remain future decisions.

## Cleaning Passport foundation

Each `cleaning_assets.id` is a stable identity for one physical item. Phase 3C
stores customer-described current characteristics only; it does not fabricate a
professional inspection or treatment event. Future evidence will attach to the
asset through this provenance chain:

> Cleaning Asset → Inspection/Assessment → Job Treatment → Completed Job → Maintenance Recommendation

Future append-only history must reference its source inspection or completed
job instead of copying mutable CRM notes into a false timeline.

## Validation, concurrency and audit foundation

Server boundaries allowlist fields with Zod and reauthorize the current actor
and complete customer/property/area/asset relationship. Foreign keys are not
accepted as proof of access. Updates use a submitted version and an
authoritative database comparison so a stale form cannot silently overwrite a
newer change.

Mutable business records retain creation/update timestamps and application
actor metadata. Link rows retain creation and revocation provenance. These
fields are not a complete business audit log. A later append-only business
audit model must cover sensitive reads, exports, merges, retention actions and
material changes without reusing the security-specific `auth_audit_events`
vocabulary.

## Retention and data-subject work still required

VAX does not claim GDPR compliance from this document or schema. Before a
production CRM deployment, the owner must approve and test:

- lawful bases, notices and purpose limits for each data category;
- retention periods for active, inactive and archived relationships;
- access, correction, portability/export, restriction and objection handling;
- deletion/anonymization rules where legal or operational retention applies;
- duplicate detection, customer merge and shared-household/company authority;
- backup/PITR retention and deletion propagation;
- audit-log retention and access controls;
- production least-privilege grants and reviewed row-level security;
- monitoring for unauthorized access and an incident/recovery procedure; and
- a separate authorized production migration and deployment review.

Direct browser database access remains prohibited. The enabled development
Data API is not an application integration, and no Phase 3C route receives a
database credential or provider token.
