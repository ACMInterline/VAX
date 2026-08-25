# Content Authority

## Purpose

Phase 1A treats public marketing copy as a controlled trust boundary. Bulgarian
is the primary commercial language and English is the secondary locale, but
neither locale may strengthen a claim beyond the available evidence.

The typed runtime registry in `src/content/public-site/claims.ts` is the
machine-checked source for claim status. This document explains the editorial
decision and the evidence needed to change it. Any future status or publication
wording change must update both sources in the same reviewed pull request.

## Status definitions

| Status | Publication rule |
| --- | --- |
| `verified` | A current factual statement directly demonstrated by repository or approved business evidence. |
| `qualified` | May be published only with the recorded conditions and without becoming a guarantee. |
| `manufacturer_evidence_required` | Withheld until exact model or product evidence and publication approval exist. |
| `legal_verification_required` | Withheld until a current, scope-specific legal review is approved. |
| `prohibited` | Must not be used as a general public claim. |

## Claim register

### Request submission boundary

- **Claim:** the current form persists a request for staff review but does not
  create an automatic quote, booking or payment.
- **Publication wording:** “Формата изпраща заявка за преглед от екипа. Не се
  създава автоматична оферта, резервация или плащане.” English: “The form
  submits a request for staff review. It creates no automatic quote, booking or
  payment.”
- **Status:** `verified`.
- **Evidence needed:** Server Action, database-boundary and browser verification
  after any request-form change.
- **Notes:** Phase 1's browser-only prototype is historical. Phase 3D stores the
  validated submission and returns a request reference, but does not upload a
  file, calculate a public price, confirm availability, issue a quote or create
  a booking. Any stronger wording requires a new reviewed claim. See
  `docs/REQUEST_AND_QUOTE.md`.

### Processing capacity around 25 m² per hour

- **Claim:** under suitable conditions, professional treatment may reach
  approximately 25 m² per hour.
- **Publication wording:** “При подходящи условия професионалната обработка може
  да достигне около 25 m² на час, в зависимост от материята, замърсяването,
  избраната обработка и достъпа до повърхността.”
- **Status:** `qualified`.
- **Evidence needed:** timed field records across representative materials,
  contamination levels, treatment depths and access conditions.
- **Notes:** this is never a guaranteed rate, job duration or quotation basis.

### Residual moisture, drying and return to use

- **Claim:** the method is directed toward limiting residual moisture and
  returning treated surfaces to normal use sooner.
- **Publication wording:** “Методът е насочен към ограничаване на остатъчната
  влага и по-бързо връщане на обработените повърхности към нормална употреба.”
- **Status:** `qualified`.
- **Evidence needed:** approved method documentation and field measurements by
  material and environmental condition.
- **Notes:** actual timing depends on material, treatment depth, ventilation,
  temperature, relative humidity, contamination and surface construction. No
  instant-dry or fixed-time wording is permitted.

### Measured acoustic level and quiet operation

- **Claim:** a measured equipment sound level such as 55 dB.
- **Publication wording:** none.
- **Status:** `manufacturer_evidence_required`.
- **Evidence needed:** exact equipment model, measurement standard, distance,
  operating mode and current manufacturer documentation.
- **Notes:** public copy may discuss portable equipment, appointment planning and
  reducing unnecessary disturbance. It must not promise that equipment cannot
  be heard through walls or by neighbours.

### VAX cleaning equipment and products

- **Claim:** performance, composition or origin attributed to VAX equipment or
  cleaning products.
- **Publication wording:** none.
- **Status:** `manufacturer_evidence_required`.
- **Evidence needed:** exact product and model identity, current technical and
  safety data, supply documentation and explicit publication approval.
- **Notes:** equipment use does not imply manufacturer endorsement, partnership
  or affiliation. The internal repository name VAX is not a public brand claim.

### Antibacterial performance

- **Claim:** an actual product or process provides antibacterial effectiveness.
- **Publication wording:** none.
- **Status:** `manufacturer_evidence_required`.
- **Evidence needed:** product-specific efficacy evidence, test conditions,
  permitted instructions for use and regulatory review.
- **Notes:** general hygiene language is not evidence for antibacterial efficacy.

### Allergen or anti-allergen performance

- **Claim:** an actual product or process removes a defined allergen or has
  anti-allergen performance.
- **Publication wording:** none.
- **Status:** `manufacturer_evidence_required`.
- **Evidence needed:** product/process-specific evidence and medical-claim
  review for the exact intended wording.
- **Notes:** the public site may state that deep cleaning supports removal of
  accumulated soil, dust and residues. It must not infer a personal health
  outcome.

### Equipment or product origin

- **Claim:** equipment or products are made in or imported from the United
  Kingdom.
- **Publication wording:** none.
- **Status:** `manufacturer_evidence_required`.
- **Evidence needed:** model-level origin and supply-chain documentation plus
  publication approval.
- **Notes:** no origin claim is currently customer-facing.

### Appointment window and legal/noise interpretation

- **Claim requiring legal review:** Bulgarian law automatically permits every
  cleaning operation between 06:00 and 22:00.
- **Publication wording:** none for the legal conclusion.
- **Status:** `legal_verification_required`.
- **Evidence needed:** current legal review covering national, Sofia municipal,
  building and contract-specific rules.
- **Permitted qualified wording:** “Предлагаме ранни и вечерни часове според
  вида на услугата, адреса, правилата на сградата и наличността на екип.”
- **Notes:** 06:00–22:00 is intended appointment availability, not a legal
  conclusion or confirmed appointment.

### Five-level treatment methodology

- **Claim:** five levels provide a shared description of treatment intensity,
  while final selection follows professional inspection.
- **Publication wording:** “Вие описвате повърхността и проблема. Подходящата
  обработка се определя след професионален оглед.”
- **Status:** `qualified`.
- **Evidence needed:** approved operating procedure and technician training
  records before stronger process-consistency claims.
- **Notes:** customers do not prescribe chemistry, moisture or mechanical action.

### Stain removal

- **Claim:** not every stain can be removed safely; the aim is the best
  reasonably achievable result without unnecessary material risk.
- **Publication wording:** the qualified claim above may be published in both
  locales.
- **Status:** `qualified`.
- **Evidence needed:** item-specific inspection and treatment records for any
  stronger case-specific statement.
- **Notes:** complete or guaranteed stain removal is prohibited.

### Delicate, valuable and uncertain textiles

- **Claim:** material, construction, colourfastness, wear, age, stains, previous
  treatment, moisture sensitivity and permitted mechanical action affect the
  treatment decision.
- **Publication wording:** valuable, antique, Persian/oriental or materially
  uncertain textiles may require specialist assessment, a limited scope or
  refusal of unsuitable treatment.
- **Status:** `qualified`.
- **Evidence needed:** item-specific inspection plus approved referral and
  refusal criteria.
- **Notes:** testing can reduce uncertainty but cannot remove every material risk.

### Sustainability and useful-life preservation

- **Claim:** professional maintenance may help preserve appearance and useful
  life for longer.
- **Publication wording:** this non-quantified preservation statement may be
  published.
- **Status:** `qualified`.
- **Evidence needed:** longitudinal maintenance records before any quantified
  environmental or comparative claim.
- **Notes:** “100% sustainable”, “zero environmental impact” and quantified
  environmental savings are unsupported.

### Absolute hygiene and medical outcomes

- **Claim:** complete removal of all allergens, bacteria or mites; sterilisation;
  guaranteed breathing, allergy, sleep or health improvement.
- **Publication wording:** none.
- **Status:** `prohibited`.
- **Evidence needed:** not publishable as an absolute general service claim.
- **Notes:** the service must not imply specialist healthcare disinfection.

## Business facts awaiting owner verification

The following remain placeholders or intended operating facts rather than
launch-approved public facts:

- final commercial name, trademark position and logo;
- legal business name and any public registration details;
- approved telephone number and service mailbox;
- any customer-facing physical or correspondence address;
- confirmed service districts, surrounding-area policy and travel charges;
- final appointment availability and operational capacity;
- exact equipment, products and approved usage methods;
- specialist referral criteria and technician operating procedures;
- original photography, permission records and any case-study evidence; and
- prices, reviews, ratings, certifications, awards and business-history facts.

No item above may be fabricated to complete SEO, structured data or marketing
copy.
