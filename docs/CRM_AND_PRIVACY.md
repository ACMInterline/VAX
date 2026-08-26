# Customer CRM and Privacy

## Scope through Phase 3H

Phase 3C introduced the first persistent VAX business records: customers,
contacts, identity-to-customer links, properties, property areas and physical
cleaning assets. At the Phase 3C gate it did not persist public requests or
quotes.

Phase 3D persists anonymous, linked-customer and staff-created service requests,
append-only estimates and versioned staff-reviewed quotes. Phase 3E adds the
immutable acceptance of an eligible issued quote, the resulting Booking and
copied booking items, a durable occupancy foundation and booking audit events.
New Bookings remain `PENDING_SCHEDULING` / `REVIEW_REQUIRED`; acceptance creates
no confirmed slot or occupancy. Phase 3F adds one Booking-derived Job,
assigned-team technician scope, professional inspection, confirmed and
performed treatment, completion evidence and append-only Cleaning Passport
history. Phase 3G adds explicit operational-requirements review, exact
appointments, append-oriented occupancy revisions, a staff daily dispatch
board, a row-scoped technician-today view and a safe linked-customer
appointment view. Phase 3H adds versioned customer-billing/seller policy,
accepted-commercial Invoices, manually recorded Payments, append-oriented
allocations/reversals and linked-customer Invoice views. File, message,
notification, payment-provider and refund records remain absent. The
commercial, Booking, execution, scheduling and finance contracts are defined in
`docs/REQUEST_AND_QUOTE.md`, `docs/BOOKING_ENGINE.md`,
`docs/JOB_EXECUTION.md`, `docs/SCHEDULING_AND_DISPATCH.md` and
`docs/FINANCE_AND_INVOICING.md`.

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
assets, requests, estimates, historical quotes, acceptances, Bookings, Jobs or
Cleaning Passport entries.

Staff access requires the existing CRM permissions. `OWNER`, `ADMIN` and
`DISPATCHER` may read and manage CRM records under the application policy.
`TECHNICIAN` receives no unrestricted CRM access. The Phase 3F technician
workspace uses a separate purpose-limited Job projection and an exact
time-valid membership in the Job's assigned team. It exposes only visit-
essential customer, property, contact, access, schedule and work facts and
never grants general CRM history access.

Phase 3G keeps administrative dispatch separate from technician access. Owner,
administrator and dispatcher scheduling requires schedule-management authority.
The technician today view continues to require exact active, time-valid team
membership and exposes only that team's visit-purpose fields. Assigning a team
resource to an occupancy never creates user membership, role or permission.

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

Finance access is narrower again. Owner/Admin staff finance reads and mutations
use dedicated finance permissions. Dispatcher and Technician receive none.
Linked customers use `OWN_CUSTOMER_DATA_READ` plus the current exact identity/
customer link and may see only their own issued/partially paid/paid Invoice
projection. Invoice references do not grant access. Customer responses exclude
draft/review/cancelled records, Payments, internal notes, staff audit and
commercial/provenance internals.

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
| Dispatch and capacity data | Team/equipment assignment, travel and buffer evidence, working-hour/policy versions, warnings and daily utilization | Confirm operational feasibility and coordinate authorized staff without exposing other customers or mutable commercial calculations |
| Job and inspection history | Assigned team, visit lifecycle, immutable planned scope, observed condition/material/construction/issues/risks and treatment feasibility | Execute the accepted scope safely while preserving reported, normalized and observed facts separately |
| Treatment and Cleaning Passport history | Confirmed plan, treatment actually performed, outcome, completion time, customer-safe summaries and evidence-scoped care recommendation | Explain completed asset service without exposing commercial calculations or internal technician notes |
| Billing and seller snapshots | Invoice-time customer billing identity/address, company/VAT identifier state and approved seller legal/payment-instruction facts | Preserve the financial document without depending on later CRM/configuration changes |
| Invoice and line history | Number, dates, status, frozen accepted lines, net/VAT/gross, paid/outstanding value and customer-visible note | Explain an issued financial claim and settlement without repricing historical work |
| Payment and allocation history | Manual receipt method/reference, confirmation, allocations, reversals and unapplied value | Reconcile recorded money to Invoices without processing funds or exposing staff-only evidence to customers |

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
history are not overwritten. Phase 3G rescheduling cancels the prior blocking
occupancy and appends a linked replacement; it does not replace historical
location, travel, working-hour, team or equipment evidence with current facts.
Jobs, inspections, treatment records and Cleaning Passport entries likewise
retain their controlled lifecycle and restrictive
source relationships; completed history is not rewritten when current asset or
CRM facts change. Normal closure uses controlled status and link revocation
rather than cascading deletion. Retention, anonymization and lawful deletion
must reconcile request contact data, address/schedule/visit history,
commercial evidence, operational history and audit integrity before production.

Approved customer billing/seller/policy versions and issued Invoice/items are
historical financial evidence, not mutable mirrors of current CRM. Revoking an
identity link removes future customer access but does not delete the retained
Invoice. Payment allocation/reversal and finance-audit history is append-
oriented; normal correction uses compensating facts rather than deletion.
Retention, erasure/anonymization and legal-hold policy must reconcile privacy
rights with accountant/legal requirements before production.

## Cleaning Passport foundation

Each `cleaning_assets.id` is a stable identity for one physical item. Phase 3C
stores customer-described current characteristics only. Phase 3F attaches
professional evidence to that asset through this provenance chain:

> Cleaning Asset → Job Item → Inspection/Assessment → Confirmed Treatment → Performed Treatment → Completed Job → Cleaning Passport

A Passport entry is created only for an asset-linked treatment that was
actually completed within the confirmed plan. Inspection-only, declined,
referred, review-required, unperformed and stopped-for-safety items create no
treatment history. Each entry references its exact Job item and execution
instead of copying mutable CRM notes into a false timeline. Customer-safe
completion and care text is separate from internal technician notes and audit
metadata. Optional maintenance timing is advisory, evidence-scoped and never a
universal manufacturer, health or legal claim.

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
Phase 3G extends that stream with allowlisted schedule, reschedule,
team/equipment assignment, review and occupancy-release events, also written
atomically with the owning change.
Phase 3F adds a separate Job event stream for controlled lifecycle, inspection,
treatment, completion and Passport creation. Eligible completion and Passport
insertion are atomic.

Phase 3H adds a separate finance event stream for Invoice readiness/issue/
cancellation, Payment recording/confirmation/allocation/reversal and settlement.
Its metadata excludes billing addresses, company/VAT identifiers, external
payment references, bank details and free-form notes. Allocations and reversals
are append-oriented, and issue/settlement facts are written atomically with the
owning state change.

Safe metadata excludes contact details, addresses, notes, provider subjects,
tokens and secrets, and ordinary application code has no update/delete
operation for these event streams or Passport entries.

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
  retention, including schedule revisions, dispatch audit and their relationship
  to retained Job history;
- inspection, internal technician note, treatment, completion, Cleaning
  Passport and maintenance-recommendation retention and amendment policy;
- customer billing/seller snapshots, issued Invoice/line, Payment, allocation,
  reversal and finance-audit retention, correction and lawful-access policy,
  reviewed with a qualified accountant/legal adviser;
- production least-privilege grants and reviewed row-level security;
- monitoring for unauthorized access and an incident/recovery procedure; and
- a separate authorized production migration and deployment review.

Direct browser database access remains prohibited. The enabled development
Data API is not an application integration, and no CRM, request/quote, Booking,
scheduling/dispatch, Job, Cleaning Passport or finance route receives a
database credential or provider token.
