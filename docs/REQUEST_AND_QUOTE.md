# Request and quote workflow

## Purpose and boundary

Phase 3D introduces the first persistent VAX customer transaction. It keeps four
records deliberately separate:

1. A **service request** records what a person asked VAX to assess.
2. An **estimate** records one version of a system calculation from the facts
   known at that time.
3. A **quote** records one staff-reviewed commercial offer, frozen as an issued
   version.
4. A future **booking** will record acceptance and an operational commitment.

This phase ends at authenticated access to an issued quote. It creates no
booking, acceptance, payment, invoice, work order, occupancy, reservation,
message, notification or document file.

## Request sources and identity

Requests have one of three sources:

- `PUBLIC_WEB` is an anonymous submission. It starts with no customer,
  application profile, property or asset authority. It never creates an Auth
  identity, application profile, role, customer or identity link.
- `CUSTOMER_PORTAL` is submitted by an authenticated application profile with
  `OWN_CUSTOMER_DATA_UPDATE` and an exact active link to the selected customer.
  The database operation rechecks the link and the selected
  customer-property-asset graph.
- `STAFF_CREATED` is entered for an existing CRM customer by an active profile
  with both `CUSTOMER_RECORDS_MANAGE` and `OPERATIONS_MANAGE`.

`requesting_profile_id` is provenance, not authorization. Contact email and
phone are never used to infer a customer link. Public acknowledgements return
only a random customer-safe request reference and never disclose whether the
contact details match an existing record.

## Original submission and normalization

The original validated submission is retained as an immutable snapshot. The
contact fields and customer notes on the request are also the submitted values;
staff normalization does not rewrite the snapshot. Authenticated creation also
records the exact originally selected property and cleaning asset inside this
private snapshot, so later resolution cannot erase the customer's source facts.

Structured request items are a separate interpretation. They may reference the
canonical service catalogue, cleaning item type, measurement mode, condition,
material, existing asset, issues and add-ons. Issue and add-on selections use
relational join tables instead of uncontrolled arrays. Staff can refine the
structured interpretation while retaining the original free text and the
optimistic request version. Customer-reported and staff-normalized condition,
fibre material and surface construction have distinct fields. Operational
calculation uses the normalized value when present and otherwise falls back to
the reported value without rewriting it.

Repeated normalization also preserves association provenance. A retained
staff-only issue or add-on remains selected, an omitted staff-only association
is removed, and an omitted customer-origin association remains present with
only its staff confirmation flag cleared. The mutation uses disjoint retained
and omitted sets so PostgreSQL never has to delete and update the same
association through sibling data-modifying CTEs.

The current public form supplies item-type codes plus aggregate free-text
quantity and area descriptions. VAX preserves those descriptions and does not
pretend they are exact per-item measurements. A staff member must normalize
the facts before running a meaningful estimate.

## CRM resolution

Anonymous requests begin `UNRESOLVED`. Staff may mark a request as a
`MATCH_CANDIDATE`, link it to an existing customer as `LINKED`, or mark it
`NEW_CUSTOMER_REQUIRED`. Matching contact details are a review signal only and
must never perform an automatic merge.

Linking requires both CRM and operations management authority and a current,
non-archived customer. Property and asset references must belong to that exact
customer graph. The dedicated new-customer resolution operation creates the
customer, primary contact and optional property and links the request in one
authorized transaction. The original submission remains unchanged and the
resulting CRM/request mutations are auditable.

## Request lifecycle

The controlled lifecycle is:

```text
SUBMITTED -> IN_REVIEW
IN_REVIEW -> NEEDS_REVIEW | READY_TO_QUOTE | DECLINED
NEEDS_REVIEW -> IN_REVIEW | READY_TO_QUOTE | DECLINED
READY_TO_QUOTE -> IN_REVIEW | QUOTED | DECLINED
QUOTED -> CLOSED
```

`CLOSED` and `DECLINED` are terminal in Phase 3D. `QUOTED` is reached only by
issuing a quote in the same transaction. Clients cannot submit an arbitrary
status. Mutable request changes require the expected optimistic version.

## Estimate semantics

An estimate is append-only history. Recalculation allocates the next
`estimate_version`; it never updates an earlier calculation. Each estimate
stores:

- the exact price-book identity and version;
- the exact duration-model identity and version;
- the normalized input snapshot;
- complete price and duration result snapshots, including rule identifiers,
  calculation lines, minimum-visit adjustment, VAT treatment, totals,
  component minutes, warnings and referral state;
- searchable integer EUR minor-unit totals and integer duration values;
- a controlled list of manual-review reasons.

Estimate creation locks and advances the request's optimistic version and
stores that resulting version as `source_request_version`. A draft quote can
select only a non-referral estimate for the request's current version. Further
normalization or estimation therefore makes an older draft fail closed as
stale rather than silently issuing against changed scope.

Customer segment and travel zone are commercial inputs but are owned by CRM
records whose versions advance independently of the request. Every estimate
append therefore locks the current active customer, property and canonical
travel zone and compares their effective segment/zone values with the exact
engine input being stored. Quote draft creation, draft update and issue repeat
that comparison against the selected estimate's immutable input snapshot. A
semantic CRM change fails closed until staff creates a fresh estimate; changing
away and back to the same effective values does not invalidate history merely
because an unrelated CRM version advanced. Missing, inactive, null,
`UNCLASSIFIED` or unsupported travel-zone context cannot reach quote issue.

The Phase 2A/2B development configurations are draft, provisional, inactive or
unpublished. Their output may support staff review but cannot become a firm
automatic public quote. Engine exceptions and incomplete measurements fail
closed to manual review rather than leaking internal details.

The public condition mapping used for staff normalization is explicit:

| Customer condition | Commercial band |
| --- | --- |
| `LIGHT_MAINTENANCE` | `NORMAL` |
| `NORMAL` | `NORMAL` |
| `NOTICEABLY_SOILED` | `ENHANCED` |
| `HEAVILY_SOILED` | `INTENSIVE` |
| `SPECIALIST_ASSESSMENT_REQUIRED` | `ASSESSMENT_REQUIRED` |

Specialist or unknown material, unsupported contamination, missing required
measurement, outside-Sofia travel, unknown/custom items, unavailable
capability, uncertain duration and manual commercial rules keep the request in
review. Internal cost or contribution data is not part of the customer quote.

## Availability preview

Availability remains staff-only advisory evidence. Each estimate stores the
service-area and scheduling-configuration readiness snapshot used for its
manual-review decision, but Phase 3D does not calculate or persist candidate
slots. It creates no occupancy, hold, reservation or booking. A review-required
or unavailable result must never be presented as a bookable slot.

## Quote lifecycle and versions

Quotes use random customer-safe references and integer EUR minor units. A quote
version belongs to one request and one estimate. `DRAFT` commercial fields may
be edited using an expected record version. The lifecycle is:

```text
DRAFT -> ISSUED -> SUPERSEDED | EXPIRED | WITHDRAWN
```

Issuing freezes the quote items, customer wording, terms, totals, validity and
estimate provenance. Issued commercial data is never edited in place. A
changed offer requires a new draft with the next quote version. Issuing a new
version supersedes the previous issued version atomically. A request-row lock,
optimistic checks, unique version keys and the single-active-issued invariant
prevent conflicting concurrent issues.

Safe replacement is explicit: normalize if needed, append a fresh estimate for
the current request version, create the latest quote draft from that estimate,
then issue it. The new issue and supersession of the earlier active quote occur
in one transaction.

Customer-visible quote items retain both machine references and frozen human
descriptions. Future print/PDF generation must render from these frozen values,
not from live catalogue or pricing labels.

## Terms and customer access

Phase 3D supports controlled quote wording for validity, assumptions,
manual-assessment, parking/travel, stain-removal limits, drying/reuse and
optional add-ons. These statements must not invent medical efficacy,
manufacturer approval or guaranteed outcomes. Every staff-authored
customer-visible quote line, note and assumption passes the shared canonical
claim boundary plus the stricter quote-specific control. Policy evaluation uses
NFKC, semantic percent normalization, default-ignorable removal and bounded
separator-tolerant semantic comparison views so spaces, punctuation, symbols,
combining marks, hyphens and invisible marks cannot disguise prohibited
wording without concatenating unrelated ordinary words; the reviewed original
text itself is neither rewritten nor normalized for display.

An authenticated customer may read only previously issued quote versions for
the exact customer reached through their current active identity link. Drafts,
staff notes, internal metrics, actor identifiers and unrelated database IDs are
excluded from the customer projection. Superseded, expired and withdrawn
versions remain readable history once issued. There is no anonymous secret-link
access and no acceptance control in this phase. Customer request details render
the immutable customer description; the staff-normalized interpretation does
not cross the customer projection.

Staff list/read operations require both `CUSTOMER_RECORDS_READ` and
`OPERATIONS_READ`; mutations require both manage permissions. These checks are
based on permissions, not role labels, and are repeated in database operations.
The current canonical mappings admit Owner, Admin and Dispatcher while keeping
Technician out of unrestricted CRM request and quote access.

## Business audit

`business_audit_events` is separate from the authentication security audit.
Significant request, estimate and quote events are appended in the same
transaction as the corresponding change. Normal application code has no update
or delete operation for these events. Metadata is allowlisted and excludes
contact details, free-form notes, secrets, provider subject identifiers and
tokens.

Database-level append-only grants and reviewed least-privilege runtime roles
remain a production-readiness gate; the application contract alone is not a
claim of immutable infrastructure.

## Privacy and retention

Request records can contain contact details, service descriptions, address
context and customer notes. They are personal/business data even when no Auth
account exists. Access is purpose-limited to authorized staff or the exact
linked customer record. Logs, URLs and audit metadata must not repeat these
values.

VAX has not yet approved retention periods, erasure/anonymization rules,
legal-hold behavior, data export, notification delivery or a full data-subject
request workflow. Historical financial/audit integrity and privacy rights need
a reviewed policy before production. This implementation does not claim GDPR
compliance.

## Deferred decisions

Before production or Phase 3E, the owner must review:

- activation and publication of price books and duration models;
- quote validity defaults and controlled terms;
- service-area, parking, travel and specialist referral policy;
- production RLS/least-privilege and append-only audit grants;
- shared abuse controls, monitoring, recovery and retention automation;
- custom SMTP and request/quote notification events;
- anonymous quote access token design, if ever required;
- the exact quote-acceptance evidence, expiry and concurrency contract;
- document/PDF rendering, storage and version retention.

Phase 3E must create a Booking only from an authorized, still-valid accepted
issued quote and copy its frozen commercial snapshot. It must not recalculate
today's price as the accepted contract.
