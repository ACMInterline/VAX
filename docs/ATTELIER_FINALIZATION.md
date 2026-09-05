# ATTELIER Finalization

## Purpose and boundary

This closure calibrates the completed VAX platform as the ATTELIER Textile Care
staging product. VAX remains the repository, Neon-project and internal
engineering identity. ATTELIER is the final customer-facing brand; it is not
described as a registered trademark.

This work is prospective and nonproduction-only. It does not rewrite any
issued Quote, accepted Booking, Job, Cleaning Passport, Invoice, Payment,
document or communication snapshot. It does not authorize a production
migration, production deployment, live payment/fiscal integration, production
email/DNS configuration or real customer communication.

## Brand and public experience

The Bulgarian descriptor is **Професионална грижа за текстила** and the English
descriptor is **Textile Care**. The public routes use the ATTELIER wordmark,
bilingual editorial copy, saturated cobalt/yellow/coral/green/cream palette and
original geometric textile/home scenes. The illustrations contain no
identifiable person or third-party asset. Staging remains globally no-index;
LocalBusiness structured data remains withheld until the business contact and
legal public identity are verified.

The public launch scope is carpets/fitted carpets, rugs/runners, upholstered
chairs and furniture, sofas, mattresses and commercial textile care.
Specialist or delicate work is assessment-led. Biological or hazardous
contamination is declined or referred. Treatment remains technician-confirmed,
material preservation takes precedence over aggressive stain pursuit and no
universal stain, hygiene, acoustic or instant-drying claim is made.

## Commercial staging calibration

`ATTELIER_RESIDENTIAL_EUR_V1` contains the Owner-approved customer-facing gross
prices, condition factors and zone minimums. `ATTELIER_B2B_EUR_V1` is
quotation-only. Both remain inactive `DRAFT` configuration records because the
Phase 3N authority contract also requires Accountant approval. This does not
alter the approved public gross-price display: the staging estimate adapter may
select the exact residential configuration, but an unresolved VAT result has
no invented rate, net or VAT amount and remains manual-review-required.

The exact public prices are:

| Item | Customer price |
| --- | ---: |
| Carpet/fitted carpet | €4.00/m² |
| Rug/runner on site | €5.00/m² |
| Upholstered dining chair | €7 |
| Larger/office chair | from €9 |
| Armchair | €18 |
| Ottoman/pouf | €12 |
| Two-seat sofa | €35 |
| Three-seat sofa | €45 |
| Four-seat sofa | €55 |
| Corner sofa | from €60 |
| Large/U-shaped/modular sofa | from €80 |
| Single mattress, one side | €22 |
| Double mattress, one side | €30 |
| King mattress, one side | €35 |
| Second mattress side | +50% |

Standard, heavy and very-heavy commercial factors are 1.00, 1.15 and 1.30.
The zone minimums are €45 for Sofia Core, €60 for Outer Sofia, €80 up to
approximately 30 km outside Sofia and from €100 with staff confirmation for
approximately 30–50 km. Beyond approximately 50 km is exceptional,
quotation-only work. No district, postcode or polygon mapping is fabricated.
Material paid parking is passed through at documented cost without markup.

The exact staging duration model uses a 20-minute setup/inspection allowance,
10-minute completion allowance, 23 m²/hour per two-person team, the approved
per-item planning minutes and a +60% second-side duration. These are internal
planning assumptions, not customer completion-time promises.

## Business-authority activation

The activation command is guarded by the existing staging target manifest,
exact project/branch/database/role verification and the exact staging Auth
endpoint check. It resolves a unique active Owner with
`SYSTEM_SETTINGS_MANAGE`, uses the ordinary Phase 3N service/database policy and
is idempotent only for byte-equivalent values and the fixed effective instant.
Any divergent current record fails closed. No production record is accepted or
created. The reusable activation module has no import-time side effects; only
the explicit `authority:activate:attelier:staging` command invokes its separate
operator entry point. Ordinary tests/builds never load staging credentials or
activate authority through a module import.

The resolver is deliberately narrow. It recognizes only an allowlisted set of
immutable code-owned ATTELIER configurations, only when
`VAX_ENVIRONMENT=staging`, and binds subject type, code, positive version and a
canonical SHA-256 digest. It does not echo arbitrary database rows, resolve a
production reference or make a pending proposal active.

The staging plan has 29 records:

- 16 reach `APPROVED_FOR_STAGING`: brand identity, controlled public claims,
  launch service/item/material scope, qualified drying guidance, duration,
  working hours, appointment windows, Sofia zones, access/travel/parking, Job
  policy, Cleaning Passport/maintenance, Neon Auth initial-use risk,
  business-hours monitoring ownership and the staff-confirmation availability
  policy.
- 13 remain `UNDER_REVIEW`: residential pricing, B2B pricing, timing policy,
  VAT/tax, quote/Booking terms, team capacity, equipment inventory, actual
  treatment products, Auth session controls, privacy retention, recovery
  objectives, payment terms and finance/fiscal policy.

The under-review records retain the Owner's exact decision without pretending
that missing Accountant, Legal, real-product, real-staff/equipment, provider or
recovery evidence exists. Owner approval alone cannot complete those Phase 3N
contracts.

## Lifecycle acceptance boundary

The rollback-only staging rehearsal exercised the real application service and
repository through synthetic request creation, CRM/customer/property linkage,
staff normalization and a persisted €45 three-seat-sofa estimate using
`ATTELIER_RESIDENTIAL_EUR_V1` and Sofia Core. The original customer-reported
fields and submission were unchanged; request and normalization provenance were
verified. Net, VAT rate and VAT amount remained null, and the estimate carried
`VAT_STATUS_UNRESOLVED` with `REVIEW_REQUIRED`/manual assessment.

The actual source-VAT gate rejected that estimate. An unrepresentable gross-only
quote command was rejected by the service before SQL; this is not claimed as an
isolated live quote-SQL guard test. The transaction was rolled back, a separate
connection confirmed zero synthetic residue, and read-only operator comparisons
confirmed all 44 retained application-table fingerprints unchanged. No new Auth
identity or provider session was created. This proves repository integration,
not an authenticated hosted browser lifecycle.

The unresolved VAT marker keeps the estimate under
staff review. The existing Quote representation requires numeric net, rate and
VAT fields; it does not currently support gross-only issued Quotes. Draft,
update and issue therefore fail closed on unresolved source VAT rather than
inventing tax. This is a representation limitation, not a legal claim that every
commercial quote requires VAT. Consequently acceptance, Booking,
scheduling, dispatch, Job, Passport, Invoice, documents and communications are
not fabricated downstream.

Even after VAT/Accountant/Legal review, automatic scheduling remains blocked
until actual staff, equipment/capability and usable travel/zone classification
evidence is recorded. The operating targets (four staff, two two-person teams,
two independent primary equipment sets and at most two normal simultaneous
Jobs) are targets rather than assertions that resources exist today.

## Schema calibration

Migration `0017_attelier_staging_calibration.sql` is additive to the frozen
Phase 3N history. It:

- adds `VAT_UNRESOLVED` as an explicit commercial/estimate state;
- makes statutory rate/net/VAT amounts nullable only under the guarded
  unresolved-gross shape;
- adds explicit price and duration percentage fields for a second side; and
- changes no historical row, authority row, Auth-managed schema, role,
  permission or role-permission mapping.

Applied migration 0017 remains byte-identical. Follow-up
`0018_attelier_estimate_amount_compatibility.sql` restores the legacy valid
manual-estimate shape (withheld amounts, known VAT rate) and rejects incomplete
amount groups that could otherwise satisfy a PostgreSQL CHECK through NULL.
It changes only that CHECK, not any historical row or grant. The resulting
contract is 100 public tables and 19 ordered migrations.

The migrations may run only as `vax_migrator` through the existing guarded
nonproduction commands. Migration 0016 remains frozen at
`b68fd05476b5d32567f2f8838df4943e2a2beaa5db28ae9098b6aeb719ccb244`.

## Verification progress

The first exact-snapshot security review covered 58 changed source files and
validated an unresolved-source-VAT quote-authority gap with an offline test of
the actual action. It also confirmed import-time activation and legacy-estimate
compatibility defects. The repair adds independent resolved-tax gates at the
action selector and all three atomic repository transitions, an explicit
activation entry point, and forward migration 0018. The repaired snapshot passed
`npm run validate`: 1,592 tests passed and 17 were skipped, with lint, TypeScript,
production build, migration-history check, dependency audit (zero findings) and
whitespace check all successful. Its security review covered 67 changed source
files with no reportable security findings. It also caught a non-security
reconstruction defect: a stale 17-migration guard rejected the current history.
The repair moves a read-only, exact-hash inventory check before any rehearsal
database connection/provisioning and adds five focused passing tests. The next
full gate passed 1,597 tests (17 skipped; 180 files passed and four skipped),
with lint, TypeScript, production build, migration-history validation, audit
(zero findings) and whitespace checks passing. Its completed exact-snapshot
security review accounted for all 69 changed source files with no reportable
security findings.

Staging migration 0018 and the 19-entry ordered ledger were independently
verified. The earlier 18 ledger entries and 44 retained application-table row
fingerprints were unchanged. The installed amount constraint passed 22
read-only PostgreSQL predicate cases; these are not a substitute for insert or
trigger tests. The separate live database/security/shared-rate-limit suite
passed all 23 tests. Retained Auth user/session fingerprints and Auth
configuration were unchanged.

The dedicated hosted Preview built successfully and its stable staging alias
returned HTTP 200 for liveness and readiness, including database, migration,
Auth, shared-rate-limit and test-only-email checks. Responses retain no-store
and noindex boundaries. The hosted browser inspection verified EN/BG language
navigation, the approved price guide, 320/390-pixel layouts, mobile menu/Escape
focus return, public request fields and anonymous protected-route denial. No
browser form was submitted and no new Auth identity was created.

A subsequent hosted automated accessibility check found low-contrast dark
price-guide text, footer small print and faint helper text on yellow. The
contrast-only repair is limited to three stylesheets and the palette tests.
Three regression assertions were observed failing before repair; all 14
focused palette tests now pass. The latest full gate passed 1,602 tests with
17 expected skips (180 files passed, four skipped), plus lint, TypeScript,
production build, migration-history validation, zero audit findings and
whitespace checks. The final exact-snapshot security review accounted for all
69 changed source paths (65 hash-identical prior reviews and four independently
reviewed contrast changes), with no reportable findings. The rebuilt dedicated
Preview passed 20 automated accessibility checks: home, services, request,
login and service-area routes in BG/EN at 1280 and 320 CSS pixels. No violations
were reported. Gradient/overlap checks remain manual/incomplete, so this is not
a complete WCAG certification. Visual inspection confirmed the repaired
price-guide and footer colors; liveness/readiness remain HTTP 200 with no-store
and noindex. Retained Auth user/session row fingerprints and configuration
were independently confirmed unchanged after the lifecycle rehearsal.

The initial lifecycle helper stopped before starting its transaction because
the runtime role correctly denied SELECT on append-only delivery/audit tables.
No privilege was widened. The corrected helper keeps mutations on the runtime
connection and uses the existing, separately verified migrator only in a
`BEGIN READ ONLY` transaction for the 44-table comparisons. Its subsequent
actual lifecycle and independent cleanup checks all passed.

Local browser inspection covered BG/EN home, services and login pages, desktop
and 320/390-pixel mobile layouts, language navigation and mobile menu/Escape.
All inspected routes returned HTTP 200 without a framework error overlay or
recorded browser error. No forms were submitted. It caught and corrected a
mobile headline/wordmark issue. Contrast regression tests cover the primary
normal-text palette pairs; this is not a claim of a complete accessibility audit.

## Remaining launch dependencies

The smallest genuine external set is:

1. legal seller identity, business contacts, VAT status and Accountant/Legal
   review of price, terms, payments, Invoice/retention policy;
2. actual purchased products plus manufacturer evidence for any product claim;
3. actual staff/team/equipment/capability inventory and usable address-to-zone/
   travel confirmation data;
4. production Auth session/revocation decision, sender/domain/origins and
   production monitoring/alert ownership;
5. approved backup retention plus a current portable restore rehearsal for the
   final schema; and
6. a separate exact production target, migration, Owner bootstrap, deployment
   window and final Phase 3N production `GO` authorization.

Until every relevant dependency is current and approved for `PRODUCTION`, the
correct result remains `PRODUCTION NOT AUTHORIZED`.
