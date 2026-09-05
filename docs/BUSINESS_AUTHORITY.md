# Business Authority

## Purpose and boundary

Phase 3N adds governance for the business facts and operating policies that
VAX needs before production can be considered. A saved value is not authority
by itself. An operational rule becomes eligible for an environment only after
its evidence, required approvers, version, effective window and environment
scope have all passed the controlled approval workflow.

This domain does not make a legal, accounting, tax, safety, medical,
manufacturer or regulatory determination. It does not invent values, approve
provisional Phase 2A/2B fixtures, configure a provider or authorize production.
The owner-facing production report is a decision aid, not a legal certificate.

Phase 3N does **not** authorize a production database migration, application
deployment, Auth or SMTP change, DNS change, first production owner, invoice
numbering, payment/fiscal integration or customer communication. Those remain
separate, explicit change approvals.

## Authority chain

Every governed value follows this chain:

```text
raw assumption or owner input
  -> reviewed proposal
  -> required authority decisions
  -> versioned environment-scoped record
  -> effective date
  -> staging activation and verification
  -> production authorization package
```

For each record the system retains:

- a stable authority key and category;
- a positive version and immutable governed payload;
- evidence class, safe evidence summary and source reference;
- required conceptual authority types;
- proposer and approving application-profile references where applicable;
- proposal, review, approval, rejection and supersession audit events;
- an exact `DEVELOPMENT`, `STAGING` or `PRODUCTION` scope;
- effective-from and optional effective-until timestamps; and
- the superseding record relationship.

Sensitive evidence, credentials, personal data, provider responses, bank
details and unrestricted legal/accounting material do not belong in safe
summaries, audit metadata or customer-visible output. A source reference must
identify controlled evidence without copying the sensitive evidence itself.

## Evidence classes

| Evidence class               | Meaning                                                                                                  | What it cannot establish alone                                     |
| ---------------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `OWNER_INPUT`                | An explicit business choice attributable to the owner                                                    | External legal, accounting, provider or technical truth            |
| `SYSTEM_VERIFIED`            | A result produced by a controlled technical verification against the exact target/snapshot               | Business acceptance, legal compliance or an owner decision         |
| `EXTERNAL_EVIDENCE_REQUIRED` | A fact or policy that needs a controlled external source and the named professional/business authorities | Approval merely because a row exists or a user selected a checkbox |

`SYSTEM_VERIFIED` is not a user-selectable shortcut. Only the controlled
technical path may create that evidence class. An owner cannot self-assert
“compliant with Bulgarian law”; the system instead records specific business
facts, the qualified review still required and the evidence reference.

Operational review groups the resulting evidence and blockers as follows. These
labels explain the package; they do not replace the stored lifecycle or matrix
status codes:

| Review classification    | Meaning                                                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| **SYSTEM VERIFIED**      | A controlled check passed against the exact environment, target and release snapshot                                          |
| **OWNER INPUT REQUIRED** | A genuine commercial or operating choice has not been supplied and approved by the Owner                                      |
| **ACCOUNTANT-LEGAL**     | Qualified Accountant and/or Legal evidence is still required; Owner input cannot substitute for it                            |
| **PROVIDER LIMITATION**  | A provider capability or contract prevents the required control from being verified or needs an explicit governed disposition |
| **NOT AUTHORIZED**       | The production mutation, deployment or real-world operation remains outside the authority granted for Phase 3N                |

An empty authority registry is a valid governance result: it proves that VAX did
not fabricate a real decision. It also means every dependent activation remains
blocked. Zero real authority is never interpreted as readiness.

## Conceptual authorities

The model uses conceptual authorities, never invented people:

- `OWNER` — commercial ownership and final business authorization;
- `ACCOUNTANT` — accounting, VAT, numbering, payment and fiscal review;
- `LEGAL` — legal wording, privacy, retention and contractual review;
- `OPERATIONS` — service feasibility, field process and capacity;
- `TECHNICAL` — system, provider, database, domain and recovery evidence; and
- `CONTENT_CLAIMS` — publication and claims evidence review.

Approvals refer to active application profiles. Role navigation is not
authorization. The server and database boundary must recheck the actor,
permission, record version, environment, current status and required authority
type on every transition. High-risk seller/tax, pricing, legal/privacy and
production decisions remain owner-controlled. An Admin role does not acquire
blanket approval power.

Runtime proposal and transition batches additionally install a fresh,
transaction-local signed actor context. Its domain-separated HMAC payload binds
the application profile, the authenticated provider subject, the primary and
optional supersession correlation IDs, and a bounded issue time. Database
triggers verify the signature against the protected derived key, match the
profile to the provider subject and repeat the active Owner/permission check.
Missing, expired, future-skewed, mismatched or forged context fails closed. The
browser cannot supply this context and a pooled connection cannot safely reuse
it because every setting is transaction-local.

The signing key is purpose-derived from both `NEON_AUTH_COOKIE_SECRET` and the
explicit validated `VAX_ENVIRONMENT`; the root secret is never stored in the
database. Missing or invalid environment selection blocks signing. Even if an
operator mistakenly supplied the same root secret to two environments, their
derived keys and signatures would differ, so a staging context cannot authorize
a production mutation. The derived key is provisioned in
protected `system_metadata` only by the migrator path and is unavailable to the
runtime role. Absence or mismatch deliberately blocks Business Authority
mutation. Cookie-secret rotation therefore requires a separately authorized
maintenance/change window: stop these mutations, rotate the secret, update the
database derived key through the guarded migrator operation, restart/drain all
application instances, verify new signed writes and old-signature rejection,
then reopen mutations. Phase 3N does not claim that coordinated production
rotation has been approved or rehearsed. Future rotation/versioning must retain
the derivation-domain version, target environment and activation time in the
change record; Phase 3N implements only the current `v1` derivation.

The structure can retain distinct approvals from more than one authority. It
does not claim a two-person production policy until such a policy is expressly
approved.

## Status and transition model

| Status                    | Meaning                                                                                                                                             |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PROPOSED`                | A validated candidate exists but has no activation authority                                                                                        |
| `UNDER_REVIEW`            | The immutable candidate is awaiting all required authority decisions                                                                                |
| `APPROVED_FOR_STAGING`    | All required approvals permit the exact version in staging only                                                                                     |
| `APPROVED_FOR_PRODUCTION` | All required approvals permit the exact production-scoped version, subject to every other readiness dependency and a separate release authorization |
| `SUPERSEDED`              | A later approved version replaced the record; it remains historical                                                                                 |
| `REJECTED`                | Review declined the candidate; it cannot be activated                                                                                               |

The normal path is `PROPOSED -> UNDER_REVIEW -> APPROVED_FOR_STAGING` or
`APPROVED_FOR_PRODUCTION`. Review may instead end in `REJECTED`. Approval of a
new version supersedes the prior approved version for the same key and
environment without overwriting it. Terminal history is not reopened or
silently edited.

No development approval status exists. Development may contain clearly
provisional fixtures, but those fixtures are never presented as approved
authority. A staging approval is not a production approval, and copying its
payload does not copy its approval.

## Version and effective-time rules

- A changed value creates `v2`, `v3` and so on; it never edits `v1` in place.
- Approval applies to one exact record version and one exact environment.
- A future-effective version is not current before its effective timestamp.
- An expired, rejected, superseded or malformed record is never current.
- An open-ended version remains current only while no later approved version
  supersedes it.
- Approval timestamps and effective timestamps are server/database owned.
- Conflicting current versions fail closed to review; callers do not choose the
  most convenient value.
- A `CONFIG_REFERENCE` identifies one immutable subject by exact
  `subjectType`, `subjectCode`, positive `subjectVersion` and SHA-256 content
  digest (`contentSha256`). Readiness requires a trusted server-side resolver
  to return the same four fields for the same environment, with an active or
  approved, effective, non-provisional result and no unresolved manual review.
  An absent resolver, absent result or any field mismatch fails closed. The
  Phase 3N PostgreSQL repository intentionally supplies no universal resolver.
  ATTELIER finalization adds only one reviewed, code-owned, staging-only
  allowlist resolver for exact immutable ATTELIER subjects. It returns nothing
  in development or production and cannot resolve arbitrary database rows.
  Every non-allowlisted, pending or mismatched dependency remains blocked.

## ATTELIER staging authority

The finalization plan records 29 prospective `STAGING` versions through the
ordinary service and database transition controls. Sixteen exact/direct facts
can complete staging approval; thirteen stay under review because Phase 3N
requires Accountant, Legal, actual operational/product, provider/session or
recovery evidence that has not been supplied. No record is approved for
production.

The exact resolver binds a fixed resolver ID/version, subject type, subject
code, positive version, canonical SHA-256 content digest, `STAGING` scope and
effective instant. The activation command refuses divergent current content,
an ambiguous Owner, a non-staging database/Auth target or any production-scoped
state. See `docs/ATTELIER_FINALIZATION.md` for the complete approved/pending
split and lifecycle boundary.

Policy sets are semantically closed contracts, not free-form collections. They
must contain every required code exactly once and no additional code. Entries
without a governed numeric meaning must keep both `numericValue` and `unit`
null. The numeric contracts are:

| Authority / entry                      | Unit      | Accepted value                       |
| -------------------------------------- | --------- | ------------------------------------ |
| `QUOTE_BOOKING_TERMS.QUOTE_VALIDITY`   | `DAYS`    | integer from 1 through 1,000,000,000 |
| `AUTH_SESSION_POLICY.MAXIMUM_LIFETIME` | `MINUTES` | integer from 1 through 1,000,000,000 |
| `RECOVERY_OBJECTIVES.RPO`              | `MINUTES` | integer from 1 through 1,000,000,000 |
| `RECOVERY_OBJECTIVES.RTO`              | `MINUTES` | integer from 1 through 1,000,000,000 |
| `RECOVERY_OBJECTIVES.BACKUP_FREQUENCY` | `MINUTES` | integer from 1 through 1,000,000,000 |
| `RECOVERY_OBJECTIVES.BACKUP_RETENTION` | `DAYS`    | integer from 1 through 1,000,000,000 |
| `PAYMENT_TERMS.DUE_DAYS`               | `DAYS`    | integer from 0 through 1,000,000,000 |

These constraints define representation and safety only. They do not choose an
actual duration, retention period or payment term for the business.

Readiness is derived from valid, currently effective records and their approval
evidence. There is no editable `production_ready=true` field. A final
production `GO` is not reusable release authority: its `releaseCommitSha`,
`targetReference`, `changeWindowStart`, `changeWindowEnd` and
`dependencyFingerprint` must match the exact evaluated release snapshot. The
evaluator recomputes the fingerprint from the complete set of selected current
production dependencies, so any dependency change invalidates the prior GO.

## Governed authority registry

The registry groups production dependencies into the following 17 readiness
categories. The authorities shown are conceptual requirements; they are not a
claim that any real person has approved the item.

| Category                 | Governed records                                                                                                                                                                   | Required authority                                                                       |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Brand/content            | Brand identity; verified business contact details; public claims inventory                                                                                                         | Owner; Content/Claims and external evidence for claims                                   |
| Service scope            | Offered/assessment/refer/decline services; supported item taxonomy; specialist materials; treatment/product policy; drying/reuse guidance; Job policy; Passport/maintenance policy | Owner and Operations; Technical or Content/Claims and external evidence where applicable |
| Pricing                  | Residential price book; B2B price book; timing surcharges                                                                                                                          | Owner and Accountant                                                                     |
| VAT/tax                  | Actual VAT/tax status and effective date                                                                                                                                           | Owner and Accountant with external evidence                                              |
| Seller/legal             | Approved seller legal-profile version                                                                                                                                              | Owner, Accountant and Legal with external evidence                                       |
| Scheduling               | Duration model; working hours; appointment windows; availability/confirmation; quote and Booking terms                                                                             | Owner and Operations; Legal for customer terms                                           |
| Travel                   | Sofia service-zone boundaries; travel, parking and routing policy                                                                                                                  | Owner and Operations; Technical/external evidence for boundaries                         |
| Teams/equipment          | Team capacity; equipment inventory and assignments                                                                                                                                 | Owner and Operations; Technical where required                                           |
| Auth                     | Provider risk acceptance; session and emergency-recovery policy                                                                                                                    | Owner and Technical                                                                      |
| Privacy/retention        | Category-specific retention, erasure exceptions and marketing-consent boundary                                                                                                     | Owner and Legal with external evidence                                                   |
| Email                    | Production SMTP/provider and sender identity                                                                                                                                       | Owner and Technical with provider/DNS evidence                                           |
| Monitoring               | Alert ownership, response hours, severity and escalation                                                                                                                           | Owner, Operations and Technical                                                          |
| Backup/recovery          | RPO/RTO objectives, backup retention and restore authority                                                                                                                         | Owner and Technical                                                                      |
| Finance/fiscal           | Invoice numbering; payment terms; finance/fiscal policy                                                                                                                            | Owner and Accountant; Legal where required                                               |
| Database                 | Exact production bootstrap/security verification                                                                                                                                   | Controlled system verification by Technical authority                                    |
| Domain/TLS               | Public/app/Auth/canonical origins and TLS                                                                                                                                          | Owner and Technical with external evidence                                               |
| Deployment authorization | Final explicit production GO/NO-GO bound to the exact release commit, target, active change window and dependency fingerprint                                                      | Owner, with a separate authorized release operation                                      |

## Commercial and tax authority

### Pricing

The Phase 2A residential and B2B books, minimum visit charge, item/band rates,
condition modifiers, add-ons, timing adjustments, VAT percentage and rounding
behavior remain provisional until explicitly governed. Production price-book
authority requires:

- a reference to one exact immutable configuration version;
- owner commercial approval;
- Accountant approval for tax/accounting implications;
- an effective date and production scope; and
- no unresolved manual-review or publication flag.

No proposal may invent a price, multiplier, minimum, B2B term, penalty,
interest, late fee or commercial validity period. Timing surcharges remain
inactive until separately approved. A later price version affects only new
evaluations after its effective time; it cannot reprice accepted work.

### VAT and seller identity

VAT status is a governed decision of `VAT_REGISTERED`,
`NOT_VAT_REGISTERED` or `REVIEW_REQUIRED`, with effective dates and external
evidence. A percentage in a development price book is not proof of VAT status.

Production seller authority references one approved, environment-matched legal
profile containing the verified legal name, registration details, VAT details
where applicable, registered/billing address, contact and any explicitly
approved customer-visible payment instructions. Missing or contradictory facts
block invoice issue; VAX does not infer or repair them.

### Invoice numbering and payment terms

Numbering authority governs the production prefix, start value, sequence
policy, document types, environment and effective date. Development/staging
numbers remain visibly non-production. A production sequence cannot activate
without Owner and Accountant approval.

Payment authority governs pay-on-completion, due-day, prepayment/deposit and
business-term decisions. Legal or accounting meaning is not inferred from an
enum. Penalties, interest, cancellation charges, refund semantics, fiscal
devices, live payments and accounting integrations remain absent unless a
later separately authorized policy and implementation establish them.

## Operational authority

### Services, items, materials, treatments and products

Each service and item is governed as offered, assessment-only,
decline/refer, staging-only or production-ready. Delicate materials and
contamination use explicit `SUPPORTED`, `ASSESSMENT_REQUIRED`, `REFER` or
`DECLINE` decisions. Unsupported categories do not appear confidently
bookable.

Treatment levels require operational evidence for both customer wording and
technician use. Actual product records require verified manufacturer, product
name, intended use, dilution, safety evidence, future SDS reference, approval
status and production eligibility. Phase 3N creates no manufacturer or product
facts merely to satisfy readiness.

Drying/reuse guidance uses evidenced ranges and conditional wording. Claims
such as instantly dry, antibacterial, allergen removal, effectiveness, machine
noise, origin, material safety or sustainability remain withheld without
specific evidence and Content/Claims approval.

The protected claims inventory distinguishes each customer claim as
`PUBLISHED`, `WITHHELD` or `PROPOSED`. Only an evidence-backed, approved claim
may be `PUBLISHED`; the other states must not be converted into public wording.

### Duration calibration

Duration proposals distinguish the current provisional estimate from observed
sample count, observed distribution, approved planning duration and buffer.
Field observations may record planned and actual minutes, item/service,
condition, measurement, team size, date and safe notes. An observation is
evidence for review, not an automatic production update. Empty datasets remain
empty; sample counts, medians and percentiles are never fabricated.

### Teams, equipment, hours and appointment windows

Production capacity requires approved active teams, crew size, operating days,
skills, daily capacity and actual equipment resources/capabilities/maintenance
state. Development `TEAM_A`, `TEAM_B` and neutral machine fixtures do not prove
real resources and must not acquire production approval by reuse.

The provisional `06:00–22:00` window is an operating fixture, not a statement
about Bulgarian noise law. Owner/Operations approval governs the business
choice; any legal conclusion needs its own external evidence. Customer-facing
appointment labels map to exact approved scheduling windows and do not promise
an exact arrival unless the approved policy says so.

### Sofia zones, travel and parking

Production service-area boundaries require verified districts, postcodes,
polygons or measurable distance/travel-time bands. The existing zone labels
and deterministic matrix remain development/staging assumptions unless
approved. A provider-neutral routing decision records one of:

- `DETERMINISTIC_MATRIX_ACCEPTED`;
- `LIVE_ROUTING_REQUIRED`; or
- `MANUAL_REVIEW`.

Phase 3N neither purchases nor integrates a routing service. Included area,
outside-area review, surcharges, parking handling, travel buffers and maximum
distance/time require explicit owner authority. No fee or geographic boundary
is inferred.

### Availability, quoting, Booking and field policy

Instant availability needs approved team, equipment, working-hour, travel,
buffer and duration dependencies. Each service/item must eventually decide
whether instant Quote or Booking is permitted. The Phase 3N registry currently
stores only a global availability policy, so its only readiness-eligible values
are `ASSESSMENT_REQUIRED` and `STAFF_CONFIRMATION_REQUIRED`. Global
`INSTANT_QUOTE_ALLOWED` and `INSTANT_BOOKING_ALLOWED` values fail closed until a
separately reviewed per-service/item authority model exists. No global approval
may silently grant instant behavior to every service.

Quote validity, Booking, cancellation and rescheduling rules need explicit
Owner authority and Legal review where applicable. Job policy governs arrival,
inspection, safety stop, refer/decline, scope change, completion and customer
handover. Existing-damage wording is an operating/customer process, not a
fabricated legal waiver.

Passport and maintenance policy governs customer visibility, condition-based
recommendations, next-service guidance and retention. It does not publish a
universal frequency or medical/hygiene promise without evidence.

## Privacy, communications and operational resilience

Retention is governed separately for Auth/security logs, CRM, anonymous
requests, quotes, Bookings, Jobs, Passports, finance and communications/
documents. Every required category needs an approved integer period from 1
through 36,500 days. An erasure exception of `LEGAL_REVIEW_REQUIRED` is
explicitly unresolved and blocks readiness even if the surrounding rule is
marked approved; only a resolved `NONE` or `RETAIN_REQUIRED` outcome can
proceed. No retention proposal activates automatic deletion. Marketing consent
remains separate from operational communication and Phase 3N does not enable
campaigns.

Monitoring authority identifies real recipients, coverage hours, severities
and escalation. The allowed maturity descriptions are `BASIC`,
`BUSINESS_HOURS` and `24_7_FUTURE`; no option fabricates a staffed 24/7 service.
The current GitHub issue receiver is staging evidence, not production on-call
coverage.

Recovery authority governs proposed RPO/RTO objectives, backup/export
frequency and retention, offsite ownership and who may authorize restore. The
current proposals are not SLAs. Provider history, Beta snapshots, branch
recovery and the portable staging restore are evidence inputs, not automatic
approval of a production recovery policy.

## Provider limitation decisions

### Neon Auth

The installed managed Better Auth path has demonstrated signup, verification,
login/logout, reset and protected-session behavior in hosted staging. It is
still identified as Beta, and the available integration cannot reliably prove
complete session inventory/revoke-all, provider-attested recent authentication
or the complete suspended-account session contract.

The Owner and Technical authorities must explicitly decide:

- `ACCEPT_FOR_INITIAL_PRODUCTION`;
- `REQUIRE_ALTERNATIVE_PROVIDER`; or
- `BLOCK_PRODUCTION`.

The decision must state the known limitation, operational impact, mitigation
and evidence. Phase 3N does not choose the outcome, change Auth configuration
or add a provider.

The separate Auth session policy must address maximum lifetime, ordinary
logout, suspended users, suspected account compromise and emergency recovery.
Where provider inventory or revocation support is unavailable, the policy must
remain explicit about that limitation rather than claiming a capability.

### Pooled database credentials

The staging rotation rehearsal proved that fresh use of superseded credentials
fails. It did not prove invalidation of an already authenticated Neon pooled
frontend: after backend termination, the frontend could acquire another
backend. The available tooling exposes no approved endpoint restart/drain or
pooler-frontend revocation operation.

This limitation must remain visible in the production package until a
provider-supported invalidation procedure is documented and rehearsed against
staging. A business approval cannot relabel a failed technical verification as
`SYSTEM_VERIFIED` or make the rotation command report success.

## Historical snapshot boundary

Business authority governs future eligibility. It never rewrites historical
commercial or customer documents:

- an issued Quote keeps its frozen calculation, duration and provenance;
- Quote acceptance and Booking keep the exact issued-Quote snapshot;
- scheduling and Job records keep their frozen operational versions;
- an issued Invoice keeps its customer, seller, VAT, numbering, terms, lines
  and totals; and
- generated customer documents keep the snapshots from which they were
  rendered.

Changing price, VAT, seller, duration, wording or service policy creates a new
authority/configuration version for future work. If the current CRM, request,
estimate, Quote, Booking, Job or finance graph cannot be reconciled with its
frozen provenance, VAX fails closed to staff review. It never renormalizes,
reprices, refreshes or repairs historical data automatically.

The retained Phase 3M synthetic request/Quote/Booking chain remains controlled
acceptance evidence. It may be preserved or replaced only through an explicit
staging-fixture decision; immutable records must not be casually edited.
Provider sessions are never changed by writing provider tables directly. If
supported session cleanup is unavailable, the recorded eight active synthetic
staging sessions remain controlled staging artifacts. That count is inherited
from the Phase 3M acceptance evidence: the installed provider integration
cannot independently enumerate all sessions or perform a verified revoke-all,
so Phase 3N does not present it as a fresh provider attestation.

## Readiness derivation

The production evaluator checks every production-required registry entry and
returns the approved items, pending items and exact blocker codes. It rejects:

- missing required approvals or actor authority;
- a staging record offered as production authority;
- future-effective, expired, rejected or superseded versions;
- malformed or unsupported value kinds;
- contradictory current versions;
- missing external evidence where required; and
- a deployment GO whose dependencies are not all satisfied.

The evaluator reports the controlled matrix statuses `PASS`,
`OWNER_APPROVAL_REQUIRED`, `ACCOUNTANT_APPROVAL_REQUIRED`,
`LEGAL_REVIEW_REQUIRED`, `PROVIDER_LIMITATION`, `TECHNICAL_BLOCKER` and
`NOT_AUTHORIZED`. Its report supports review; only protected server/database
transitions create authority.

Hosted staging and production must set a nonblank, valid `VAX_ENVIRONMENT`
explicitly. `NODE_ENV=production` identifies a build/runtime mode only and can
never select or activate VAX production authority. Missing, blank, unknown or
unsafe hosted environment configuration fails closed.

## Staging activation rule

Only a valid `APPROVED_FOR_STAGING` record may activate the exact staging value
after its effective time. Where no genuine value or approval exists, staging
stays fail closed. Isolated synthetic authority fixtures may test lifecycle and
readiness logic, but they are never production-approved and are removed or
clearly retained as controlled evidence.

Rehearsal proceeds only as far as genuine staging authority permits. Request,
estimate, Quote, acceptance and Booking evidence may remain intact while
scheduling, Job, Passport, Invoice, document or communication steps remain
blocked. Phase 3N does not fabricate authority to make a workflow appear
complete.
