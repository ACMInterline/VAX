import { randomBytes, randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { drizzle as neonDrizzle } from "drizzle-orm/neon-serverless";
import { drizzle as nodePostgresDrizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";
import * as schema from "@/db/schema";
import { getDatabaseUrl } from "@/lib/environment";
import {
  allocatePaymentRecord,
  cancelDraftInvoiceRecord,
  createInvoiceDraftRecord,
  dashboardRecord,
  getCustomerInvoiceRecord,
  getStaffInvoiceRecord,
  issueInvoiceRecord,
  listCustomerInvoicesRecord,
  listPaymentsRecord,
  recordPaymentRecord,
  confirmPaymentRecord,
  reversePaymentRecord,
} from "@/modules/finance-invoicing/repository";
import {
  assertDevelopmentDatabaseMutationTarget,
  loadMigrationEnvironment,
} from "./migration-environment";

vi.mock("server-only", () => ({}));

const runLiveIntegration =
  process.env.RUN_PHASE3H_DATABASE_INTEGRATION === "1";
const runConcurrencyIntegration =
  process.env.RUN_PHASE3H_CONCURRENCY_INTEGRATION === "1";

type BatchQuery = PromiseLike<unknown> & Readonly<{
  getQuery(): Readonly<{ sql: string }>;
}>;

type CustomerContext = Readonly<{
  customerId: string;
  propertyId: string;
  customerType: "INDIVIDUAL" | "BUSINESS";
}>;

type CommercialGraph = Readonly<{
  requestId: string;
  requestItemId: string;
  estimateId: string;
  quoteId: string;
  quoteItemId: string;
  acceptanceId: string;
  bookingId: string;
  bookingItemId: string;
  bookingReference: string;
  quoteReference: string;
  netAmountMinorUnits: number;
  vatAmountMinorUnits: number;
  grossAmountMinorUnits: number;
  priceBasis: "NET" | "GROSS";
}>;

type FinanceFixture = Readonly<{
  token: string;
  ownerProfileId: string;
  technicianProfileId: string;
  customerProfileId: string;
  sellerProfileId: string;
  numberingPolicyId: number;
  invoicePolicyId: number;
  jobInvoicePolicyId: number;
  individual: CustomerContext;
  business: CustomerContext;
  individualPrimary: CommercialGraph;
  individualSecondary: CommercialGraph;
  individualDeferred: CommercialGraph;
  businessPrimary: CommercialGraph;
}>;

class RollbackCompleted extends Error {}

function hexadecimalToken(): string {
  return randomBytes(12).toString("hex").toUpperCase();
}

function assertDisposableLocalConcurrencyTarget(): void {
  const url = new URL(getDatabaseUrl());
  const databaseName = decodeURIComponent(url.pathname.replace(/^\//, ""));
  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1"]);
  if (
    !loopbackHosts.has(url.hostname) ||
    !/^vax_phase3h_concurrency_[a-z0-9_]+$/.test(databaseName) ||
    process.env.PHASE3H_DISPOSABLE_DATABASE_NAME !== databaseName
  ) {
    throw new Error("Phase 3H concurrency target is not a disposable local database.");
  }
  assertDevelopmentDatabaseMutationTarget();
}

async function waitForLockWait(
  observer: Pool,
  applicationName: string,
): Promise<void> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const activity = await observer.query<{ wait_event_type: string | null }>(
      `select wait_event_type
       from pg_stat_activity
       where application_name = $1
         and state = 'active'
       order by backend_start desc
       limit 1`,
      [applicationName],
    );
    if (activity.rows[0]?.wait_event_type === "Lock") return;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("Timed out waiting for the concurrent issue lock barrier.");
}

/**
 * Production uses the Neon HTTP driver's atomic batch primitive. This live
 * test instead runs every operation through one stateful PostgreSQL session so
 * all synthetic facts, including append-only rows, can be rolled back.
 *
 * PgRaw values are lazy. The adapter awaits each repository batch item on the
 * current transaction. For mutation batches, it omits only the batch-local
 * isolation declaration because the outer transaction is already READ
 * COMMITTED and PostgreSQL does not allow SET TRANSACTION after fixture
 * queries have executed. Read batches are executed unchanged.
 */
function addTransactionalBatch(database: object): Database {
  const adapted = database as Database;
  const batchTarget = adapted as unknown as {
    batch: (queries: readonly BatchQuery[]) => Promise<readonly unknown[]>;
  };

  batchTarget.batch = async (queries: readonly BatchQuery[]) => {
    const first = queries[0];
    const hasIsolationDeclaration =
      first?.getQuery().sql.trim().toLowerCase() ===
      "set transaction isolation level read committed";

    const results: unknown[] = hasIsolationDeclaration
      ? [{ rows: [], rowCount: 0 }]
      : [];
    const executableQueries = hasIsolationDeclaration
      ? queries.slice(1)
      : queries;
    for (const query of executableQueries) results.push(await query);
    return results;
  };

  return adapted;
}

async function createCustomerContext(
  database: Database,
  fixture: FinanceFixture,
  customerType: "INDIVIDUAL" | "BUSINESS",
): Promise<CustomerContext> {
  const customerId = randomUUID();
  const propertyId = randomUUID();
  const suffix = customerType === "INDIVIDUAL" ? "individual" : "business";
  const billingName = `Phase 3H ${suffix} integration customer`;
  const companyRegistrationNumber =
    customerType === "BUSINESS" ? `SYN-${fixture.token}` : null;
  const vatNumber =
    customerType === "BUSINESS" ? `BG-SYN-${fixture.token}` : null;
  const vatNumberStatus =
    customerType === "BUSINESS" ? "VERIFIED_FUTURE" : "NOT_APPLICABLE";

  const result = await database.execute<{ customer_id: string }>(sql`
    with inserted_customer as (
      insert into public.customers (
        id, customer_type, display_name, legal_name,
        preferred_locale, status, created_by_profile_id
      ) values (
        ${customerId}::uuid, ${customerType}, ${billingName},
        ${customerType === "BUSINESS" ? billingName : null},
        'en', 'ACTIVE', ${fixture.ownerProfileId}::uuid
      )
      returning id
    ),
    inserted_property as (
      insert into public.properties (
        id, customer_id, property_type, label, city, district,
        street_address, postal_code, access_notes, service_zone_id,
        status, created_by_profile_id
      )
      select ${propertyId}::uuid, inserted_customer.id,
        case when ${customerType} = 'BUSINESS'
          then 'OFFICE' else 'RESIDENTIAL' end,
        'Phase 3H synthetic property', 'Sofia', 'Centre',
        'Synthetic integration address', '1000',
        'Synthetic integration access only', zone.id, 'ACTIVE',
        ${fixture.ownerProfileId}::uuid
      from inserted_customer
      join public.travel_zones zone on zone.code = 'SOFIA_CORE'
      returning customer_id
    ),
    inserted_billing as (
      insert into public.customer_billing_profiles (
        customer_id, version, status, billing_name, billing_email,
        billing_address_line_1, billing_city, billing_postal_code,
        billing_country_code, company_registration_number, vat_number,
        vat_number_status, approved_at, approved_by_profile_id,
        created_by_profile_id
      ) values (
        ${customerId}::uuid, 1, 'APPROVED', ${billingName},
        ${`phase3h-${suffix}-${fixture.token.toLowerCase()}@example.invalid`},
        'Synthetic integration address', 'Sofia', '1000', 'BG',
        ${companyRegistrationNumber}, ${vatNumber}, ${vatNumberStatus},
        now(), ${fixture.ownerProfileId}::uuid,
        ${fixture.ownerProfileId}::uuid
      )
      returning customer_id
    )
    select inserted_property.customer_id
    from inserted_property
    join inserted_billing using (customer_id)
  `);
  expect(result.rows).toEqual([{ customer_id: customerId }]);

  return { customerId, propertyId, customerType };
}

async function createCommercialGraph(
  database: Database,
  fixture: FinanceFixture,
  customer: CustomerContext,
  amounts: Readonly<{
    net: number;
    vat: number;
    gross: number;
    priceBasis: "NET" | "GROSS";
  }>,
): Promise<CommercialGraph> {
  const graphToken = hexadecimalToken();
  const graph: CommercialGraph = {
    requestId: randomUUID(),
    requestItemId: randomUUID(),
    estimateId: randomUUID(),
    quoteId: randomUUID(),
    quoteItemId: randomUUID(),
    acceptanceId: randomUUID(),
    bookingId: randomUUID(),
    bookingItemId: randomUUID(),
    bookingReference: `BKG-${graphToken}`,
    quoteReference: `Q-${graphToken}`,
    netAmountMinorUnits: amounts.net,
    vatAmountMinorUnits: amounts.vat,
    grossAmountMinorUnits: amounts.gross,
    priceBasis: amounts.priceBasis,
  };
  const commercialSnapshot = JSON.stringify({
    source: "PHASE_3H_TRANSACTIONAL_INTEGRATION",
    presentationBasis: amounts.priceBasis,
  });
  const termsSnapshot = JSON.stringify({ termsCode: "SYNTHETIC_PHASE_3H" });
  const durationSnapshot = JSON.stringify({ quotedDurationMinutes: 60 });
  const priceSnapshot = JSON.stringify({
    netAmountMinorUnits: amounts.net,
    vatRateBasisPoints: 2000,
    vatAmountMinorUnits: amounts.vat,
    grossTotalMinorUnits: amounts.gross,
    currency: "EUR",
  });

  const result = await database.execute<{
    booking_id: string;
    booking_item_count: number;
  }>(sql`
    with model_authority as materialized (
      select price_book.id as price_book_id,
        price_book.code as price_book_code,
        price_book.version as price_book_version,
        duration_model.id as duration_model_id,
        duration_model.code as duration_model_code,
        duration_model.version as duration_model_version,
        catalog.service_id,
        catalog.cleaning_item_type_id,
        catalog.measurement_mode_id
      from public.price_books price_book
      cross join public.duration_models duration_model
      cross join lateral (
        select service.id as service_id,
          item_type.id as cleaning_item_type_id,
          mode.id as measurement_mode_id
        from public.services service
        join public.cleaning_item_types item_type
          on item_type.category_id = service.category_id
        join public.cleaning_item_type_measurement_modes item_mode
          on item_mode.item_type_id = item_type.id
        join public.measurement_modes mode
          on mode.id = item_mode.measurement_mode_id
        order by service.id, item_type.id, mode.id
        limit 1
      ) catalog
      order by price_book.id, duration_model.id,
        catalog.service_id, catalog.cleaning_item_type_id,
        catalog.measurement_mode_id
      limit 1
    ),
    inserted_request as (
      insert into public.service_requests (
        id, request_reference, source, customer_resolution_status,
        customer_id, property_id, status, preferred_locale, contact_name,
        contact_phone, preferred_date, original_submission,
        manual_review_required, created_by_profile_id
      ) values (
        ${graph.requestId}::uuid, ${`REQ-${graphToken}`},
        'STAFF_CREATED', 'LINKED', ${customer.customerId}::uuid,
        ${customer.propertyId}::uuid, 'QUOTED', 'en',
        'Phase 3H integration customer', '0000000000', '2026-09-15',
        '{"phase":"3H_TRANSACTIONAL_INTEGRATION"}'::jsonb, false,
        ${fixture.ownerProfileId}::uuid
      )
      returning id
    ),
    inserted_request_item as (
      insert into public.service_request_items (
        id, request_id, service_id, cleaning_item_type_id,
        measurement_mode_id, customer_description,
        normalized_description, quantity, sort_order, version,
        created_by_profile_id
      )
      select ${graph.requestItemId}::uuid, inserted_request.id,
        model_authority.service_id,
        model_authority.cleaning_item_type_id,
        model_authority.measurement_mode_id,
        'Synthetic integration service',
        'Synthetic integration service', 1, 0, 1,
        ${fixture.ownerProfileId}::uuid
      from inserted_request cross join model_authority
      returning id, request_id, service_id, cleaning_item_type_id,
        measurement_mode_id
    ),
    inserted_estimate as (
      insert into public.request_estimates (
        id, request_id, source_request_version, estimate_version, status,
        price_book_id, price_book_code, price_book_version,
        duration_model_id, duration_model_code, duration_model_version,
        input_snapshot, price_snapshot, duration_snapshot,
        availability_snapshot, net_amount_minor_units,
        vat_rate_basis_points, vat_amount_minor_units,
        gross_total_minor_units, currency, estimated_service_minutes,
        estimated_travel_minutes, manual_assessment_required,
        decline_or_refer_required, calculated_by_profile_id
      )
      select ${graph.estimateId}::uuid, inserted_request.id, 1, 1,
        'CALCULATED', model_authority.price_book_id,
        model_authority.price_book_code, model_authority.price_book_version,
        model_authority.duration_model_id, model_authority.duration_model_code,
        model_authority.duration_model_version, '{}'::jsonb,
        ${priceSnapshot}::jsonb, ${durationSnapshot}::jsonb, '{}'::jsonb,
        ${amounts.net}, 2000, ${amounts.vat}, ${amounts.gross}, 'EUR',
        60, 0, false, false, ${fixture.ownerProfileId}::uuid
      from inserted_request
      cross join inserted_request_item
      cross join model_authority
      returning id, request_id
    ),
    inserted_quote as (
      insert into public.quotes (
        id, quote_reference, request_id, source_request_version,
        customer_id, property_id, estimate_id, quote_version,
        record_version, status, currency, price_basis,
        net_amount_minor_units, vat_rate_basis_points,
        vat_amount_minor_units, gross_total_minor_units,
        estimated_duration_minutes, commercial_snapshot, terms_snapshot,
        acceptance_source_snapshot, valid_from, valid_until, issued_at,
        created_by_profile_id
      )
      select ${graph.quoteId}::uuid, ${graph.quoteReference},
        inserted_request.id, 1, ${customer.customerId}::uuid,
        ${customer.propertyId}::uuid, inserted_estimate.id, 1, 1,
        'ISSUED', 'EUR', ${amounts.priceBasis}, ${amounts.net}, 2000,
        ${amounts.vat}, ${amounts.gross}, 60,
        ${commercialSnapshot}::jsonb, ${termsSnapshot}::jsonb,
        '{"source":"STAFF_RECORDED"}'::jsonb,
        now() - interval '1 hour', now() + interval '30 days', now(),
        ${fixture.ownerProfileId}::uuid
      from inserted_request cross join inserted_estimate
      returning id, request_id, customer_id, property_id
    ),
    inserted_quote_item as (
      insert into public.quote_items (
        id, quote_id, request_item_id, service_id,
        cleaning_item_type_id, measurement_mode_id,
        description_bg, description_en, quantity,
        measurement_snapshot, base_amount_minor_units,
        modifier_amount_minor_units, addon_amount_minor_units,
        net_amount_minor_units, vat_rate_basis_points,
        vat_amount_minor_units, gross_total_minor_units,
        calculation_snapshot, sort_order
      )
      select ${graph.quoteItemId}::uuid, inserted_quote.id,
        inserted_request_item.id, inserted_request_item.service_id,
        inserted_request_item.cleaning_item_type_id,
        inserted_request_item.measurement_mode_id,
        'Синтетична интеграционна услуга',
        'Synthetic integration service', 1,
        '{"quantity":1}'::jsonb, ${amounts.net}, 0, 0,
        ${amounts.net}, 2000, ${amounts.vat}, ${amounts.gross},
        ${priceSnapshot}::jsonb, 0
      from inserted_quote cross join inserted_request_item
      returning id, request_item_id, service_id, cleaning_item_type_id,
        measurement_mode_id
    ),
    inserted_acceptance as (
      insert into public.quote_acceptances (
        id, quote_id, quote_version, quote_record_version, request_id,
        source_request_version, customer_id, property_id,
        accepted_by_profile_id, actor_type, acceptance_source,
        acceptance_note, commercial_snapshot, terms_snapshot,
        pricing_snapshot, duration_snapshot, provenance_snapshot
      )
      select ${graph.acceptanceId}::uuid, inserted_quote.id, 1, 1,
        inserted_quote.request_id, 1, inserted_quote.customer_id,
        inserted_quote.property_id, ${fixture.ownerProfileId}::uuid,
        'STAFF_ON_BEHALF', 'PHONE',
        'Synthetic Phase 3H integration acceptance',
        ${commercialSnapshot}::jsonb, ${termsSnapshot}::jsonb,
        ${priceSnapshot}::jsonb, ${durationSnapshot}::jsonb,
        '{"quoteSourceSnapshotMatched":true,
          "requestSourceSnapshotMatched":true,
          "requestNormalizationPreserved":true}'::jsonb
      from inserted_quote
      returning id, quote_id, request_id, customer_id, property_id
    ),
    inserted_booking as (
      insert into public.bookings (
        id, booking_reference, request_id, quote_id, quote_acceptance_id,
        customer_id, property_id, status, scheduling_status,
        preferred_date, price_snapshot, duration_snapshot,
        scheduling_snapshot, customer_snapshot, property_snapshot,
        version, created_by_profile_id
      )
      select ${graph.bookingId}::uuid, ${graph.bookingReference},
        inserted_acceptance.request_id, inserted_acceptance.quote_id,
        inserted_acceptance.id, inserted_acceptance.customer_id,
        inserted_acceptance.property_id, 'PENDING_SCHEDULING',
        'UNSCHEDULED', '2026-09-15', ${priceSnapshot}::jsonb,
        ${durationSnapshot}::jsonb, '{}'::jsonb,
        jsonb_build_object('customerType', ${customer.customerType}::text),
        '{"label":"Phase 3H synthetic property",
          "city":"Sofia","district":"Centre",
          "streetAddress":"Synthetic integration address",
          "postalCode":"1000","travelZoneCode":"SOFIA_CORE",
          "accessNotes":"Synthetic integration access only"}'::jsonb,
        1, ${fixture.ownerProfileId}::uuid
      from inserted_acceptance
      returning id
    ),
    inserted_booking_item as (
      insert into public.booking_items (
        id, booking_id, quote_item_id, request_item_id, service_id,
        cleaning_item_type_id, measurement_mode_id,
        description_bg, description_en,
        quantity, measurement_snapshot, base_amount_minor_units,
        modifier_amount_minor_units, addon_amount_minor_units,
        net_amount_minor_units, vat_rate_basis_points,
        vat_amount_minor_units, gross_total_minor_units,
        calculation_snapshot, duration_basis_snapshot, sort_order
      )
      select ${graph.bookingItemId}::uuid, inserted_booking.id,
        inserted_quote_item.id, inserted_quote_item.request_item_id,
        inserted_quote_item.service_id,
        inserted_quote_item.cleaning_item_type_id,
        inserted_quote_item.measurement_mode_id,
        'Синтетична интеграционна услуга',
        'Synthetic integration service', 1, '{"quantity":1}'::jsonb,
        ${amounts.net}, 0, 0, ${amounts.net}, 2000,
        ${amounts.vat}, ${amounts.gross}, ${priceSnapshot}::jsonb,
        ${durationSnapshot}::jsonb, 0
      from inserted_booking cross join inserted_quote_item
      returning booking_id
    )
    select inserted_booking.id as booking_id,
      (select count(*) from inserted_booking_item)::integer
        as booking_item_count
    from inserted_booking
  `);

  expect(result.rows).toEqual([
    { booking_id: graph.bookingId, booking_item_count: 1 },
  ]);
  return graph;
}

async function createFinanceFixture(database: Database): Promise<FinanceFixture> {
  const token = hexadecimalToken();
  const fixture = {
    token,
    ownerProfileId: randomUUID(),
    technicianProfileId: randomUUID(),
    customerProfileId: randomUUID(),
    sellerProfileId: randomUUID(),
    numberingPolicyId: -1_000_000_000 - Number.parseInt(token.slice(0, 6), 16),
    invoicePolicyId: -1_100_000_000 - Number.parseInt(token.slice(6, 12), 16),
    jobInvoicePolicyId:
      -1_200_000_000 - Number.parseInt(token.slice(12, 18), 16),
  } as Omit<FinanceFixture,
    | "individual"
    | "business"
    | "individualPrimary"
    | "individualSecondary"
    | "individualDeferred"
    | "businessPrimary"
  >;

  const existing = await database.execute<{ count: number }>(sql`
    select (
      (select count(*) from public.business_legal_profiles
        where environment_scope = 'DEVELOPMENT') +
      (select count(*) from public.invoice_numbering_policies
        where environment_scope = 'DEVELOPMENT') +
      (select count(*) from public.invoice_policies
        where environment_scope = 'DEVELOPMENT') +
      (select count(*) from public.invoices
        where environment_scope = 'DEVELOPMENT')
    )::integer as count
  `);
  expect(existing.rows).toEqual([{ count: 0 }]);

  const authority = await database.execute<{ role_count: number }>(sql`
    with inserted_profiles as (
      insert into public.user_profiles (
        id, auth_provider_user_id, display_name, preferred_locale, status
      ) values
        (${fixture.ownerProfileId}::uuid,
          ${`phase3h-owner-${token.toLowerCase()}`},
          'Phase 3H integration owner', 'en', 'ACTIVE'),
        (${fixture.technicianProfileId}::uuid,
          ${`phase3h-technician-${token.toLowerCase()}`},
          'Phase 3H integration technician', 'en', 'ACTIVE'),
        (${fixture.customerProfileId}::uuid,
          ${`phase3h-customer-${token.toLowerCase()}`},
          'Phase 3H integration customer identity', 'en', 'ACTIVE')
      returning id
    ),
    inserted_roles as (
      insert into public.user_roles (
        user_profile_id, role_id, active, assignment_source
      )
      select profile.id, role.id, true, 'OWNER_BOOTSTRAP'
      from inserted_profiles profile
      join public.application_roles role on role.code = case profile.id
        when ${fixture.ownerProfileId}::uuid then 'OWNER'
        when ${fixture.technicianProfileId}::uuid then 'TECHNICIAN'
        else 'CUSTOMER' end
      where role.active = true
      returning role_id
    )
    select count(*)::integer as role_count from inserted_roles
  `);
  expect(authority.rows).toEqual([{ role_count: 3 }]);

  await database.execute(sql`
    insert into public.business_legal_profiles (
      id, code, version, environment_scope, status, legal_name,
      registration_number, vat_number, vat_registration_status,
      registered_address_line_1, registered_city,
      registered_country_code, contact_email,
      customer_visible_payment_instructions, approved_at,
      approved_by_profile_id, created_by_profile_id
    ) values (
      ${fixture.sellerProfileId}::uuid,
      ${`PHASE3H_SELLER_${token}`}, 1, 'DEVELOPMENT', 'APPROVED',
      'Phase 3H Synthetic Development Seller', ${`SYN-${token}`},
      ${`BG-SYN-${token}`}, 'VAT_REGISTERED',
      'Synthetic development address', 'Sofia', 'BG',
      ${`phase3h-seller-${token.toLowerCase()}@example.invalid`},
      'Synthetic development payment instructions only', now(),
      ${fixture.ownerProfileId}::uuid, ${fixture.ownerProfileId}::uuid
    )
  `);
  await database.execute(sql`
    insert into public.invoice_numbering_policies (
      id, code, version, environment_scope, document_type, status,
      prefix, padding_width, next_sequence, provisional, approved_at,
      approved_by_profile_id, created_by_profile_id
    ) overriding system value values (
      ${fixture.numberingPolicyId}, ${`PHASE3H_NUMBERING_${token}`}, 1,
      'DEVELOPMENT', 'STANDARD', 'APPROVED',
      ${`DEV3H-${token.slice(0, 6)}-`}, 6, 1, true, now(),
      ${fixture.ownerProfileId}::uuid, ${fixture.ownerProfileId}::uuid
    )
  `);
  await database.execute(sql`
    insert into public.invoice_policies (
      id, code, version, environment_scope, status, draft_eligibility,
      issue_eligibility, payment_terms, default_due_days, currency,
      numbering_policy_id, seller_legal_profile_id, provisional,
      approved_at, approved_by_profile_id, created_by_profile_id
    ) overriding system value values (
      ${fixture.invoicePolicyId}, ${`PHASE3H_POLICY_${token}`}, 1,
      'DEVELOPMENT', 'APPROVED', 'BOOKING_ACCEPTED',
      'BOOKING_ACCEPTED', 'PAY_ON_INVOICE', 14, 'EUR',
      ${fixture.numberingPolicyId}, ${fixture.sellerProfileId}::uuid,
      true, now(), ${fixture.ownerProfileId}::uuid,
      ${fixture.ownerProfileId}::uuid
    )
  `);

  const individual = await createCustomerContext(
    database,
    fixture as FinanceFixture,
    "INDIVIDUAL",
  );
  const business = await createCustomerContext(
    database,
    fixture as FinanceFixture,
    "BUSINESS",
  );
  await database.execute(sql`
    insert into public.customer_identity_links (
      user_profile_id, customer_id, relationship_type, active,
      created_by_profile_id
    ) values (
      ${fixture.customerProfileId}::uuid, ${individual.customerId}::uuid,
      'OWNER', true, ${fixture.ownerProfileId}::uuid
    )
  `);

  const individualPrimary = await createCommercialGraph(
    database,
    fixture as FinanceFixture,
    individual,
    { net: 10_000, vat: 2_000, gross: 12_000, priceBasis: "GROSS" },
  );
  const individualSecondary = await createCommercialGraph(
    database,
    fixture as FinanceFixture,
    individual,
    { net: 5_000, vat: 1_000, gross: 6_000, priceBasis: "GROSS" },
  );
  const individualDeferred = await createCommercialGraph(
    database,
    fixture as FinanceFixture,
    individual,
    { net: 7_500, vat: 1_500, gross: 9_000, priceBasis: "GROSS" },
  );
  const businessPrimary = await createCommercialGraph(
    database,
    fixture as FinanceFixture,
    business,
    { net: 20_000, vat: 4_000, gross: 24_000, priceBasis: "NET" },
  );

  return {
    ...fixture,
    individual,
    business,
    individualPrimary,
    individualSecondary,
    individualDeferred,
    businessPrimary,
  };
}

type PreparedJob = Readonly<{
  jobId: string;
  jobItemId: string;
  jobReference: string;
}>;

async function activateJobCompletionInvoicePolicy(
  database: Database,
  fixture: FinanceFixture,
  draftEligibility: "BOOKING_ACCEPTED" | "JOB_COMPLETED" = "BOOKING_ACCEPTED",
): Promise<void> {
  const superseded = await database.execute<{ id: number }>(sql`
    update public.invoice_policies
    set status = 'SUPERSEDED', superseded_at = now(), updated_at = now(),
      updated_by_profile_id = ${fixture.ownerProfileId}::uuid
    where id = ${fixture.invoicePolicyId}
      and status = 'APPROVED'
    returning id
  `);
  expect(superseded.rows).toEqual([{ id: fixture.invoicePolicyId }]);

  const inserted = await database.execute<{ id: number }>(sql`
    insert into public.invoice_policies (
      id, code, version, environment_scope, status, draft_eligibility,
      issue_eligibility, payment_terms, default_due_days, currency,
      numbering_policy_id, seller_legal_profile_id, provisional,
      approved_at, approved_by_profile_id, created_by_profile_id
    ) overriding system value values (
      ${fixture.jobInvoicePolicyId},
      ${`PHASE3H_JOB_POLICY_${fixture.token}`}, 1,
      'DEVELOPMENT', 'APPROVED', ${draftEligibility}, 'JOB_COMPLETED',
      'PAY_ON_INVOICE', 14, 'EUR', ${fixture.numberingPolicyId},
      ${fixture.sellerProfileId}::uuid, true, now(),
      ${fixture.ownerProfileId}::uuid, ${fixture.ownerProfileId}::uuid
    )
    returning id
  `);
  expect(inserted.rows).toEqual([{ id: fixture.jobInvoicePolicyId }]);
}

async function createPreparedJob(
  database: Database,
  fixture: FinanceFixture,
  graph: CommercialGraph,
): Promise<PreparedJob> {
  const jobId = randomUUID();
  const jobItemId = randomUUID();
  const occupancyId = randomUUID();
  const jobReference = `JOB-${hexadecimalToken()}`;
  const workingHourPolicyId =
    -1_300_000_000 - Number.parseInt(fixture.token.slice(0, 6), 16);
  const operationsTeamId =
    -1_400_000_000 - Number.parseInt(fixture.token.slice(6, 12), 16);
  const travelTimeProfileId =
    -1_500_000_000 - Number.parseInt(fixture.token.slice(12, 18), 16);

  await database.execute(sql`
    insert into public.working_hour_policies (
      id, code, name, market, time_zone, version, status,
      provisional, active
    ) overriding system value values (
      ${workingHourPolicyId}, ${`PHASE3H_HOURS_${fixture.token}`},
      'Phase 3H synthetic working hours', 'SOFIA', 'Europe/Sofia',
      1, 'ACTIVE', true, true
    )
  `);
  await database.execute(sql`
    insert into public.operations_teams (
      id, code, name, active, default_crew_size, working_hour_policy_id
    ) overriding system value values (
      ${operationsTeamId}, ${`PHASE3H_TEAM_${fixture.token}`},
      'Phase 3H synthetic operations team', true, 1,
      ${workingHourPolicyId}
    )
  `);
  await database.execute(sql`
    insert into public.travel_time_profiles (
      id, code, name, market, version, status, default_travel_minutes,
      inter_job_buffer_minutes, provisional, active
    ) overriding system value values (
      ${travelTimeProfileId}, ${`PHASE3H_TRAVEL_${fixture.token}`},
      'Phase 3H synthetic travel profile', 'SOFIA', 1, 'ACTIVE',
      15, 10, true, true
    )
  `);
  await database.execute(sql`
    insert into public.booking_occupancies (
      id, booking_id, snapshot_version, revision_kind, team_id,
      service_start, service_end, operational_start, operational_end,
      time_zone, status, service_duration_minutes,
      scheduling_policy_code, scheduling_policy_version,
      working_hour_policy_id, working_hour_policy_code,
      working_hour_policy_version, travel_time_profile_id,
      travel_time_profile_code, travel_time_profile_version,
      duration_snapshot, location_snapshot, requirements_snapshot,
      availability_input_snapshot, availability_result_snapshot,
      travel_snapshot, working_hours_snapshot, equipment_snapshot,
      created_by_profile_id
    ) values (
      ${occupancyId}::uuid, ${graph.bookingId}::uuid, 1, 'INITIAL',
      ${operationsTeamId}, '2026-09-15 10:00:00+03'::timestamptz,
      '2026-09-15 11:00:00+03'::timestamptz,
      '2026-09-15 09:45:00+03'::timestamptz,
      '2026-09-15 11:15:00+03'::timestamptz,
      'Europe/Sofia', 'CONFIRMED', 60, 'PHASE3H_SYNTHETIC', 1,
      ${workingHourPolicyId}, ${`PHASE3H_HOURS_${fixture.token}`}, 1,
      ${travelTimeProfileId}, ${`PHASE3H_TRAVEL_${fixture.token}`}, 1,
      '{"durationMinutes":60}'::jsonb,
      '{"city":"Sofia"}'::jsonb, '{}'::jsonb, '{}'::jsonb,
      '{"available":true}'::jsonb, '{"minutes":15}'::jsonb,
      '{}'::jsonb, '{}'::jsonb, ${fixture.ownerProfileId}::uuid
    )
  `);
  const prepared = await database.execute<{
    job_id: string;
    job_item_count: number;
  }>(sql`
    with inserted_job as (
      insert into public.jobs (
        id, job_reference, booking_id, source_booking_version,
        source_occupancy_id, source_occupancy_snapshot_version,
        customer_id, property_id, assigned_team_id, status,
        scheduled_start_snapshot, scheduled_end_snapshot,
        planned_service_duration_minutes, planned_team_size,
        source_provenance_snapshot, scheduling_snapshot,
        planned_duration_snapshot, property_access_snapshot,
        created_by_profile_id
      ) values (
        ${jobId}::uuid, ${jobReference}, ${graph.bookingId}::uuid, 1,
        ${occupancyId}::uuid, 1, ${fixture.individual.customerId}::uuid,
        ${fixture.individual.propertyId}::uuid, ${operationsTeamId},
        'PREPARED', '2026-09-15 10:00:00+03'::timestamptz,
        '2026-09-15 11:00:00+03'::timestamptz, 60, 1,
        '{"source":"PHASE_3H_TRANSACTIONAL_INTEGRATION"}'::jsonb,
        '{"occupancySnapshotVersion":1}'::jsonb,
        '{"plannedServiceDurationMinutes":60}'::jsonb,
        '{"access":"synthetic"}'::jsonb,
        ${fixture.ownerProfileId}::uuid
      )
      returning id, booking_id, property_id
    ),
    inserted_job_item as (
      insert into public.job_items (
        id, job_id, booking_id, property_id, booking_item_id,
        source_request_item_id, source_request_item_version,
        service_id, cleaning_item_type_id, measurement_mode_id,
        customer_visible_description_bg,
        customer_visible_description_en,
        customer_description_snapshot,
        staff_normalized_description_snapshot, quantity,
        planned_measurement_snapshot,
        planned_treatment_assumptions_snapshot, source_scope_snapshot,
        status, sort_order, version
      )
      select ${jobItemId}::uuid, inserted_job.id,
        inserted_job.booking_id, inserted_job.property_id,
        booking_item.id, request_item.id, request_item.version,
        booking_item.service_id, booking_item.cleaning_item_type_id,
        booking_item.measurement_mode_id, booking_item.description_bg,
        booking_item.description_en, request_item.customer_description,
        request_item.normalized_description, booking_item.quantity,
        booking_item.measurement_snapshot,
        '{"source":"BOOKING_ITEM"}'::jsonb,
        jsonb_build_object(
          'bookingItemId', booking_item.id,
          'requestItemId', request_item.id
        ),
        'PENDING_INSPECTION', booking_item.sort_order, 1
      from inserted_job
      join public.booking_items booking_item
        on booking_item.booking_id = inserted_job.booking_id
      join public.service_request_items request_item
        on request_item.id = booking_item.request_item_id
      returning job_id
    )
    select inserted_job.id as job_id,
      (select count(*) from inserted_job_item)::integer as job_item_count
    from inserted_job
  `);
  expect(prepared.rows).toEqual([{ job_id: jobId, job_item_count: 1 }]);

  return { jobId, jobItemId, jobReference };
}

async function completePreparedJob(
  database: Database,
  fixture: FinanceFixture,
  job: PreparedJob,
): Promise<void> {
  const item = await database.execute<{ id: string }>(sql`
    update public.job_items
    set status = 'COMPLETED', version = version + 1, updated_at = now()
    where id = ${job.jobItemId}::uuid
      and job_id = ${job.jobId}::uuid
      and status = 'PENDING_INSPECTION'
    returning id
  `);
  expect(item.rows).toEqual([{ id: job.jobItemId }]);

  const completed = await database.execute<{ id: string }>(sql`
    update public.jobs
    set status = 'COMPLETED',
      en_route_at = '2026-09-15 09:30:00+03'::timestamptz,
      arrived_at = '2026-09-15 09:50:00+03'::timestamptz,
      started_at = '2026-09-15 10:00:00+03'::timestamptz,
      completed_at = '2026-09-15 11:00:00+03'::timestamptz,
      actual_productive_minutes = 60,
      actual_occupied_team_minutes = 60,
      internal_completion_notes = 'Synthetic Phase 3H completion',
      customer_visible_completion_notes = 'Synthetic completion',
      completion_snapshot = '{"source":"PHASE_3H_INTEGRATION"}'::jsonb,
      completed_by_profile_id = ${fixture.ownerProfileId}::uuid,
      updated_by_profile_id = ${fixture.ownerProfileId}::uuid,
      version = version + 1, updated_at = now()
    where id = ${job.jobId}::uuid and status = 'PREPARED'
    returning id
  `);
  expect(completed.rows).toEqual([{ id: job.jobId }]);
}

function invoiceReference(): string {
  return `INV-${hexadecimalToken()}`;
}

function paymentReference(): string {
  return `PAY-${hexadecimalToken()}`;
}

function errorChain(error: unknown): readonly object[] {
  const chain: object[] = [];
  const visited = new Set<object>();
  let current = error;

  while (
    typeof current === "object" &&
    current !== null &&
    !visited.has(current)
  ) {
    chain.push(current);
    visited.add(current);
    current = "cause" in current ? current.cause : undefined;
  }

  return chain;
}

function errorCode(error: unknown): string | undefined {
  for (const candidate of errorChain(error)) {
    if ("code" in candidate && candidate.code !== undefined) {
      return String(candidate.code);
    }
  }
  return undefined;
}

function errorMessages(error: unknown): readonly string[] {
  return errorChain(error).flatMap((candidate) =>
    "message" in candidate && typeof candidate.message === "string"
      ? [candidate.message]
      : [],
  );
}

async function expectDatabaseRejection(
  task: () => Promise<unknown>,
  expectedCode?: string,
  expectedMessage?: string,
): Promise<void> {
  let captured: unknown;
  try {
    await task();
  } catch (error) {
    captured = error;
  }
  expect(captured).toBeDefined();
  if (expectedCode) expect(errorCode(captured)).toBe(expectedCode);
  if (expectedMessage) {
    expect(
      errorMessages(captured).some((message) =>
        message.includes(expectedMessage),
      ),
    ).toBe(true);
  }
}

async function validateDeferredConstraints(database: Database): Promise<void> {
  await database.execute(sql`set constraints all immediate`);
  await database.execute(sql`set constraints all deferred`);
}

describe.skipIf(!runLiveIntegration)(
  "Phase 3H PostgreSQL finance lifecycle",
  () => {
    it(
      "preserves commercial/VAT provenance and rolls back settlement fixtures",
      async () => {
        loadMigrationEnvironment();
        assertDevelopmentDatabaseMutationTarget();

        const stateful = neonDrizzle({
          connection: getDatabaseUrl(),
          schema,
          ws: globalThis.WebSocket,
        });
        let fixture: FinanceFixture | undefined;

        try {
          await stateful.transaction(async (transaction) => {
            const database = addTransactionalBatch(transaction);
            fixture = await createFinanceFixture(database);

            const individualInvoiceReference = invoiceReference();
            const secondaryInvoiceReference = invoiceReference();
            const businessInvoiceReference = invoiceReference();

            await expect(
              createInvoiceDraftRecord(
                database,
                fixture.technicianProfileId,
                {
                  bookingReference:
                    fixture.individualPrimary.bookingReference,
                  invoiceReference: invoiceReference(),
                  customerVisibleNote: null,
                  internalNote: null,
                  manualAdjustmentRequested: false,
                  environmentScope: "DEVELOPMENT",
                },
              ),
            ).resolves.toEqual({ status: "NOT_FOUND_OR_FORBIDDEN" });

            const draftInputs = [
              {
                graph: fixture.individualPrimary,
                invoiceReference: individualInvoiceReference,
                customerVisibleNote: "Synthetic customer-visible note",
                internalNote: "Synthetic staff-only note",
              },
              {
                graph: fixture.individualSecondary,
                invoiceReference: secondaryInvoiceReference,
                customerVisibleNote: null,
                internalNote: null,
              },
              {
                graph: fixture.businessPrimary,
                invoiceReference: businessInvoiceReference,
                customerVisibleNote: null,
                internalNote: null,
              },
            ] as const;
            for (const input of draftInputs) {
              await expect(
                createInvoiceDraftRecord(database, fixture.ownerProfileId, {
                  bookingReference: input.graph.bookingReference,
                  invoiceReference: input.invoiceReference,
                  customerVisibleNote: input.customerVisibleNote,
                  internalNote: input.internalNote,
                  manualAdjustmentRequested: false,
                  environmentScope: "DEVELOPMENT",
                }),
              ).resolves.toEqual({
                status: "CREATED",
                invoiceReference: input.invoiceReference,
                invoiceNumber: undefined,
                paymentReference: undefined,
              });
              await validateDeferredConstraints(database);
            }

            const drafts = await database.execute<{
              invoice_reference: string;
              status: string;
              price_basis: string;
              net_amount_minor_units: number;
              vat_rate_basis_points: number;
              vat_amount_minor_units: number;
              gross_total_minor_units: number;
              line_net: number;
              line_vat: number;
              line_gross: number;
              customer_type: string;
              company_registration_number: string | null;
              vat_number_status: string;
            }>(sql`
              select invoice.invoice_reference, invoice.status,
                invoice.price_basis, invoice.net_amount_minor_units,
                invoice.vat_rate_basis_points,
                invoice.vat_amount_minor_units,
                invoice.gross_total_minor_units,
                sum(item.net_amount_minor_units)::integer as line_net,
                sum(item.vat_amount_minor_units)::integer as line_vat,
                sum(item.gross_total_minor_units)::integer as line_gross,
                invoice.customer_snapshot ->> 'customerType' as customer_type,
                invoice.customer_snapshot ->> 'companyRegistrationNumber'
                  as company_registration_number,
                invoice.customer_snapshot ->> 'vatNumberStatus'
                  as vat_number_status
              from public.invoices invoice
              join public.invoice_items item on item.invoice_id = invoice.id
              where invoice.invoice_reference in (
                ${individualInvoiceReference}, ${businessInvoiceReference}
              )
              group by invoice.id
              order by invoice.invoice_reference
            `);
            expect(drafts.rows).toEqual(
              expect.arrayContaining([
                expect.objectContaining({
                  invoice_reference: individualInvoiceReference,
                  status: "READY_TO_ISSUE",
                  price_basis: "GROSS",
                  net_amount_minor_units: 10_000,
                  vat_rate_basis_points: 2_000,
                  vat_amount_minor_units: 2_000,
                  gross_total_minor_units: 12_000,
                  line_net: 10_000,
                  line_vat: 2_000,
                  line_gross: 12_000,
                  customer_type: "INDIVIDUAL",
                  company_registration_number: null,
                  vat_number_status: "NOT_APPLICABLE",
                }),
                expect.objectContaining({
                  invoice_reference: businessInvoiceReference,
                  status: "READY_TO_ISSUE",
                  price_basis: "NET",
                  net_amount_minor_units: 20_000,
                  vat_rate_basis_points: 2_000,
                  vat_amount_minor_units: 4_000,
                  gross_total_minor_units: 24_000,
                  line_net: 20_000,
                  line_vat: 4_000,
                  line_gross: 24_000,
                  customer_type: "BUSINESS",
                  company_registration_number: `SYN-${fixture.token}`,
                  vat_number_status: "VERIFIED_FUTURE",
                }),
              ]),
            );

            const issueResults = [];
            for (const reference of [
              individualInvoiceReference,
              secondaryInvoiceReference,
              businessInvoiceReference,
            ]) {
              issueResults.push(
                await issueInvoiceRecord(database, fixture.ownerProfileId, {
                  invoiceReference: reference,
                  expectedVersion: 1,
                  issueConfirmed: true,
                  environmentScope: "DEVELOPMENT",
                }),
              );
              await validateDeferredConstraints(database);
            }
            expect(issueResults.every((result) => result.status === "ISSUED"))
              .toBe(true);
            const issuedNumbers = issueResults.map((result) =>
              "invoiceNumber" in result ? result.invoiceNumber : undefined,
            );
            expect(new Set(issuedNumbers).size).toBe(3);
            expect(issuedNumbers).toEqual([
              `DEV3H-${fixture.token.slice(0, 6)}-000001`,
              `DEV3H-${fixture.token.slice(0, 6)}-000002`,
              `DEV3H-${fixture.token.slice(0, 6)}-000003`,
            ]);
            const numberingProtection = await database.execute<{
              indexname: string;
            }>(sql`
              select indexname
              from pg_indexes
              where schemaname = 'public'
                and indexname in (
                  'invoices_number_unique',
                  'invoices_numbering_sequence_unique'
                )
              order by indexname
            `);
            expect(numberingProtection.rows.map((row) => row.indexname)).toEqual([
              "invoices_number_unique",
              "invoices_numbering_sequence_unique",
            ]);
            await expect(
              issueInvoiceRecord(database, fixture.ownerProfileId, {
                invoiceReference: individualInvoiceReference,
                expectedVersion: 1,
                issueConfirmed: true,
                environmentScope: "DEVELOPMENT",
              }),
            ).resolves.toMatchObject({
              status: "EXISTING",
              invoiceNumber: issuedNumbers[0],
            });

            const ownInvoice = await getCustomerInvoiceRecord(
              database,
              fixture.customerProfileId,
              individualInvoiceReference,
              "2026-09-15",
            );
            expect(ownInvoice).toMatchObject({
              invoiceReference: individualInvoiceReference,
              customerVisibleNote: "Synthetic customer-visible note",
              grossAmountMinorUnits: 12_000,
              paidAmountMinorUnits: 0,
            });
            expect(ownInvoice).not.toHaveProperty("internalNote");
            await expect(
              getCustomerInvoiceRecord(
                database,
                fixture.customerProfileId,
                businessInvoiceReference,
                "2026-09-15",
              ),
            ).resolves.toBeNull();
            await expect(
              listCustomerInvoicesRecord(
                database,
                fixture.customerProfileId,
                "2026-09-15",
              ),
            ).resolves.toHaveLength(2);
            await expect(
              getStaffInvoiceRecord(
                database,
                fixture.technicianProfileId,
                individualInvoiceReference,
                "2026-09-15",
              ),
            ).resolves.toBeNull();

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    update public.invoices
                    set customer_snapshot = '{}'::jsonb
                    where invoice_reference = ${individualInvoiceReference}
                  `);
                }),
            );

            const recordedPaymentReference = paymentReference();
            const recordingIdempotencyKey = randomUUID();
            const paymentInput = {
              invoiceReference: individualInvoiceReference,
              paymentReference: recordedPaymentReference,
              amountMinorUnits: 13_000,
              method: "BANK_TRANSFER" as const,
              receivedAt: new Date("2026-08-20T09:00:00.000Z"),
              externalReference: "SYNTHETIC-EXTERNAL-REFERENCE",
              internalNote: "Synthetic payment integration note",
              idempotencyKey: recordingIdempotencyKey,
            };
            await expect(
              recordPaymentRecord(
                database,
                fixture.technicianProfileId,
                paymentInput,
              ),
            ).resolves.toEqual({ status: "NOT_FOUND_OR_FORBIDDEN" });
            await expect(
              recordPaymentRecord(database, fixture.ownerProfileId, paymentInput),
            ).resolves.toMatchObject({
              status: "CREATED",
              paymentReference: recordedPaymentReference,
            });
            await validateDeferredConstraints(database);
            await expect(
              recordPaymentRecord(database, fixture.ownerProfileId, paymentInput),
            ).resolves.toMatchObject({
              status: "EXISTING",
              paymentReference: recordedPaymentReference,
            });
            await expect(
              recordPaymentRecord(database, fixture.ownerProfileId, {
                ...paymentInput,
                amountMinorUnits: 12_999,
              }),
            ).resolves.toEqual({ status: "IDEMPOTENCY_CONFLICT" });
            await expect(
              confirmPaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                expectedVersion: 99,
                evidenceConfirmed: true,
              }),
            ).resolves.toEqual({ status: "CONFLICT" });
            await expect(
              confirmPaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                expectedVersion: 1,
                evidenceConfirmed: true,
              }),
            ).resolves.toMatchObject({ status: "UPDATED" });
            await validateDeferredConstraints(database);

            const partialAllocationKey = randomUUID();
            await expect(
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                invoiceReference: individualInvoiceReference,
                amountMinorUnits: 5_000,
                idempotencyKey: partialAllocationKey,
              }),
            ).resolves.toMatchObject({ status: "UPDATED" });
            await expect(
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                invoiceReference: individualInvoiceReference,
                amountMinorUnits: 5_000,
                idempotencyKey: partialAllocationKey,
              }),
            ).resolves.toMatchObject({ status: "NO_CHANGE" });
            await validateDeferredConstraints(database);

            const partial = await database.execute<{
              status: string;
              paid_amount_minor_units: number;
              outstanding_amount_minor_units: number;
              allocated_amount_minor_units: number;
            }>(sql`
              select invoice.status, invoice.paid_amount_minor_units,
                invoice.outstanding_amount_minor_units,
                payment.allocated_amount_minor_units
              from public.invoices invoice
              join public.payments payment
                on payment.payment_reference = ${recordedPaymentReference}
              where invoice.invoice_reference = ${individualInvoiceReference}
            `);
            expect(partial.rows).toEqual([{
              status: "PARTIALLY_PAID",
              paid_amount_minor_units: 5_000,
              outstanding_amount_minor_units: 7_000,
              allocated_amount_minor_units: 5_000,
            }]);

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    insert into public.finance_audit_events (
                      payment_id, event_type, actor_profile_id, source,
                      previous_status, next_status, safe_metadata
                    )
                    select payment.id, 'PAYMENT_CONFIRMED',
                      ${fixture!.ownerProfileId}::uuid, 'STAFF',
                      'RECORDED', 'CONFIRMED',
                      jsonb_build_object('paymentVersion', payment.version)
                    from public.payments payment
                    where payment.payment_reference =
                      ${recordedPaymentReference}
                  `);
                  await savepoint.execute(sql`
                    set constraints finance_audit_events_graph_integrity
                      immediate
                  `);
                }),
              "23514",
              "not bound to its exact operation",
            );

            await expect(
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                invoiceReference: individualInvoiceReference,
                amountMinorUnits: 7_001,
                idempotencyKey: randomUUID(),
              }),
            ).resolves.toEqual({ status: "CONFLICT" });
            await expect(
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                invoiceReference: businessInvoiceReference,
                amountMinorUnits: 1_000,
                idempotencyKey: randomUUID(),
              }),
            ).resolves.toEqual({ status: "CONFLICT" });

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    insert into public.payments (
                      payment_reference, customer_id, status, method,
                      currency, amount_minor_units, received_at,
                      recording_idempotency_key, recording_fingerprint
                    ) values (
                      ${paymentReference()}, ${fixture!.individual.customerId}::uuid,
                      'RECORDED', 'OTHER', 'USD', 100, now(),
                      ${randomUUID()}::uuid, ${"a".repeat(64)}
                    )
                  `);
                }),
              "23514",
            );

            await expect(
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                invoiceReference: individualInvoiceReference,
                amountMinorUnits: 7_000,
                idempotencyKey: randomUUID(),
              }),
            ).resolves.toMatchObject({ status: "UPDATED" });
            await validateDeferredConstraints(database);

            const settled = await database.execute<{
              invoice_status: string;
              paid_amount_minor_units: number;
              outstanding_amount_minor_units: number;
              payment_status: string;
              allocated_amount_minor_units: number;
              unallocated_amount_minor_units: number;
            }>(sql`
              select invoice.status as invoice_status,
                invoice.paid_amount_minor_units,
                invoice.outstanding_amount_minor_units,
                payment.status as payment_status,
                payment.allocated_amount_minor_units,
                payment.unallocated_amount_minor_units
              from public.invoices invoice
              join public.payments payment
                on payment.payment_reference = ${recordedPaymentReference}
              where invoice.invoice_reference = ${individualInvoiceReference}
            `);
            expect(settled.rows).toEqual([{
              invoice_status: "PAID",
              paid_amount_minor_units: 12_000,
              outstanding_amount_minor_units: 0,
              payment_status: "CONFIRMED",
              allocated_amount_minor_units: 12_000,
              unallocated_amount_minor_units: 1_000,
            }]);
            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    insert into public.finance_audit_events (
                      invoice_id, payment_id, payment_allocation_id,
                      event_type, actor_profile_id, source,
                      previous_status, next_status, safe_metadata
                    )
                    select invoice.id, payment.id, allocation.id,
                      'INVOICE_PAID', ${fixture!.ownerProfileId}::uuid,
                      'STAFF', 'PARTIALLY_PAID', 'PAID',
                      jsonb_build_object(
                        'paymentVersion', payment.version,
                        'invoiceVersion', invoice.version,
                        'amountMinorUnits', allocation.amount_minor_units
                      )
                    from public.invoices invoice
                    join public.payments payment
                      on payment.payment_reference =
                        ${recordedPaymentReference}
                    join public.payment_allocations allocation
                      on allocation.payment_id = payment.id
                     and allocation.invoice_id = invoice.id
                     and allocation.idempotency_key =
                        ${partialAllocationKey}::uuid
                    where invoice.invoice_reference =
                      ${individualInvoiceReference}
                  `);
                }),
              "23505",
            );
            await expect(
              dashboardRecord(database, fixture.ownerProfileId, "2026-09-15"),
            ).resolves.toMatchObject({
              paidInvoices: 1,
              unappliedPayments: 1,
              paidMinorUnits: 12_000,
            });
            await expect(
              listPaymentsRecord(database, fixture.ownerProfileId),
            ).resolves.toEqual([
              expect.objectContaining({
                paymentReference: recordedPaymentReference,
                allocatedAmountMinorUnits: 12_000,
                unappliedAmountMinorUnits: 1_000,
              }),
            ]);

            await expect(
              reversePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                expectedVersion: 4,
                reasonCategory: "ENTRY_ERROR",
                reasonNote: "Synthetic Phase 3H reversal verification",
                idempotencyKey: randomUUID(),
              }),
            ).resolves.toMatchObject({ status: "UPDATED" });
            await validateDeferredConstraints(database);

            const reversed = await database.execute<{
              invoice_status: string;
              paid_amount_minor_units: number;
              outstanding_amount_minor_units: number;
              payment_status: string;
              allocated_amount_minor_units: number;
              allocation_entries: number;
              reversal_entries: number;
              reversal_facts: number;
            }>(sql`
              select invoice.status as invoice_status,
                invoice.paid_amount_minor_units,
                invoice.outstanding_amount_minor_units,
                payment.status as payment_status,
                payment.allocated_amount_minor_units,
                count(*) filter (where allocation.entry_type = 'ALLOCATION')::integer
                  as allocation_entries,
                count(*) filter (where allocation.entry_type = 'REVERSAL')::integer
                  as reversal_entries,
                (select count(*)::integer from public.payment_reversals reversal
                  where reversal.payment_id = payment.id) as reversal_facts
              from public.invoices invoice
              join public.payments payment
                on payment.payment_reference = ${recordedPaymentReference}
              join public.payment_allocations allocation
                on allocation.invoice_id = invoice.id
               and allocation.payment_id = payment.id
              where invoice.invoice_reference = ${individualInvoiceReference}
              group by invoice.id, payment.id
            `);
            expect(reversed.rows).toEqual([{
              invoice_status: "ISSUED",
              paid_amount_minor_units: 0,
              outstanding_amount_minor_units: 12_000,
              payment_status: "REVERSED",
              allocated_amount_minor_units: 0,
              allocation_entries: 2,
              reversal_entries: 2,
              reversal_facts: 1,
            }]);
            await expect(
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: recordedPaymentReference,
                invoiceReference: individualInvoiceReference,
                amountMinorUnits: 100,
                idempotencyKey: randomUUID(),
              }),
            ).resolves.toEqual({ status: "INVALID_TRANSITION" });

            const inconsistentTotalsReference = invoiceReference();
            try {
              await transaction.transaction(async (savepoint) => {
                const inconsistentDatabase = addTransactionalBatch(savepoint);
                await inconsistentDatabase.execute(sql`
                  update public.quote_items
                  set base_amount_minor_units = base_amount_minor_units + 1,
                    net_amount_minor_units = net_amount_minor_units + 1,
                    gross_total_minor_units = gross_total_minor_units + 1
                  where id = ${fixture!.individualDeferred.quoteItemId}::uuid
                `);
                await inconsistentDatabase.execute(sql`
                  update public.booking_items
                  set base_amount_minor_units = base_amount_minor_units + 1,
                    net_amount_minor_units = net_amount_minor_units + 1,
                    gross_total_minor_units = gross_total_minor_units + 1
                  where id = ${fixture!.individualDeferred.bookingItemId}::uuid
                `);
                await expect(
                  createInvoiceDraftRecord(
                    inconsistentDatabase,
                    fixture!.ownerProfileId,
                    {
                      bookingReference:
                        fixture!.individualDeferred.bookingReference,
                      invoiceReference: inconsistentTotalsReference,
                      customerVisibleNote: null,
                      internalNote: null,
                      manualAdjustmentRequested: false,
                      environmentScope: "DEVELOPMENT",
                    },
                  ),
                ).resolves.toEqual({
                  status: "FINANCE_REVIEW_REQUIRED",
                  reasonCodes: ["COMMERCIAL_TOTALS_INCONSISTENT"],
                });
                const inconsistentResidue =
                  await inconsistentDatabase.execute<{ count: number }>(sql`
                    select count(*)::integer as count
                    from public.invoices
                    where invoice_reference = ${inconsistentTotalsReference}
                  `);
                expect(inconsistentResidue.rows).toEqual([{ count: 0 }]);
                throw new RollbackCompleted();
              });
            } catch (error) {
              if (!(error instanceof RollbackCompleted)) throw error;
            }

            const staleInvoiceReference = invoiceReference();
            try {
              await transaction.transaction(async (savepoint) => {
                const staleDatabase = addTransactionalBatch(savepoint);
                await staleDatabase.execute(sql`
                  update public.booking_items
                  set description_en = 'Stale synthetic booking scope'
                  where id = ${fixture!.individualDeferred.bookingItemId}::uuid
                `);
                await expect(
                  createInvoiceDraftRecord(
                    staleDatabase,
                    fixture!.ownerProfileId,
                    {
                      bookingReference:
                        fixture!.individualDeferred.bookingReference,
                      invoiceReference: staleInvoiceReference,
                      customerVisibleNote: null,
                      internalNote: null,
                      manualAdjustmentRequested: false,
                      environmentScope: "DEVELOPMENT",
                    },
                  ),
                ).resolves.toEqual({
                  status: "FINANCE_REVIEW_REQUIRED",
                  reasonCodes: ["COMMERCIAL_TOTALS_INCONSISTENT"],
                });
                const staleResidue = await staleDatabase.execute<{
                  count: number;
                }>(sql`
                  select count(*)::integer as count
                  from public.invoices
                  where invoice_reference = ${staleInvoiceReference}
                `);
                expect(staleResidue.rows).toEqual([{ count: 0 }]);
                throw new RollbackCompleted();
              });
            } catch (error) {
              if (!(error instanceof RollbackCompleted)) throw error;
            }

            const divergentJobInvoiceReference = invoiceReference();
            try {
              await transaction.transaction(async (savepoint) => {
                const divergentDatabase = addTransactionalBatch(savepoint);
                const divergentJob = await createPreparedJob(
                  divergentDatabase,
                  fixture!,
                  fixture!.individualDeferred,
                );
                await divergentDatabase.execute(sql`
                  update public.job_items
                  set status = 'DECLINED', version = version + 1,
                    updated_at = now()
                  where id = ${divergentJob.jobItemId}::uuid
                `);
                await expect(
                  createInvoiceDraftRecord(
                    divergentDatabase,
                    fixture!.ownerProfileId,
                    {
                      bookingReference:
                        fixture!.individualDeferred.bookingReference,
                      invoiceReference: divergentJobInvoiceReference,
                      customerVisibleNote: null,
                      internalNote: "Synthetic known job divergence",
                      manualAdjustmentRequested: false,
                      environmentScope: "DEVELOPMENT",
                    },
                  ),
                ).resolves.toEqual({
                  status: "FINANCE_REVIEW_REQUIRED",
                  invoiceReference: divergentJobInvoiceReference,
                  invoiceNumber: undefined,
                  paymentReference: undefined,
                  reasonCodes: ["JOB_SCOPE_DIFFERENCE"],
                });
                await validateDeferredConstraints(divergentDatabase);
                const divergentDraft = await divergentDatabase.execute<{
                  status: string;
                  finance_review_status: string;
                  finance_review_reason_codes: readonly string[];
                }>(sql`
                  select status, finance_review_status,
                    finance_review_reason_codes
                  from public.invoices
                  where invoice_reference = ${divergentJobInvoiceReference}
                `);
                expect(divergentDraft.rows).toEqual([{
                  status: "DRAFT",
                  finance_review_status: "REQUIRED",
                  finance_review_reason_codes: ["JOB_SCOPE_DIFFERENCE"],
                }]);
                throw new RollbackCompleted();
              });
            } catch (error) {
              if (!(error instanceof RollbackCompleted)) throw error;
            }

            const gatedDivergenceReference = invoiceReference();
            try {
              await transaction.transaction(async (savepoint) => {
                const gatedDatabase = addTransactionalBatch(savepoint);
                const gatedJob = await createPreparedJob(
                  gatedDatabase,
                  fixture!,
                  fixture!.individualDeferred,
                );
                await gatedDatabase.execute(sql`
                  update public.job_items
                  set status = 'DECLINED', version = version + 1,
                    updated_at = now()
                  where id = ${gatedJob.jobItemId}::uuid
                `);
                await activateJobCompletionInvoicePolicy(
                  gatedDatabase,
                  fixture!,
                  "JOB_COMPLETED",
                );
                await expect(
                  createInvoiceDraftRecord(
                    gatedDatabase,
                    fixture!.ownerProfileId,
                    {
                      bookingReference:
                        fixture!.individualDeferred.bookingReference,
                      invoiceReference: gatedDivergenceReference,
                      customerVisibleNote: null,
                      internalNote: null,
                      manualAdjustmentRequested: false,
                      environmentScope: "DEVELOPMENT",
                    },
                  ),
                ).resolves.toEqual({
                  status: "FINANCE_REVIEW_REQUIRED",
                  reasonCodes: [
                    "JOB_COMPLETION_REQUIRED",
                    "JOB_SCOPE_DIFFERENCE",
                  ],
                });
                const gatedResidue = await gatedDatabase.execute<{
                  count: number;
                }>(sql`
                  select count(*)::integer as count
                  from public.invoices
                  where invoice_reference = ${gatedDivergenceReference}
                `);
                expect(gatedResidue.rows).toEqual([{ count: 0 }]);
                throw new RollbackCompleted();
              });
            } catch (error) {
              if (!(error instanceof RollbackCompleted)) throw error;
            }

            await activateJobCompletionInvoicePolicy(database, fixture);
            const noJobInvoiceReference = invoiceReference();
            await expect(
              createInvoiceDraftRecord(database, fixture.ownerProfileId, {
                bookingReference: fixture.individualDeferred.bookingReference,
                invoiceReference: noJobInvoiceReference,
                customerVisibleNote: null,
                internalNote: "Awaiting a concrete job",
                manualAdjustmentRequested: false,
                environmentScope: "DEVELOPMENT",
              }),
            ).resolves.toEqual({
              status: "FINANCE_REVIEW_REQUIRED",
              reasonCodes: ["JOB_COMPLETION_REQUIRED"],
            });
            const noJobResidue = await database.execute<{ count: number }>(sql`
              select count(*)::integer as count
              from public.invoices
              where invoice_reference = ${noJobInvoiceReference}
            `);
            expect(noJobResidue.rows).toEqual([{ count: 0 }]);

            const preparedJob = await createPreparedJob(
              database,
              fixture,
              fixture.individualDeferred,
            );
            const deferredInvoiceReference = invoiceReference();
            await expect(
              createInvoiceDraftRecord(database, fixture.ownerProfileId, {
                bookingReference: fixture.individualDeferred.bookingReference,
                invoiceReference: deferredInvoiceReference,
                customerVisibleNote: null,
                internalNote: "Awaiting exact job completion",
                manualAdjustmentRequested: false,
                environmentScope: "DEVELOPMENT",
              }),
            ).resolves.toEqual({
              status: "FINANCE_REVIEW_REQUIRED",
              invoiceReference: deferredInvoiceReference,
              invoiceNumber: undefined,
              paymentReference: undefined,
              reasonCodes: ["JOB_COMPLETION_REQUIRED"],
            });
            await validateDeferredConstraints(database);

            const deferredDraft = await database.execute<{
              status: string;
              finance_review_status: string;
              finance_review_reason_codes: readonly string[];
              eligibility_snapshot: Readonly<Record<string, unknown>>;
              invoice_job_id: string | null;
              item_job_id: string | null;
              item_job_item_id: string | null;
            }>(sql`
              select invoice.status, invoice.finance_review_status,
                invoice.finance_review_reason_codes,
                invoice.eligibility_snapshot,
                invoice.job_id as invoice_job_id,
                item.job_id as item_job_id,
                item.job_item_id as item_job_item_id
              from public.invoices invoice
              join public.invoice_items item on item.invoice_id = invoice.id
              where invoice.invoice_reference = ${deferredInvoiceReference}
            `);
            expect(deferredDraft.rows).toEqual([{
              status: "DRAFT",
              finance_review_status: "REQUIRED",
              finance_review_reason_codes: ["JOB_COMPLETION_REQUIRED"],
              eligibility_snapshot: {
                draftEligibility: "BOOKING_ACCEPTED",
                issueEligibility: "JOB_COMPLETED",
                jobReference: preparedJob.jobReference,
                jobStatus: "PREPARED",
              },
              invoice_job_id: preparedJob.jobId,
              item_job_id: preparedJob.jobId,
              item_job_item_id: preparedJob.jobItemId,
            }]);
            const draftEligibilitySnapshot =
              deferredDraft.rows[0]!.eligibility_snapshot;

            await completePreparedJob(database, fixture, preparedJob);

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    update public.invoices invoice
                    set invoice_number = numbering.prefix || lpad(
                          numbering.next_sequence::text,
                          greatest(
                            numbering.padding_width,
                            length(numbering.next_sequence::text)
                          ),
                          '0'
                        ),
                      numbering_policy_id = numbering.id,
                      numbering_policy_code = numbering.code,
                      numbering_policy_version = numbering.version,
                      numbering_sequence = numbering.next_sequence,
                      status = 'ISSUED', finance_review_status = 'CLEAR',
                      finance_review_reason_codes = '[]'::jsonb,
                      issue_date = (now() at time zone 'Europe/Sofia')::date,
                      due_date = (now() at time zone 'Europe/Sofia')::date +
                        policy.default_due_days,
                      issue_idempotency_key = ${randomUUID()}::uuid,
                      issued_at = now(),
                      issued_by_profile_id = ${fixture!.ownerProfileId}::uuid,
                      version = invoice.version + 1, updated_at = now()
                    from public.invoice_policies policy
                    join public.invoice_numbering_policies numbering
                      on numbering.id = policy.numbering_policy_id
                    where invoice.invoice_reference =
                        ${deferredInvoiceReference}
                      and policy.id = invoice.invoice_policy_id
                  `);
                  await savepoint.execute(sql`
                    set constraints invoices_numbering_allocation_integrity
                      immediate
                  `);
                }),
              "23514",
              "issued invoice has no reciprocal numbering counter allocation",
            );

            await expect(
              issueInvoiceRecord(database, fixture.ownerProfileId, {
                invoiceReference: deferredInvoiceReference,
                expectedVersion: 1,
                issueConfirmed: true,
                environmentScope: "DEVELOPMENT",
              }),
            ).resolves.toEqual({
              status: "ISSUED",
              invoiceReference: deferredInvoiceReference,
              invoiceNumber: `DEV3H-${fixture.token.slice(0, 6)}-000004`,
              paymentReference: undefined,
            });
            await validateDeferredConstraints(database);

            const deferredIssued = await database.execute<{
              status: string;
              finance_review_status: string;
              finance_review_reason_codes: readonly string[];
              eligibility_snapshot: Readonly<Record<string, unknown>>;
              job_status: string;
              job_item_status: string;
            }>(sql`
              select invoice.status, invoice.finance_review_status,
                invoice.finance_review_reason_codes,
                invoice.eligibility_snapshot, job.status as job_status,
                job_item.status as job_item_status
              from public.invoices invoice
              join public.jobs job on job.id = invoice.job_id
              join public.invoice_items item on item.invoice_id = invoice.id
              join public.job_items job_item on job_item.id = item.job_item_id
              where invoice.invoice_reference = ${deferredInvoiceReference}
            `);
            expect(deferredIssued.rows).toEqual([{
              status: "ISSUED",
              finance_review_status: "CLEAR",
              finance_review_reason_codes: [],
              eligibility_snapshot: draftEligibilitySnapshot,
              job_status: "COMPLETED",
              job_item_status: "COMPLETED",
            }]);

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    insert into public.finance_audit_events (
                      invoice_id, event_type, actor_profile_id, source,
                      previous_status, next_status, safe_metadata
                    )
                    select invoice.id, 'INVOICE_ISSUED',
                      ${fixture!.ownerProfileId}::uuid, 'STAFF',
                      'DRAFT', 'ISSUED',
                      jsonb_build_object('invoiceVersion', invoice.version)
                    from public.invoices invoice
                    where invoice.invoice_reference =
                      ${deferredInvoiceReference}
                  `);
                }),
              "23505",
            );

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    insert into public.finance_audit_events (
                      invoice_id, event_type, actor_profile_id, source,
                      previous_status, next_status, safe_metadata
                    )
                    select invoice.id, 'INVOICE_ISSUED',
                      ${fixture!.technicianProfileId}::uuid, 'STAFF',
                      'READY_TO_ISSUE', 'ISSUED',
                      jsonb_build_object(
                        'invoiceVersion', invoice.version + 1
                      )
                    from public.invoices invoice
                    where invoice.invoice_reference =
                      ${deferredInvoiceReference}
                  `);
                  await savepoint.execute(sql`
                    set constraints finance_audit_events_graph_integrity
                      immediate
                  `);
                }),
              "23514",
              "not bound to its exact operation",
            );

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    update public.invoices
                    set created_by_profile_id = null
                    where invoice_reference = ${deferredInvoiceReference}
                  `);
                }),
              "23514",
            );

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    update public.business_legal_profiles
                    set approved_by_profile_id = null
                    where id = ${fixture!.sellerProfileId}::uuid
                  `);
                }),
              "23514",
            );

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    update public.finance_audit_events
                    set actor_profile_id = null
                    where id = (
                      select event.id
                      from public.finance_audit_events event
                      where event.invoice_id = (
                        select invoice.id from public.invoices invoice
                        where invoice.invoice_reference =
                          ${deferredInvoiceReference}
                      )
                      order by event.created_at
                      limit 1
                    )
                  `);
                }),
              "23514",
            );

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    insert into public.finance_audit_events (
                      invoice_id, event_type, actor_profile_id, source,
                      previous_status, next_status, safe_metadata
                    )
                    select invoice.id, 'INVOICE_ISSUED',
                      ${fixture!.ownerProfileId}::uuid, 'STAFF',
                      'READY_TO_ISSUE', 'ISSUED',
                      jsonb_build_object(
                        'invoiceVersion', invoice.version + 1
                      )
                    from public.invoices invoice
                    where invoice.invoice_reference =
                      ${deferredInvoiceReference}
                  `);
                  await savepoint.execute(sql`
                    set constraints finance_audit_events_graph_integrity
                      immediate
                  `);
                }),
              "23514",
              "not bound to its exact operation",
            );

            await expectDatabaseRejection(
              () =>
                transaction.transaction(async (savepoint) => {
                  await savepoint.execute(sql`
                    delete from public.finance_audit_events
                    where payment_id = (
                      select id from public.payments
                      where payment_reference = ${recordedPaymentReference}
                    )
                  `);
                }),
            );

            throw new RollbackCompleted();
          });
        } catch (error) {
          if (!(error instanceof RollbackCompleted)) throw error;
        } finally {
          await stateful.$client.end();
        }

        expect(fixture).toBeDefined();
        const verifier = neonDrizzle({
          connection: getDatabaseUrl(),
          schema,
          ws: globalThis.WebSocket,
        });
        try {
          const residue = await verifier.execute<{ count: number }>(sql`
            select (
              (select count(*) from public.user_profiles
                where id in (
                  ${fixture!.ownerProfileId}::uuid,
                  ${fixture!.technicianProfileId}::uuid,
                  ${fixture!.customerProfileId}::uuid
                )) +
              (select count(*) from public.customers
                where id in (
                  ${fixture!.individual.customerId}::uuid,
                  ${fixture!.business.customerId}::uuid
                )) +
              (select count(*) from public.business_legal_profiles
                where id = ${fixture!.sellerProfileId}::uuid) +
              (select count(*) from public.invoice_numbering_policies
                where id = ${fixture!.numberingPolicyId}) +
              (select count(*) from public.invoice_policies
                where id in (
                  ${fixture!.invoicePolicyId},
                  ${fixture!.jobInvoicePolicyId}
                )) +
              (select count(*) from public.working_hour_policies
                where code = ${`PHASE3H_HOURS_${fixture!.token}`}) +
              (select count(*) from public.operations_teams
                where code = ${`PHASE3H_TEAM_${fixture!.token}`}) +
              (select count(*) from public.travel_time_profiles
                where code = ${`PHASE3H_TRAVEL_${fixture!.token}`}) +
              (select count(*) from public.booking_occupancies
                where booking_id =
                  ${fixture!.individualDeferred.bookingId}::uuid) +
              (select count(*) from public.jobs
                where booking_id =
                  ${fixture!.individualDeferred.bookingId}::uuid) +
              (select count(*) from public.job_items
                where booking_id =
                  ${fixture!.individualDeferred.bookingId}::uuid) +
              (select count(*) from public.bookings
                where id in (
                  ${fixture!.individualPrimary.bookingId}::uuid,
                  ${fixture!.individualSecondary.bookingId}::uuid,
                  ${fixture!.individualDeferred.bookingId}::uuid,
                  ${fixture!.businessPrimary.bookingId}::uuid
                )) +
              (select count(*) from public.invoices
                where booking_id in (
                  ${fixture!.individualPrimary.bookingId}::uuid,
                  ${fixture!.individualSecondary.bookingId}::uuid,
                  ${fixture!.individualDeferred.bookingId}::uuid,
                  ${fixture!.businessPrimary.bookingId}::uuid
                ))
            )::integer as count
          `);
          expect(residue.rows).toEqual([{ count: 0 }]);
        } finally {
          await verifier.$client.end();
        }
      },
      60_000,
    );
  },
);

describe.skipIf(!runConcurrencyIntegration)(
  "Phase 3H PostgreSQL concurrency and stale-write safety",
  () => {
    it(
      "serializes issue, allocation, reversal, and stale draft races across sessions",
      async () => {
        assertDisposableLocalConcurrencyTarget();
        const connectionString = getDatabaseUrl();
        const poolA = new Pool({ connectionString, max: 1 });
        const poolB = new Pool({ connectionString, max: 1 });
        const observerPool = new Pool({ connectionString, max: 1 });
        const sessionA = nodePostgresDrizzle(poolA, { schema });
        const sessionB = nodePostgresDrizzle(poolB, { schema });
        const transact = <T>(
          database: typeof sessionA,
          task: (transaction: Database) => Promise<T>,
        ) =>
          database.transaction((transaction) =>
            task(addTransactionalBatch(transaction)),
          );

        try {
          const fixture = await sessionA.transaction((transaction) =>
            createFinanceFixture(transaction as unknown as Database),
          );
          const createDraft = (reference: string, graph: CommercialGraph) =>
            transact(sessionA, (database) =>
              createInvoiceDraftRecord(database, fixture.ownerProfileId, {
                bookingReference: graph.bookingReference,
                invoiceReference: reference,
                customerVisibleNote: null,
                internalNote: null,
                manualAdjustmentRequested: false,
                environmentScope: "DEVELOPMENT",
              }),
            );
          const issue = (
            database: typeof sessionA,
            reference: string,
          ) =>
            transact(database, (transaction) =>
              issueInvoiceRecord(transaction, fixture.ownerProfileId, {
                invoiceReference: reference,
                expectedVersion: 1,
                issueConfirmed: true,
                environmentScope: "DEVELOPMENT",
              }),
            );
          const createIssued = async (graph: CommercialGraph) => {
            const reference = invoiceReference();
            await expect(createDraft(reference, graph)).resolves.toMatchObject({
              status: "CREATED",
              invoiceReference: reference,
            });
            await expect(issue(sessionA, reference)).resolves.toMatchObject({
              status: "ISSUED",
              invoiceReference: reference,
            });
            return reference;
          };
          const recordConfirmedPayment = async (
            reference: string,
            invoice: string,
            amountMinorUnits: number,
          ) => {
            await expect(
              transact(sessionA, (database) =>
                recordPaymentRecord(database, fixture.ownerProfileId, {
                  invoiceReference: invoice,
                  paymentReference: reference,
                  amountMinorUnits,
                  method: "BANK_TRANSFER",
                  receivedAt: new Date("2026-08-26T09:00:00.000Z"),
                  externalReference: null,
                  internalNote: null,
                  idempotencyKey: randomUUID(),
                }),
              ),
            ).resolves.toMatchObject({ status: "CREATED" });
            await expect(
              transact(sessionA, (database) =>
                confirmPaymentRecord(database, fixture.ownerProfileId, {
                  paymentReference: reference,
                  expectedVersion: 1,
                  evidenceConfirmed: true,
                }),
              ),
            ).resolves.toMatchObject({ status: "UPDATED" });
          };

          const jobRaceGraph = await transact(sessionA, (database) =>
            createCommercialGraph(
              database,
              fixture,
              fixture.individual,
              { net: 6_250, vat: 1_250, gross: 7_500, priceBasis: "GROSS" },
            ),
          );
          const jobRace = await transact(sessionA, (database) =>
            createPreparedJob(database, fixture, jobRaceGraph),
          );
          const jobRaceReference = invoiceReference();
          await expect(
            createDraft(jobRaceReference, jobRaceGraph),
          ).resolves.toMatchObject({
            status: "CREATED",
            invoiceReference: jobRaceReference,
          });
          const numberingBeforeJobRace = await sessionA.execute<{
            next_sequence: number;
          }>(sql`
            select next_sequence
            from public.invoice_numbering_policies
            where id = ${fixture.numberingPolicyId}
          `);
          expect(numberingBeforeJobRace.rows).toEqual([{ next_sequence: 1 }]);

          const jobMutation = await poolA.connect();
          const issueApplicationName = `phase3h-job-issue-${fixture.token}`;
          let jobMutationCommitted = false;
          try {
            await sessionB.execute(sql`
              select set_config('application_name', ${issueApplicationName}, false)
            `);
            await jobMutation.query("begin");
            await jobMutation.query(
              `update public.jobs
               set version = version + 1, updated_at = now(),
                 updated_by_profile_id = $2::uuid
               where id = $1::uuid`,
              [jobRace.jobId, fixture.ownerProfileId],
            );
            await jobMutation.query(
              `update public.job_items
               set status = 'DECLINED', version = version + 1,
                 updated_at = now()
               where id = $1::uuid and job_id = $2::uuid`,
              [jobRace.jobItemId, jobRace.jobId],
            );

            const concurrentIssue = issue(sessionB, jobRaceReference);
            await waitForLockWait(observerPool, issueApplicationName);
            await jobMutation.query("commit");
            jobMutationCommitted = true;

            await expect(concurrentIssue).resolves.toMatchObject({
              status: "FINANCE_REVIEW_REQUIRED",
              invoiceReference: jobRaceReference,
            });
          } finally {
            if (!jobMutationCommitted) await jobMutation.query("rollback");
            jobMutation.release();
          }

          const jobRaceState = await sessionA.execute<{
            status: string;
            version: number;
            invoice_number: string | null;
            next_sequence: number;
            job_item_status: string;
          }>(sql`
            select invoice.status, invoice.version, invoice.invoice_number,
              numbering.next_sequence, job_item.status as job_item_status
            from public.invoices invoice
            join public.invoice_policies policy
              on policy.id = invoice.invoice_policy_id
            join public.invoice_numbering_policies numbering
              on numbering.id = policy.numbering_policy_id
            join public.job_items job_item
              on job_item.id = (
                select item.id
                from public.job_items item
                where item.job_id = invoice.job_id
                order by item.id
                limit 1
              )
            where invoice.invoice_reference = ${jobRaceReference}
          `);
          expect(jobRaceState.rows).toEqual([{
            status: "READY_TO_ISSUE",
            version: 1,
            invoice_number: null,
            next_sequence: 1,
            job_item_status: "DECLINED",
          }]);
          await expect(
            transact(sessionA, (database) =>
              cancelDraftInvoiceRecord(database, fixture.ownerProfileId, {
                invoiceReference: jobRaceReference,
                expectedVersion: 1,
                reason: "Synthetic completed Job-item race cleanup",
              }),
            ),
          ).resolves.toMatchObject({ status: "UPDATED" });

          const doubleIssueReference = invoiceReference();
          await createDraft(doubleIssueReference, fixture.individualPrimary);
          const doubleIssue = await Promise.all([
            issue(sessionA, doubleIssueReference),
            issue(sessionB, doubleIssueReference),
          ]);
          expect(doubleIssue.map((result) => result.status).sort()).toEqual([
            "EXISTING",
            "ISSUED",
          ]);
          const issuedOnce = await sessionA.execute<{
            status: string;
            version: number;
            invoice_number: string | null;
            next_sequence: number;
            issue_audits: number;
          }>(sql`
            select invoice.status, invoice.version, invoice.invoice_number,
              numbering.next_sequence,
              (select count(*)::integer
                from public.finance_audit_events audit
                where audit.invoice_id = invoice.id
                  and audit.event_type = 'INVOICE_ISSUED'
                  and audit.safe_metadata ->> 'invoiceVersion' =
                    invoice.version::text) as issue_audits
            from public.invoices invoice
            join public.invoice_numbering_policies numbering
              on numbering.id = invoice.numbering_policy_id
            where invoice.invoice_reference = ${doubleIssueReference}
          `);
          expect(issuedOnce.rows).toEqual([expect.objectContaining({
            status: "ISSUED",
            version: 2,
            invoice_number: expect.any(String),
            next_sequence: 2,
            issue_audits: 1,
          })]);

          const staleDraftReference = invoiceReference();
          await createDraft(staleDraftReference, fixture.individualSecondary);
          const staleRace = await Promise.all([
            issue(sessionA, staleDraftReference),
            transact(sessionB, (database) =>
              cancelDraftInvoiceRecord(database, fixture.ownerProfileId, {
                invoiceReference: staleDraftReference,
                expectedVersion: 1,
                reason: "Synthetic stale-write race",
              }),
            ),
          ]);
          expect(
            staleRace.filter((result) =>
              result.status === "ISSUED" || result.status === "UPDATED",
            ),
          ).toHaveLength(1);
          const staleFinal = await sessionA.execute<{
            status: string;
            version: number;
            invoice_number: string | null;
            next_sequence: number;
          }>(sql`
            select invoice.status, invoice.version, invoice.invoice_number,
              numbering.next_sequence
            from public.invoices invoice
            join public.invoice_policies policy
              on policy.id = invoice.invoice_policy_id
            join public.invoice_numbering_policies numbering
              on numbering.id = policy.numbering_policy_id
            where invoice.invoice_reference = ${staleDraftReference}
          `);
          expect(staleFinal.rows[0]).toMatchObject({ version: 2 });
          if (staleFinal.rows[0]!.status === "ISSUED") {
            expect(staleFinal.rows[0]).toMatchObject({
              invoice_number: expect.any(String),
              next_sequence: 3,
            });
          } else {
            expect(staleFinal.rows[0]).toMatchObject({
              status: "CANCELLED",
              invoice_number: null,
              next_sequence: 2,
            });
          }

          const allocationInvoice = await createIssued(fixture.businessPrimary);
          const paymentA = paymentReference();
          const paymentB = paymentReference();
          await recordConfirmedPayment(paymentA, allocationInvoice, 20_000);
          await recordConfirmedPayment(paymentB, allocationInvoice, 20_000);
          const allocationRace = await Promise.all([
            transact(sessionA, (database) =>
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: paymentA,
                invoiceReference: allocationInvoice,
                amountMinorUnits: 15_000,
                idempotencyKey: randomUUID(),
              }),
            ),
            transact(sessionB, (database) =>
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: paymentB,
                invoiceReference: allocationInvoice,
                amountMinorUnits: 15_000,
                idempotencyKey: randomUUID(),
              }),
            ),
          ]);
          expect(allocationRace.map((result) => result.status).sort()).toEqual([
            "CONFLICT",
            "UPDATED",
          ]);
          const successfulPayment =
            allocationRace[0]!.status === "UPDATED" ? paymentA : paymentB;
          const allocationState = await sessionA.execute<{
            paid_amount_minor_units: number;
            outstanding_amount_minor_units: number;
            allocation_count: number;
            allocated_sum: number;
          }>(sql`
            select invoice.paid_amount_minor_units,
              invoice.outstanding_amount_minor_units,
              (select count(*)::integer
                from public.payment_allocations allocation
                where allocation.invoice_id = invoice.id
                  and allocation.entry_type = 'ALLOCATION') as allocation_count,
              (select coalesce(sum(allocation.amount_minor_units), 0)::integer
                from public.payment_allocations allocation
                where allocation.invoice_id = invoice.id
                  and allocation.entry_type = 'ALLOCATION') as allocated_sum
            from public.invoices invoice
            where invoice.invoice_reference = ${allocationInvoice}
          `);
          expect(allocationState.rows).toEqual([{
            paid_amount_minor_units: 15_000,
            outstanding_amount_minor_units: 9_000,
            allocation_count: 1,
            allocated_sum: 15_000,
          }]);

          const allocationVsReversal = await Promise.all([
            transact(sessionA, (database) =>
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: successfulPayment,
                invoiceReference: allocationInvoice,
                amountMinorUnits: 5_000,
                idempotencyKey: randomUUID(),
              }),
            ),
            transact(sessionB, (database) =>
              reversePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: successfulPayment,
                expectedVersion: 3,
                reasonCategory: "ENTRY_ERROR",
                reasonNote: "Synthetic allocation reversal race",
                idempotencyKey: randomUUID(),
              }),
            ),
          ]);
          expect(
            allocationVsReversal.filter((result) => result.status === "UPDATED"),
          ).toHaveLength(1);
          const raceState = await sessionA.execute<{
            payment_status: string;
            allocated_amount_minor_units: number;
            paid_amount_minor_units: number;
            allocation_entries: number;
            reversal_entries: number;
            reversal_facts: number;
          }>(sql`
            select payment.status as payment_status,
              payment.allocated_amount_minor_units,
              invoice.paid_amount_minor_units,
              count(*) filter (where allocation.entry_type = 'ALLOCATION')::integer
                as allocation_entries,
              count(*) filter (where allocation.entry_type = 'REVERSAL')::integer
                as reversal_entries,
              (select count(*)::integer from public.payment_reversals reversal
                where reversal.payment_id = payment.id) as reversal_facts
            from public.payments payment
            join public.invoices invoice
              on invoice.invoice_reference = ${allocationInvoice}
            left join public.payment_allocations allocation
              on allocation.payment_id = payment.id
             and allocation.invoice_id = invoice.id
            where payment.payment_reference = ${successfulPayment}
            group by payment.id, invoice.id
          `);
          if (raceState.rows[0]!.payment_status === "CONFIRMED") {
            expect(raceState.rows[0]).toEqual({
              payment_status: "CONFIRMED",
              allocated_amount_minor_units: 20_000,
              paid_amount_minor_units: 20_000,
              allocation_entries: 2,
              reversal_entries: 0,
              reversal_facts: 0,
            });
          } else {
            expect(raceState.rows[0]).toEqual({
              payment_status: "REVERSED",
              allocated_amount_minor_units: 0,
              paid_amount_minor_units: 0,
              allocation_entries: 1,
              reversal_entries: 1,
              reversal_facts: 1,
            });
          }

          const crossReversalPayment = paymentReference();
          const crossAllocationPayment = paymentReference();
          await recordConfirmedPayment(
            crossReversalPayment,
            doubleIssueReference,
            4_000,
          );
          await recordConfirmedPayment(
            crossAllocationPayment,
            doubleIssueReference,
            4_000,
          );
          await expect(
            transact(sessionA, (database) =>
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: crossReversalPayment,
                invoiceReference: doubleIssueReference,
                amountMinorUnits: 4_000,
                idempotencyKey: randomUUID(),
              }),
            ),
          ).resolves.toMatchObject({ status: "UPDATED" });
          const crossPaymentRace = await Promise.all([
            transact(sessionA, (database) =>
              reversePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: crossReversalPayment,
                expectedVersion: 3,
                reasonCategory: "ENTRY_ERROR",
                reasonNote: "Synthetic cross-payment reversal race",
                idempotencyKey: randomUUID(),
              }),
            ),
            transact(sessionB, (database) =>
              allocatePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: crossAllocationPayment,
                invoiceReference: doubleIssueReference,
                amountMinorUnits: 4_000,
                idempotencyKey: randomUUID(),
              }),
            ),
          ]);
          expect(crossPaymentRace.map((result) => result.status)).toEqual([
            "UPDATED",
            "UPDATED",
          ]);
          const crossPaymentState = await sessionA.execute<{
            paid_amount_minor_units: number;
            reversal_payment_status: string;
            allocation_payment_status: string;
            allocation_payment_allocated: number;
            active_ledger_minor_units: number;
          }>(sql`
            select invoice.paid_amount_minor_units,
              reversal_payment.status as reversal_payment_status,
              allocation_payment.status as allocation_payment_status,
              allocation_payment.allocated_amount_minor_units
                as allocation_payment_allocated,
              (select coalesce(sum(case allocation.entry_type
                  when 'ALLOCATION' then allocation.amount_minor_units
                  else -allocation.amount_minor_units
                end), 0)::integer
                from public.payment_allocations allocation
                where allocation.invoice_id = invoice.id)
                as active_ledger_minor_units
            from public.invoices invoice
            join public.payments reversal_payment
              on reversal_payment.payment_reference = ${crossReversalPayment}
            join public.payments allocation_payment
              on allocation_payment.payment_reference = ${crossAllocationPayment}
            where invoice.invoice_reference = ${doubleIssueReference}
          `);
          expect(crossPaymentState.rows).toEqual([{
            paid_amount_minor_units: 4_000,
            reversal_payment_status: "REVERSED",
            allocation_payment_status: "CONFIRMED",
            allocation_payment_allocated: 4_000,
            active_ledger_minor_units: 4_000,
          }]);
          await expect(
            transact(sessionA, (database) =>
              reversePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: crossAllocationPayment,
                expectedVersion: 3,
                reasonCategory: "ENTRY_ERROR",
                reasonNote: "Synthetic cross-payment race cleanup",
                idempotencyKey: randomUUID(),
              }),
            ),
          ).resolves.toMatchObject({ status: "UPDATED" });

          const secondInvoice = await createIssued(fixture.individualDeferred);
          const multiInvoicePayment = paymentReference();
          await recordConfirmedPayment(
            multiInvoicePayment,
            doubleIssueReference,
            8_000,
          );
          await transact(sessionA, (database) =>
            allocatePaymentRecord(database, fixture.ownerProfileId, {
              paymentReference: multiInvoicePayment,
              invoiceReference: doubleIssueReference,
              amountMinorUnits: 3_000,
              idempotencyKey: randomUUID(),
            }),
          );
          await transact(sessionA, (database) =>
            allocatePaymentRecord(database, fixture.ownerProfileId, {
              paymentReference: multiInvoicePayment,
              invoiceReference: secondInvoice,
              amountMinorUnits: 5_000,
              idempotencyKey: randomUUID(),
            }),
          );
          await expect(
            transact(sessionA, (database) =>
              reversePaymentRecord(database, fixture.ownerProfileId, {
                paymentReference: multiInvoicePayment,
                expectedVersion: 4,
                reasonCategory: "ENTRY_ERROR",
                reasonNote: "Synthetic multi-invoice reversal",
                idempotencyKey: randomUUID(),
              }),
            ),
          ).resolves.toMatchObject({ status: "UPDATED" });
          const multiInvoiceState = await sessionA.execute<{
            payment_status: string;
            allocated_amount_minor_units: number;
            allocation_entries: number;
            reversal_entries: number;
            reversed_audits: number;
            unsettled_invoices: number;
          }>(sql`
            select payment.status as payment_status,
              payment.allocated_amount_minor_units,
              count(*) filter (where allocation.entry_type = 'ALLOCATION')::integer
                as allocation_entries,
              count(*) filter (where allocation.entry_type = 'REVERSAL')::integer
                as reversal_entries,
              count(*) filter (
                where audit.event_type = 'PAYMENT_ALLOCATION_REVERSED'
              )::integer as reversed_audits,
              (select count(*)::integer
                from public.invoices invoice
                where invoice.invoice_reference in (
                  ${doubleIssueReference}, ${secondInvoice}
                )
                  and (invoice.status <> 'ISSUED'
                    or invoice.paid_amount_minor_units <> 0))
                as unsettled_invoices
            from public.payments payment
            join public.payment_allocations allocation
              on allocation.payment_id = payment.id
            left join public.finance_audit_events audit
              on audit.payment_allocation_id = allocation.id
             and audit.event_type = 'PAYMENT_ALLOCATION_REVERSED'
            where payment.payment_reference = ${multiInvoicePayment}
            group by payment.id
          `);
          expect(multiInvoiceState.rows).toEqual([{
            payment_status: "REVERSED",
            allocated_amount_minor_units: 0,
            allocation_entries: 2,
            reversal_entries: 2,
            reversed_audits: 2,
            unsettled_invoices: 0,
          }]);
        } finally {
          await Promise.all([poolA.end(), poolB.end(), observerPool.end()]);
        }
      },
      120_000,
    );
  },
);
