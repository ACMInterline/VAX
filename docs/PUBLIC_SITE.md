# Public Website

## Phase 1 and Phase 1A scope

Phase 1 establishes the customer-facing marketing foundation for professional
on-site carpet, rug, upholstery and mattress care in Sofia. It is a static
service-discovery experience plus a browser-only request prototype. It does not
create a quote, booking, customer, property, file, database record or external
message. Phase 1A makes Bulgarian the primary commercial language, retains
English as a complete secondary locale, and adds evidence-controlled content
authority without changing that application boundary.

The repository remains internally named VAX. The public identity is the neutral
temporary name **FabricCare Sofia** and does not use the identity, assets or
claims of the VAX appliance manufacturer.

## Route map

| Bulgarian (primary) | English (secondary) | Purpose |
| --- | --- | --- |
| `/` | `/en` | Complete public overview and primary conversion path |
| `/services` | `/en/services` | Service discovery and treatment-level explanation |
| `/services/carpet-cleaning` | `/en/services/carpet-cleaning` | Residential and commercial carpet care |
| `/services/rug-cleaning` | `/en/services/rug-cleaning` | On-site rug care where appropriate |
| `/services/sofa-upholstery-cleaning` | `/en/services/sofa-upholstery-cleaning` | Sofa, chair and upholstery care |
| `/services/mattress-cleaning` | `/en/services/mattress-cleaning` | Non-medical mattress maintenance |
| `/services/office-carpet-cleaning` | `/en/services/office-carpet-cleaning` | Office and suitable business premises |
| `/services/delicate-fabric-care` | `/en/services/delicate-fabric-care` | Assessment-first sensitive-material route |
| `/how-it-works` | `/en/how-it-works` | Description, assessment, treatment and aftercare sequence |
| `/why-professional-cleaning` | `/en/why-professional-cleaning` | Material judgement and preservation rationale |
| `/service-area` | `/en/service-area` | Sofia coverage without invented zone pricing |
| `/about` | `/en/about` | Service principles and temporary identity context |
| `/faq` | `/en/faq` | Carefully qualified practical answers |
| `/contact` | `/en/contact` | Configured placeholders and intended operating context |
| `/request` | `/en/request` | Frontend-only, non-persistent request prototype |

The six service details share one typed dynamic route and are statically
generated from reviewed content. This avoids duplicate page implementations
and discourages thin SEO pages.

## Application boundaries

- `src/config/public-site.ts` owns the temporary name, tagline, Sofia area,
  contact placeholders, intended hours and primary call to action.
- `src/content/public-site/` owns typed Bulgarian and English content, service
  records, FAQs, treatment levels, locale routing and claim controls.
- `src/components/public/` owns reusable public layout and presentation.
- `src/modules/public-request/` owns the provider-independent Zod request model
  and the browser-only form.
- `src/lib/public-metadata.ts` owns URL validation, metadata construction and
  structured-data eligibility.
- `src/app/(public)/` adapts the unprefixed Bulgarian routes.
- `src/app/(public-en)/en/` adapts their English `/en` equivalents.

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

`src/content/public-site/claims.ts` is the typed claim registry. It classifies
each important concept as `verified`, `qualified`,
`manufacturer_evidence_required`, `legal_verification_required`, or
`prohibited`. `docs/CONTENT_AUTHORITY.md` records approved wording, required
evidence and editorial notes. Automated tests scan publishable content in both
locales for absolute medical, cleaning and manufacturer-dependent claims. In
particular:

- do not promise personal medical outcomes;
- do not promise complete stain removal;
- do not convert an approximate 25 m²-per-hour capacity into a job-time
  guarantee;
- do not publish measured acoustic performance without evidence;
- do not publish named antibacterial, anti-allergen, manufacturer or
  sustainability claims without evidence and content review; and
- use the preservation principle: best reasonable cleaning result with minimum
  unnecessary stress on the material.

## Localization architecture

Bulgarian is the primary commercial locale on stable, unprefixed URLs. English
uses the matching `/en` URL. Both languages satisfy the same exact TypeScript
content contract and render through the same page and presentation components;
the route files are thin Next.js adapters only.

The BG/EN selector maps to the corresponding route and falls back to the target
locale home only for an unknown path. It is a normal link, works without client
storage, remains keyboard accessible and does not use browser-language
redirects. Separate locale root layouts ensure that the document has an
accurate `lang="bg"` or `lang="en"` attribute. Moving between the two root
layouts performs a full document navigation by design.

The Bulgarian copy is launch-preparation copy, not owner approval. It still
requires final review by a Bulgarian-speaking business owner together with the
facts listed in `docs/CONTENT_AUTHORITY.md`.

## SEO architecture

- Every page has a specific title and description.
- Every route exposes Bulgarian and English canonical alternatives plus an
  `x-default` pointing to Bulgarian when a verified public origin is present.
- The root title template, Open Graph defaults and generated visual are shared.
- Open Graph locale and alternate-locale values match the rendered language.
- The complete 30-URL bilingual route inventory drives `sitemap.xml`, including
  language alternates.
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
plain object and validates it with a locale-aware Zod schema. Bulgarian and
English labels, options, validation errors and acknowledgements have equivalent
behavior. Invalid fields receive associated error messages. Valid input
produces a status message stating that nothing was sent or stored. The form has
no `action`, Server Action, route handler, fetch call, email integration,
storage adapter or database import.

Future connectivity belongs to the booking/request phase and requires server
validation, abuse controls, privacy decisions, durable data design,
authorization where applicable, file-storage controls and operational
acknowledgement behavior.

## Accessibility and responsive baseline

The public shell provides semantic landmarks, a skip link, keyboard-operable
navigation, an accessible text language selector, localized navigation labels,
visible focus, native FAQ disclosure controls, labelled fields, associated
errors, live result messaging and reduced-motion and reduced-transparency
handling. Layout and touch targets start at 320 CSS pixels and reflow at
content-led breakpoints. Bulgarian and English documents declare their own
language.

Phase 1A browser checks cover both locales and representative 320, 375, 430,
768, 1024 and desktop widths. A future production gate should add automated
cross-browser accessibility and performance budgets against the deployed
origin.

## Deferred dependencies

Phase 2 owns the versioned service catalogue, pricing semantics, district or
travel pricing and explainable calculations. Later booking work owns request
persistence, availability, confirmation and uploads. Identity, payments,
communications, reviews and analytics remain in their documented phases.

Deployment remains separately blocked by the time-bound Next.js security gate
in `docs/SECURITY.md`.
