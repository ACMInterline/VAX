# Customer CRM and Privacy

## Scope through Phase 3E

Phase 3C introduced the first persistent VAX business records: customers,
contacts, identity-to-customer links, properties, property areas and physical
cleaning assets. At the Phase 3C gate it did not persist public requests or
quotes.

Phase 3D persists anonymous, linked-customer and staff-created service requests,
append-only estimates and versioned staff-reviewed quotes. Phase 3E adds the
immutable acceptance of an eligible issued quote, the resulting Booking and
copied booking items, a durable occupancy foundation and booking audit events.
New Bookings remain `PENDING_SCHEDULING` / `REVIEW_REQUIRED`; acceptance creates
no confirmed slot or occupancy. Job execution, payment, invoice, file, message,
notification and completed cleaning history remain absent. The commercial and
booking contracts are defined in `docs/REQUEST_AND_QUOTE.md` and
`docs/BOOKING_ENGINE.md`.

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

An active `customer_identity_links` row is the only application-owned
relationship that can grant a signed-in customer profile access to a CRM
customer. Matching an email address never creates or proves that relationship.
Removing or revoking a link does not delete the customer, contacts, properties,
assets, requests, estimates, historical quotes, acceptances or Bookings.

Staff access requires the existing CRM permissions. `OWNER`, `ADMIN` and
`DISPATCHER` may read and manage CRM records under the application policy.
`TECHNICIAN` receives no unrestricted CRM access. A later technician workspace
must expose only the minimum property/job facts needed for an assigned job.

Request and quote access is deliberately narrower than CRM access alone. Staff
reads require both `CUSTOMER_RECORDS_READ` and `OPERATIONS_READ`; mutations
require both corresponding manage permissions. No role label, route visibility
or submitted customer identifier substitutes for those conjunctions.

The Phase 3C CRM surface remains read-only. Phase 3D additionally permits an
authenticated customer with `OWN_CUSTOMER_DATA_UPDATE` to submit a request for
an exact actively linked customer and validated customer/property/asset graph.
Own-request and issued-quote reads require `OWN_CUSTOMER_DATA_READ` and the same
current link. The server derives linked customers from the authenticated
application profile and never accepts a client-selected ownership scope. An
unlinked customer receives a safe empty state. Missing and unauthorized record
identifiers are not distinguished to the caller.

## Data categories and purpose

| Category | Examples | Current purpose |
| --- | --- | --- |
| Customer identity | Display and legal names, individual/business type, locale | Identify the contracting or service relationship |
| Contact data | Contact name, email, phone, role/title, preference | Coordinate future service and maintain the CRM relationship |
| Property data | Label, address, coordinates, access and parking notes | Identify and prepare for a service location |
| Cleaning asset data | Item type, room/area, measurements, material, construction, condition, issues and risks | Describe a physical item for future assessment and repeat service |
| Internal operational data | Customer summaries, access notes and operational notes | Help authorized staff administer the relationship and prepare work |
| Authorization metadata | Application-profile link, relationship, actor and timestamps | Prove explicit record ownership and administrative provenance |
| Request intake | Submitted contact details, service descriptions, preferred timing and original free text | Preserve what was requested for staff assessment without inferring identity |
| Commercial history | Normalized scope, estimate snapshots, quote lines, terms, validity and status | Explain and present a reviewed offer without recalculating historical facts |
| Booking and appointment history | Acceptance evidence, copied commercial/item snapshots, preferred or confirmed timing, service address, cancellation and occupancy history | Preserve the operational commitment and explain scheduling decisions without rewriting the quote |

Full addresses and coordinates are sensitive operational data. They are shown
only to staff with CRM access or to application profiles explicitly linked to
the owning customer. Customer-facing projections omit internal customer
summaries, access/parking notes, asset operational notes, link-administration
metadata, staff notes, draft quotes, estimate internals and staff actor
identifiers. An issued quote is visible only through the exact actively linked
customer and never through an anonymous secret link.

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

Requests, issued quotes, acceptances and Bookings retain their own controlled
lifecycle rather than following CRM archive state automatically. Estimates,
issued commercial evidence, copied booking items and cancelled occupancy
history are not overwritten. Normal closure uses controlled status and link
revocation rather than cascading deletion. Retention, anonymization and lawful
deletion must reconcile request contact data, address/schedule history and
commercial/audit integrity before production.

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
actor metadata. Link rows retain creation and revocation provenance. Phase 3D
adds separate `business_audit_events` for allowlisted request, estimate and
quote changes. Phase 3E adds a separate Booking event stream for acceptance,
Booking creation and cancellation, written atomically with its owning change.
Safe metadata excludes contact details, addresses, notes, provider subjects,
tokens and secrets, and ordinary application code has no update/delete
operation for either stream.

This is not a complete business audit system. Sensitive reads, exports, merges,
retention actions and later domains still require reviewed coverage without
reusing the security-specific `auth_audit_events` vocabulary. Database-level
append-only grants remain a production least-privilege gate.

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
- anonymous-request abuse, duplicate and contact-data retention policy;
- issued-quote and immutable acceptance retention;
- acceptance, Booking, appointment-address, occupancy and cancellation
  retention, including the relationship to future Job history;
- production least-privilege grants and reviewed row-level security;
- monitoring for unauthorized access and an incident/recovery procedure; and
- a separate authorized production migration and deployment review.

Direct browser database access remains prohibited. The enabled development
Data API is not an application integration, and no CRM, request/quote or
Booking route receives a database credential or provider token.
