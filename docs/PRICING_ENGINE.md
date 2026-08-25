# Pricing, Duration and Commercial Rules

## Purpose and boundary

Phase 2A provides the versioned calculation foundation. Phase 3D now uses that
foundation to persist staff-only estimate versions and staff-reviewed quote
versions. It does not create quote acceptance, a booking, appointment,
occupancy, payment or invoice. All seeded commercial values remain
development-only assumptions and are not approved for automatic public pricing
or production use.

The provider-neutral pure engine lives in `src/modules/commercial-engine`.
Drizzle tables persist versioned commercial configuration, and
`src/db/seed-commercial-engine.ts` inserts the initial development records.
The engine accepts plain data and imports neither Next.js, Drizzle nor Neon.
The Phase 3D orchestration and persistence contract is documented in
`docs/REQUEST_AND_QUOTE.md`.

## Hard invariants

- Canonical pricing currency is EUR.
- Monetary values use integer euro cents (`amount_minor_units`), never binary
  floating point.
- VAT rates and percentage modifiers use integer basis points, where 2,000 is
  20.00% and 1,500 is 15.00%.
- Measured area boundaries use integer hundredths of a square metre.
- Published or historically referenced price-book versions and rules are never
  overwritten. A commercial change creates a new version or a new effective
  rule.
- Price and duration are calculated by independent models.
- Treatment level is a technical concept and is not a price tier.
- Any incomplete or assessment-led scope suppresses the automatic final total
  while retaining explainable known lines.
- Each Phase 3D estimate persists complete immutable price and duration
  snapshots. An issued quote freezes its reviewed commercial provenance, and a
  future accepted booking must copy that evidence; recalculating historical
  value against the current price book is forbidden.

## Price books and lifecycle

A price book records stable code, name, EUR currency, market, customer segment,
version, lifecycle status, effective window, price basis, VAT configuration,
provisional/publication flags and activity state.

Lifecycle values are `DRAFT`, `ACTIVE`, `SUPERSEDED` and `ARCHIVED`. The initial
books are intentionally inactive drafts:

| Code | Segment | Basis | Status | Rules |
| --- | --- | --- | --- | --- |
| `SOFIA_RESIDENTIAL_V1_DRAFT` | Residential | Gross | Draft | Provisional test rules |
| `SOFIA_B2B_V1_DRAFT` | B2B | Net | Draft | No populated commercial rates |

The B2B book proves segment and basis separation without fabricating contract,
volume or recurring-service values.

The deterministic bootstrap seeder uses insert-only conflict behavior for
price books, price rules, duration models and duration rules. Rerunning it does
not rewrite an existing version. Future authenticated administration must use
an explicit version-creation workflow with audit logs and approval controls.

## VAT semantics

The calculation context supports `VAT_REGISTERED` and
`VAT_NOT_REGISTERED`. A VAT-registered book may use gross or net rule values:

- gross basis: the customer-facing total remains fixed; net and VAT are
  derived from gross;
- net basis: VAT is calculated from net and added to produce gross; and
- not registered: VAT is zero and net equals gross.

The residential development book uses a gross basis and a provisional 20%
reference VAT rate. This is a development assumption, not a statement about
the company's registration. VAT registration, legal display, invoice and
rounding policy remain owner/accountant-controlled.

Phase 2A rounds each calculated line to the nearest cent using integer
half-up arithmetic. Area duration rounds up to a whole minute for conservative
planning. Both policies require approval before production.

## Rule types and dimensions

The general rule vocabulary supports `BASE_ITEM`, `PER_AREA_M2`, `PER_ITEM`,
`PER_SEAT`, `MINIMUM_VISIT`, `CONDITION_MODIFIER`, `ISSUE_MODIFIER`, `ADD_ON`,
`TRAVEL_ZONE`, `TIMING_MODIFIER`, `VOLUME_TIER` and `CUSTOM_ASSESSMENT`.

Rules may refer to a service, cleaning-item type, measurement mode, commercial
condition band, issue, add-on, risk flag, travel zone or timing category. A
rule also stores its adjustment kind, billing unit, exact amount or percentage,
measurement bounds, manual-assessment and decline/referral flags, priority,
activity state and version-owned identifier.

## Provisional residential values

These values exist only in the development draft and the internal lab:

| Item | Gross development value |
| --- | ---: |
| 2-seat sofa | €40.00 per item |
| 3-seat sofa | €49.00 per item |
| 4+ seat sofa | €60.00 per item |
| Corner sofa | €79.00 per item |
| Sofa bed | €55.00 per item |
| Armchair | €20.00 per item |
| Upholstered dining chair | €8.00 per item |
| Upholstered office chair | €9.00 per item |
| Ottoman | €15.00 per item |
| Single mattress | €23.00 per side |
| Double mattress | €34.00 per side |
| King/large mattress | €40.00 per side |
| Child mattress | €18.00 per side |

U-shaped sofas, upholstered benches and headboards require manual assessment.
Mattress quantity and side count are independent inputs; no rule assumes both
sides must always equal exactly twice a future one-side offer.

The provisional gross residential minimum visit is €49.00. It is applied only
after item work and eligible modifiers. It raises a lower calculated total to
the minimum and contributes zero when the calculated total already exceeds it.
It is not an additional fee.

## Area semantics

Residential fitted carpet uses **selected-band** pricing: the one band selected
by total measured area applies its rate to the complete area. It is not a
progressive tariff.

| Total area | Development rate |
| --- | ---: |
| 0.01–30.00 m² | €3.60/m² |
| 30.01–80.00 m² | €3.00/m² |
| 80.01+ m² | €2.60/m² |

The exact 29.99, 30.00, 30.01, 79.99, 80.00 and 80.01 boundaries are covered
by deterministic tests. B2B area tiers are not populated.

## Commercial condition and issues

Commercial condition is separate from treatment level:

| Code | Price factor | Duration factor |
| --- | ---: | ---: |
| `NORMAL` | 1.00 | 1.00 |
| `ENHANCED` | 1.15 | 1.15 |
| `INTENSIVE` | 1.30 | 1.30 |
| `ASSESSMENT_REQUIRED` | No automatic final price | No automatic duration |

The price and duration values live in different rule records even where the
initial factors happen to match.

General soil, dust, food/drink and mud add no automatic price. Coffee/tea and
wine may suggest stain targeting, and odour may suggest odour treatment, but
those add-ons still require confirmation because no amount or duration has
been approved. Grease/oil, pet-related, suspected urine, unknown and specialist
issues require assessment. `BLOOD_OR_BIOLOGICAL` always suppresses automatic
pricing and returns a decline/referral instruction; it does not imply a
biohazard or medical-treatment capability.

No antibacterial, anti-allergen, certified sanitisation or sterilisation rule
exists.

## Travel, parking and timing

The canonical zones are `SOFIA_CORE`, `SOFIA_EXTENDED`, `SOFIA_OUTSKIRTS` and
`OUTSIDE_SOFIA`. Exact boundaries, distance and travel-time thresholds remain
owner-controlled. Phase 2B adds operational eligibility/confirmation fields and
a separately versioned deterministic travel matrix; neither defines permanent
district geography or a commercial surcharge.

- Sofia core has no separate travel adjustment above the minimum visit.
- Extended Sofia and outskirts require assessment until an approved surcharge
  or higher minimum exists.
- Outside Sofia always requires custom assessment.
- The development parking policy is `PARKING_PASS_THROUGH`; parking is neither
  silently absorbed nor fabricated.

Timing categories are `STANDARD`, `EARLY_MORNING`, `EVENING`, `WEEKEND` and
`URGENT`. Every timing modifier is seeded inactive at zero. A future fixed or
percentage adjustment requires owner approval and a new effective rule.

## Calculation order and output

The price engine applies rules in this order:

1. validate versioned book, VAT and input dimensions;
2. calculate each item/area/side base line;
3. apply the commercial condition modifier to base cleaning work;
4. evaluate issue, risk and add-on rules;
5. evaluate travel and parking policy;
6. evaluate active timing rules;
7. apply any minimum-visit adjustment; and
8. derive net, VAT and gross amounts from the configured price basis.

The output includes every monetary line, subtotal, minimum adjustment, net,
VAT rate and amount, gross total, currency, warnings, manual and
decline/referral flags, plus the price-book and rule identifiers. It never
returns only an opaque number.

## Duration model

`SOFIA_OPERATIONS_V1_DRAFT` is an inactive provisional duration model. It uses
a 10-minute setup allowance plus a separate 10-minute initial inspection
allowance (the approved combined 20-minute development assumption), a 10-minute
cleanup/handover allowance, and 23 m²/hour area productivity.

| Item | Development cleaning time |
| --- | ---: |
| 2-seat sofa | 35 min |
| 3-seat sofa | 45 min |
| 4+ seat sofa | 55 min |
| Corner sofa | 70 min |
| U-shaped sofa | 90 min plus assessment |
| Sofa bed | 55 min |
| Armchair | 20 min |
| Upholstered dining chair | 8 min |
| Upholstered office chair | 10 min |
| Ottoman | 12 min |
| Single mattress | 25 min per side |
| Double mattress | 35 min per side |
| King/large mattress | 40 min per side |
| Child mattress | 20 min per side |

The pure duration result separately reports setup, inspection, base cleaning,
modifier, add-on, cleanup and total minutes. Condition adjustment applies to
base cleaning minutes, not setup or cleanup. Issue, material, treatment and
add-on duration records are structurally supported, but unknown operational
values require assessment instead of fabricated minutes. Travel time and
transition buffers always remain outside the Phase 2A service duration.

## Availability integration

Phase 2B composes, but never merges, the commercial results with the scheduling
engine documented in `docs/AVAILABILITY_ENGINE.md`. The duration total is the
complete on-site service block and is consumed exactly once. Travel before and
after, one independent buffer per neighbouring job and any explicit parking-time
buffer are added by availability only.

A manual price/duration result suppresses automatic slot offering and becomes
`REQUEST_REVIEW` when known operational constraints otherwise fit. Gross revenue
per occupied team-hour is available as an analytical helper; no payroll,
consumable or travel cost is invented.

Phase 3D may show this composition only as a staff advisory preview when enough
normalized request context exists. It retains only service-area and scheduling-
configuration readiness in the estimate snapshot; it does not persist a
candidate slot, create a hold or expose a customer-bookable slot.

## Manual assessment

Manual assessment is required when any configured item, condition, issue,
add-on, risk, material, treatment or travel rule says so, or when no automatic
rule exists. Known calculation lines remain available for explanation, but
final price and/or total duration are null. Decline/referral is an additional
explicit flag and never becomes an automatic service offer.

Public and customer request submission never runs this engine as a price
promise. Staff must normalize the submitted facts, review every warning and
issue the customer-facing quote deliberately. Draft, provisional, inactive or
unpublished configuration always keeps the workflow review-gated.

## Persistent estimate and quote snapshots

Phase 3D estimate rows store a complete versioned wrapper for both engines:
configuration identity and version, calculation time, normalized input, all
result lines, applied rule IDs, minimum-visit adjustment, tax treatment,
component minutes, totals, warnings and manual/decline state. Searchable EUR
minor-unit and duration columns must agree with those immutable snapshots.
Recalculation advances the request version and inserts the next estimate with
that `source_request_version` instead of updating history.

An issued quote freezes the reviewed estimate provenance, bilingual item
descriptions, measurement/calculation evidence, exact line and aggregate
amounts, terms and validity. Issued commercial data is never edited in place;
a revised offer is a new quote version. A future Booking must copy the accepted
issued evidence rather than display a later recalculation as the historical
quoted price.

## Contribution foundation

The optional pure analytics helper accepts estimated team minutes, labour cost
per team-hour, consumables and travel costs from its caller. It returns
estimated labour, contribution and contribution per team-hour. No real labour,
consumable or travel-cost assumption is seeded, and this helper is not an
accounting ledger.

## Internal pricing lab

`/internal/pricing-lab` is a static, browser-only development harness. It is
marked DEVELOPMENT ONLY, omitted from public navigation and sitemap, disallowed
in robots rules, and emits page-level no-index/no-follow metadata. It reads no
database and writes nothing.

No-index is not authorization. The route and its bundled draft values must not
be deployed publicly. Before any deployment, the route must be removed from the
build or protected by the future authentication and authorization boundary.

## Governance

Code controls stable semantic codes, pure calculation behavior and the initial
reviewed bootstrap. Commercial rows in PostgreSQL own effective, versioned
values. After an authenticated admin surface exists, routine price changes
must create database versions without requiring a code deployment. Admin work
requires role-based authorization, approval, validation, immutable history and
audit logs. Phase 3D records estimate creation and quote lifecycle events, but
it does not implement commercial-rule administration, activation or approval.

## Commercial calibration decisions

The follow-up calibration/activation phase requires owner and professional
approval for:

- final residential item, mattress-side and selected-band rates;
- whether sofa prices remain per item or become seat-based;
- exact minimum-call-out scope and exceptions;
- VAT registration, gross/net display and legally compliant wording;
- exact rounding, effective-date, supersession and publication policy;
- Sofia zone boundaries, travel thresholds, surcharges and parking handling;
- B2B area tiers, minimum job/contract values and recurring-volume rules;
- early, evening, weekend and urgent appointment policy;
- field-observed setup, inspection, item, productivity and cleanup times;
- add-on prices and duration supported by approved operating evidence;
- specialist acceptance, refusal and referral rules; and
- the activation/approval workflow for the first non-draft price book.
