# Canonical Service Catalogue

## Purpose and boundary

Phase 2 establishes the stable commercial and operational vocabulary used to
describe a serviceable textile item across its future lifecycle:

> Customer request → preliminary quote → booking → property and room → durable
> cleaning item → technician inspection → treatment → completed job → Digital
> Cleaning Passport → repeat maintenance → analytics

This phase creates reference data only. It does not create customers, durable
cleaning-item records, requests, quotes, bookings, jobs, prices, payments,
schedules or invoices. A future `cleaning_item` will persist independently of
any booking and will refer to the codes defined here.

## Sources of truth

The provider-neutral definitions in
`src/modules/service-catalogue/catalogue.ts` are the code-controlled source for
stable codes, Bulgarian and English labels, descriptions, ordering, public
request options and approved capability relationships. The Drizzle tables in
`src/db/schema/service-catalogue.ts` are their persistence representation. The
idempotent seeder in `src/db/seed-service-catalogue.ts` upserts those approved
definitions after reviewed migrations run.

Static public pages import the provider-neutral definitions. They do not query
the database and do not need `DATABASE_URL` to build or render. Marketing page
titles remain presentation copy; each public service record carries a canonical
service code so wording can change without changing database identity.

## Canonical service categories and services

| Category code | Bulgarian | English |
| --- | --- | --- |
| `CARPET_FLOORING` | Мокети и килимени настилки | Carpets & fitted carpet |
| `RUGS` | Килими и пътеки | Rugs & runners |
| `UPHOLSTERED_FURNITURE` | Мека мебел | Upholstered furniture |
| `MATTRESSES` | Матраци | Mattresses |
| `COMMERCIAL_TEXTILE_SURFACES` | Текстилни повърхности за бизнес обекти | Commercial textile surfaces |
| `SPECIALIST_TEXTILE_CARE` | Специализирана грижа за текстил | Specialist textile care |

| Service code | Category | Public route identity |
| --- | --- | --- |
| `CARPET_CARE` | `CARPET_FLOORING` | `carpet-cleaning` |
| `RUG_RUNNER_CARE` | `RUGS` | `rug-cleaning` |
| `UPHOLSTERY_CARE` | `UPHOLSTERED_FURNITURE` | `sofa-upholstery-cleaning` |
| `MATTRESS_CARE` | `MATTRESSES` | `mattress-cleaning` |
| `COMMERCIAL_TEXTILE_CARE` | `COMMERCIAL_TEXTILE_SURFACES` | `office-carpet-cleaning` |
| `DELICATE_TEXTILE_ASSESSMENT` | `SPECIALIST_TEXTILE_CARE` | `delicate-fabric-care` |

The route slug is nullable presentation metadata. Stable service codes, not
route names or marketing headings, are the identity used by future workflows.

## Cleaning-item taxonomy

| Group | Codes |
| --- | --- |
| Textile flooring | `CARPET_FIXED`, `OFFICE_CARPET` |
| Rugs | `RUG`, `RUNNER` |
| Sofas | `SOFA_2_SEAT`, `SOFA_3_SEAT`, `SOFA_4_PLUS`, `SOFA_CORNER`, `SOFA_U_SHAPED`, `SOFA_BED` |
| Other upholstered furniture | `ARMCHAIR`, `DINING_CHAIR_UPHOLSTERED`, `OFFICE_CHAIR_UPHOLSTERED`, `BENCH_UPHOLSTERED`, `OTTOMAN`, `HEADBOARD`, `COMMERCIAL_UPHOLSTERY` |
| Mattresses | `MATTRESS_SINGLE`, `MATTRESS_DOUBLE`, `MATTRESS_KING_OR_LARGE`, `MATTRESS_CHILD` |
| Assessment-first fallback | `OTHER_TEXTILE_SURFACE` |

These are types of physical object or surface. They are not booking line items
and contain no price. Shape and size distinctions are intentionally practical,
not a complete furniture standard.

## Measurement modes

The controlled modes are `AREA_M2`, `PER_ITEM`, `PER_SEAT`, `LINEAR_METER` and
`CUSTOM_ASSESSMENT`. Every item type has exactly one default mode, enforced by
tests and a partial unique database index, while the join table allows
additional permitted modes.

- fixed and office carpet default to `AREA_M2`;
- rugs default to `AREA_M2` and may later support `PER_ITEM`;
- runners default to `AREA_M2` and may support `LINEAR_METER` or `PER_ITEM`;
- sofas default to `PER_ITEM` and permit `PER_SEAT`;
- chairs, other furniture and mattresses default to `PER_ITEM`;
- commercial upholstery defaults to `PER_ITEM` and permits `PER_SEAT`; and
- `OTHER_TEXTILE_SURFACE` defaults to `CUSTOM_ASSESSMENT`.

Permitted measurement does not itself establish a pricing formula.

## Material and construction distinction

`fibre_materials` records composition: unknown, generic synthetic, polyester,
polypropylene, polyamide/nylon, acrylic, cotton, linen, viscose/rayon, wool,
wool blend, silk, mixed fibres, natural/synthetic blend, other identified, and
specialist/uncertain.

`surface_constructions` records practical construction or finish: unknown,
woven, tufted, loop pile, cut pile, shag/high pile, flatweave, velvet, chenille,
microfibre finish and other.

Velvet and microfibre are deliberately not treated as definitive fibre
composition. Velvet commonly describes a pile construction or finish.
Microfibre describes very fine fibres or a surface presentation; its actual
composition may be polyester, polyamide or a blend and must be recorded
separately when known.

## Condition scale

| Code | Meaning |
| --- | --- |
| `LIGHT_MAINTENANCE` | Light condition or routine maintenance |
| `NORMAL` | Ordinary use |
| `NOTICEABLY_SOILED` | Visible soiling or traffic areas |
| `HEAVILY_SOILED` | Heavy or multi-factor soiling |
| `SPECIALIST_ASSESSMENT_REQUIRED` | Uncertainty or condition requires specialist assessment |

The wording is neutral and does not shame customers. A future workflow must
keep customer-described condition separate from a technician-confirmed
inspection result.

## Issues and handling

Issue codes are `GENERAL_SOIL`, `DUST_ACCUMULATION`, `FOOD_DRINK`,
`COFFEE_TEA`, `WINE`, `GREASE_OIL`, `MUD`, `PET_RELATED`, `URINE_SUSPECTED`,
`ODOUR`, `COSMETICS`, `INK`, `BLOOD_OR_BIOLOGICAL`, `UNKNOWN_STAIN`,
`OLD_STAIN`, `COLOUR_TRANSFER`, `CHEWING_GUM`, `WAX` and `OTHER`.

Each issue refers to one of `STANDARD`, `ASSESSMENT_REQUIRED`,
`SPECIALIST_ONLY` or `DECLINE_OR_REFER`. These are intake and inspection
classifications, not diagnoses or guarantees of treatment. In particular,
`BLOOD_OR_BIOLOGICAL` is `DECLINE_OR_REFER`; this catalogue does not claim
biohazard, medical or clinical-decontamination capability.

## Risk and sensitivity flags

The controlled assessment flags are `DELICATE_MATERIAL`, `UNKNOWN_FIBRE`,
`VALUABLE_ITEM`, `ANTIQUE_OR_VINTAGE`, `COLOURFASTNESS_CONCERN`,
`MOISTURE_SENSITIVE`, `EXISTING_DAMAGE`, `HEAVY_WEAR`, `LOOSE_SEAMS`,
`FRAYING`, `SHRINKAGE_RISK`, `DYE_BLEED_RISK`,
`PREVIOUS_CHEMICAL_TREATMENT`, `HANDMADE`, `ORIENTAL_PERSIAN_STYLE`,
`CUSTOMER_DECLARED_SPECIAL_VALUE` and `OTHER`.

Flags record relevant observations or declarations. They do not prove origin,
value, diagnosis or treatment outcome. `ORIENTAL_PERSIAN_STYLE` is explicitly a
style description, not provenance authentication.

## Treatment model

The canonical five levels are:

1. `GENTLE_CARE`
2. `REFRESH`
3. `DEEP_CLEAN`
4. `INTENSIVE`
5. `SPECIALIST_ASSESSMENT`

Every treatment-level row is constrained as not customer-selectable. Future
transaction models must keep three facts separable: customer-described
condition, a suggested treatment and technician-confirmed treatment.

Treatment intensity is separate from mechanical action. The controlled action
levels are `NONE`, `MINIMAL`, `LIGHT`, `STANDARD`, `ENHANCED` and
`SPECIALIST_ONLY`. A deep treatment therefore does not automatically imply
aggressive brushing.

The method vocabulary is `LOW_MOISTURE`, `EXTRACTION`,
`TARGETED_EXTRACTION`, `SPECIALIST_METHOD` and `NOT_DETERMINED`. These names do
not imply that every service uses the same process or make manufacturer claims.

## Product catalogue foundation

`cleaning_product_categories` contains neutral categories only.
`cleaning_products` can later store an internal code, manufacturer, product
name, category, intended application, compatible-material notes, dilution
guidance, safety-document reference, evidence-document reference, active state
and internal notes.

No product rows are seeded. No manufacturer specification, product origin,
antibacterial performance, allergen performance or clinical effectiveness is
asserted. Adding an actual product requires owner-approved technical and safety
evidence and a reviewed data change.

## Add-ons and capability relationships

The add-on vocabulary is `STAIN_TARGETING`, `ODOUR_TREATMENT`,
`ADDITIONAL_EXTRACTION`, `DELICATE_MATERIAL_ASSESSMENT`,
`PROTECTIVE_TREATMENT` and `OTHER`. Definitions have no prices. Capability rows
are assessment-gated, and no antibacterial or allergen add-on exists.

The relational capability model provides:

- service ↔ cleaning item type;
- cleaning item type ↔ permitted measurement mode, including one default;
- service ↔ available treatment level;
- fibre material ↔ explicit treatment consideration; and
- service ↔ conditional add-on.

Capability status is controlled by `STANDARD`, `ASSESSMENT_REQUIRED`,
`SPECIALIST_ONLY` and `UNAVAILABLE`. Service/item rows also carry
`inspection_required` and `instant_quote_eligible`. All seeded rows require
inspection and are not instant-quote eligible because pricing is not yet
implemented. A relationship expresses catalogue availability, not a technical
guarantee for a specific item.

## Duration and reuse readiness

Services have nullable fields for base setup minutes, duration minutes per
measurement unit, complexity-multiplier eligibility and minimum duration. No
arbitrary numbers or multipliers are seeded. Reuse guidance uses
`ITEM_SPECIFIC_GUIDANCE`, meaning that material, construction, method and site
conditions determine the eventual advice.

## Pricing readiness without pricing

No monetary amount, currency, rate, tax rule, discount or call-out value exists
in this phase. Future pricing may consider item type, measurement, quantity,
area, condition, treatment, material sensitivity, issue handling, add-ons,
travel zone, minimum call-out, B2B volume and appointment timing. Phase 2A must
approve exact money representation, currency, VAT/tax semantics, versioning,
rounding, effective dates, quote provenance and owner-supplied operating data
before adding prices.

## Reference-data governance

### Code-controlled data

Stable taxonomies and capability relationships are reviewed in Git, tested and
upserted by the deterministic seeder. Existing codes are never repurposed. A
renamed label keeps the same code. Records are deactivated rather than deleted
when historical references may exist. Code-controlled changes require a pull
request, migration review where schema changes, and development verification.

### Future admin-editable data

Actual cleaning-product records, evidence references, internal product notes
and approved operational duration inputs are expected to become controlled
admin data after authentication, authorization and audit logging exist. No
admin UI exists in Phase 2. Until then, actual product or operational values
must be added only through a reviewed owner-authorized data change.

## Public request alignment

The frontend-only request form now submits canonical cleaning-item codes and a
canonical condition code to its in-browser Zod validator. Labels come from the
same Bulgarian/English catalogue. The form still has no action, Server Action,
route handler, fetch, upload, email adapter or database import. It creates no
request, quote, booking, cleaning item or persistent data.

## Owner decisions required for Phase 2A

- approved service scope and any category/code changes;
- which sofa and commercial measurements will drive prices;
- real setup, per-unit, minimum-duration and complexity inputs;
- Sofia travel zones and call-out policy;
- B2B volume and appointment-timing rules;
- BGN/EUR commercial currency strategy and exact rounding;
- VAT/tax registration and display requirements after professional review;
- price versioning, effective dates, publishing and quote provenance;
- approved products, safety documents and evidence references;
- specialist acceptance, refusal and referral rules; and
- drying and return-to-use advisory categories supported by field evidence.
