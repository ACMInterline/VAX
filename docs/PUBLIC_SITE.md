# Public Website

## Phase 1 scope

Phase 1 establishes the customer-facing marketing foundation for professional
on-site carpet, rug, upholstery and mattress care in Sofia. It is a static
service-discovery experience plus a browser-only request prototype. It does not
create a quote, booking, customer, property, file, database record or external
message.

The repository remains internally named VAX. The public identity is the neutral
temporary name **FabricCare Sofia** and does not use the identity, assets or
claims of the VAX appliance manufacturer.

## Route map

| Route | Purpose |
| --- | --- |
| `/` | Complete public overview and primary conversion path |
| `/services` | Service discovery and treatment-level explanation |
| `/services/carpet-cleaning` | Residential and commercial carpet care |
| `/services/rug-cleaning` | On-site rug care where appropriate |
| `/services/sofa-upholstery-cleaning` | Sofa, chair and upholstery care |
| `/services/mattress-cleaning` | Non-medical mattress maintenance |
| `/services/office-carpet-cleaning` | Office and suitable business premises |
| `/services/delicate-fabric-care` | Assessment-first sensitive-material route |
| `/how-it-works` | Description, assessment, treatment and aftercare sequence |
| `/why-professional-cleaning` | Material judgement and preservation rationale |
| `/service-area` | Sofia coverage without invented zone pricing |
| `/about` | Service principles and temporary identity context |
| `/faq` | Carefully qualified practical answers |
| `/contact` | Configured placeholders and intended operating context |
| `/request` | Frontend-only, non-persistent request prototype |

The six service details share one typed dynamic route and are statically
generated from reviewed content. This avoids duplicate page implementations
and discourages thin SEO pages.

## Application boundaries

- `src/config/public-site.ts` owns the temporary name, tagline, Sofia area,
  contact placeholders, intended hours and primary call to action.
- `src/content/public-site/` owns typed English content, service records, FAQ,
  treatment levels, route inventory and claim controls.
- `src/components/public/` owns reusable public layout and presentation.
- `src/modules/public-request/` owns the provider-independent Zod request model
  and the browser-only form.
- `src/lib/public-metadata.ts` owns URL validation, metadata construction and
  structured-data eligibility.
- `src/app/(public)/` adapts these modules to Next.js routes.

Public pages are Server Components by default. Only the mobile navigation and
request form are Client Components. Neither imports database or server
environment code.

## Temporary brand configuration

`publicBrand.status` remains `temporary` and
`publicBrand.publicIdentityVerified` remains `false`. Phone and email are honest
placeholders with no links; no physical walk-in address is invented. Replace
the central configuration only after the name, trademark position, channels
and public facts are approved.

Original photography is intentionally deferred. Current visual containers
describe future images of real technicians, equipment, fabric detail and
permission-based examples. They are not before-and-after evidence.

## Claim-control policy

Published content must distinguish an intended benefit from a guaranteed
outcome. Capacity, return-to-use timing, quiet-operation language, stain
results, hygiene and service hours include the conditions that can change the
result.

`src/content/public-site/claims.ts` records prohibited absolute claims and
topics requiring evidence review. Automated tests scan the publishable content
for absolute medical and cleaning claims. In particular:

- do not promise personal medical outcomes;
- do not promise complete stain removal;
- do not convert an approximate 25 m²-per-hour capacity into a job-time
  guarantee;
- do not publish measured acoustic performance without evidence;
- do not publish named antibacterial, anti-allergen, manufacturer or
  sustainability claims without evidence and content review; and
- use the preservation principle: best reasonable cleaning result with minimum
  unnecessary stress on the material.

## Localization plan

The rendered Phase 1 content is reviewed English. The locale resolver and typed
content contract are prepared for Bulgarian and English without duplicating
route components. Bulgarian is the planned primary commercial language.

The next localization step is to add a reviewed Bulgarian content object that
satisfies the same contract, then introduce locale-aware routing, canonical and
`hreflang` behavior in one focused change. Final marketing copy must be reviewed
by a Bulgarian speaker; automatic translation is not a publishing workflow.

## SEO architecture

- Every page has a specific title and description.
- The root title template, Open Graph defaults and generated visual are shared.
- The complete route inventory drives `sitemap.xml`.
- `robots.txt` disallows crawling until a valid `PUBLIC_SITE_URL` is configured.
- Canonical URLs are emitted only when `PUBLIC_SITE_URL` is a valid HTTPS origin
  or loopback URL. The local sitemap uses `http://localhost:3000` only as a
  development fallback.
- Breadcrumb markup is emitted only when a real base URL is configured.
- `LocalBusiness` structured data is withheld while the public identity is
  unverified. Contact, address, reviews, ratings, prices and certifications are
  never fabricated to complete schema markup.

`PUBLIC_SITE_URL` is not a secret. It remains empty in `.env.example` and must
be set to the approved public origin as part of a separately authorized
deployment-readiness phase.

## Request prototype behavior

The form accepts customer contact fields, Sofia area, property type, multiple
services, quantity or area estimates, condition, stains, delicate-material
indication, preferred timing and notes. The image control is disabled and
clearly marked as future functionality.

Submission uses `preventDefault`, converts the current browser `FormData` to a
plain object and validates it with Zod. Invalid fields receive associated error
messages. Valid input produces a status message stating that nothing was sent
or stored. The form has no `action`, Server Action, route handler, fetch call,
storage adapter or database import.

Future connectivity belongs to the booking/request phase and requires server
validation, abuse controls, privacy decisions, durable data design,
authorization where applicable, file-storage controls and operational
acknowledgement behavior.

## Accessibility and responsive baseline

The public shell provides semantic landmarks, a skip link, keyboard-operable
navigation, visible focus, native FAQ disclosure controls, labelled fields,
associated errors, live result messaging and reduced-motion and
reduced-transparency handling. Layout and touch targets start at 320 CSS pixels
and reflow at content-led breakpoints.

Phase 1 browser checks cover 320, 375, 430, 768, 1024 and desktop widths. A
future production gate should add automated cross-browser accessibility and
performance budgets against the deployed origin.

## Deferred dependencies

Phase 2 owns the versioned service catalogue, pricing semantics, district or
travel pricing and explainable calculations. Later booking work owns request
persistence, availability, confirmation and uploads. Identity, payments,
communications, reviews and analytics remain in their documented phases.

Deployment remains separately blocked by the time-bound Next.js security gate
in `docs/SECURITY.md`.
