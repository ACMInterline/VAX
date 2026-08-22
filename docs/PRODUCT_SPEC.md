# Product Specification

## Product intent

Build a premium, dependable service-management platform for a small
professional carpet and upholstery cleaning company in Sofia, Bulgaria.

The product is broader than a marketing website. It should eventually support
the complete customer and service lifecycle while remaining usable by a small
team and maintainable as one application.

No final company name or logo is selected. Phase 1 uses the explicitly temporary
and replaceable public identity FabricCare Sofia while commercial identity work
continues.

## Product surfaces

The planned product contains these coordinated surfaces:

1. Public marketing website
2. Online quote and booking engine
3. Customer portal
4. Admin and dispatcher operations console
5. Technician mobile-first workspace
6. Customer, property, and cleaning-item CRM
7. Cleaning inspection and treatment records
8. Digital Cleaning Passport and history
9. Scheduling and team dispatch
10. Pricing, payments, and invoices
11. Claims, reviews, and communications
12. Equipment and consumables management
13. Business analytics

These are roadmap capabilities, not current implementation claims.

## Primary users

- Prospective residential and business customers evaluating or requesting
  cleaning services
- Returning customers managing properties, requests, history, and documents
- Dispatchers and administrators planning work and resolving exceptions
- Technicians inspecting items, recording treatment, and completing jobs
- Managers controlling quality, equipment, inventory, finance, and performance

Roles, permissions, and authentication behavior remain to be designed in the
identity phase.

## Core product invariant

A cleaning item is a durable record, not a line item owned by one booking.

The essential long-term relationship is:

> Customer → Property → Room → Cleaning Item → Cleaning History

Bookings and jobs may refer to a cleaning item many times. Inspection,
treatment, media, care recommendations, and later service events accumulate
into that item's Digital Cleaning Passport.

## Product principles

- Preserve history instead of overwriting operational facts.
- Separate customer intent, quoted scope, scheduled work, performed work, and
  commercial settlement.
- Make important status changes explicit and auditable.
- Design technician workflows mobile-first and tolerant of incomplete inputs.
- Present clear loading, empty, error, and recovery states.
- Keep business rules independent from infrastructure providers.
- Treat privacy and least privilege as product requirements.
- Prefer incremental delivery with observable acceptance gates.

## Phase 0A scope

Phase 0A delivers only:

- one repository and one Next.js application;
- a documented modular-monolith architecture;
- a minimal responsive foundation page;
- an isolated PostgreSQL and Drizzle integration;
- one system_metadata infrastructure table and its initial migration;
- a sanitized application and database health endpoint;
- environment, lint, typecheck, test, and build workflows; and
- persistent product and engineering documentation.

## Explicitly out of scope

Phase 0A does not implement:

- authentication, users, roles, or permissions;
- customer or property records;
- the future business schema;
- quote, booking, calendar, dispatch, or technician workflows;
- pricing, payments, invoices, maps, email, or SMS;
- binary file or photo storage;
- final branding or the complete public website;
- analytics;
- deployment or live database access.

## Phase 1 public website

Phase 1 now implements the public marketing surface described in
`docs/PUBLIC_SITE.md`: a complete Sofia-focused homepage, six substantial
service paths, professional-process and material-care guidance, service area,
about, FAQ, contact and a frontend-only request prototype.

The request prototype is deliberately not the booking engine. It validates the
future information shape in the browser and states that no booking or database
record is created. Public claims remain qualified and evidence-controlled; the
site does not invent reviews, ratings, awards, certifications, prices, customer
counts, business age, address or medical outcomes.

## Phase 1A Bulgarian content and authority

Phase 1A makes Bulgarian the primary commercial locale on unprefixed routes and
retains complete English equivalents under `/en`. Shared components consume one
strict localized-content contract, and the BG/EN selector preserves the current
route wherever an equivalent exists.

The phase also introduces an evidence-controlled claim register. Approximate
capacity, residual moisture, material care, stain outcomes and useful-life
language stay explicitly qualified. Manufacturer performance, product origin,
antibacterial or allergen performance and legal interpretation of operating
hours remain withheld pending evidence or review. Absolute medical, hygiene and
stain-removal promises are prohibited.

This phase changes no booking, persistence, authentication, payment, upload,
CRM or business database behavior. Bulgarian copy remains subject to final
owner review before launch.

## Phase 0A acceptance criteria

- The root page clearly identifies an operational technical foundation.
- GET /api/health reports connected or degraded database state without secrets.
- Strict TypeScript, lint, tests, and production build pass.
- The initial migration contains only system_metadata.
- Environment files containing values are ignored and .env.example is empty.
- The future domains and delivery phases are documented without being
  prematurely implemented.
