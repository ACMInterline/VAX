# Product Specification

## Product intent

Build a premium, dependable service-management platform for a small
professional carpet and upholstery cleaning company in Sofia, Bulgaria.

The product is broader than a marketing website. It should eventually support
the complete customer and service lifecycle while remaining usable by a small
team and maintainable as one application.

No final company name, logo, or public-site content is selected in Phase 0A.

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

## Phase 0A acceptance criteria

- The root page clearly identifies an operational technical foundation.
- GET /api/health reports connected or degraded database state without secrets.
- Strict TypeScript, lint, tests, and production build pass.
- The initial migration contains only system_metadata.
- Environment files containing values are ignored and .env.example is empty.
- The future domains and delivery phases are documented without being
  prematurely implemented.
