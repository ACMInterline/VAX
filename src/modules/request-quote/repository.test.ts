import type { SQL } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it, vi } from "vitest";
import type { Database } from "@/db/client";

vi.mock("server-only", () => ({}));

import { calculateStaffEstimate } from "./estimate";
import {
  appendEstimateRecord,
  createCustomerFromRequestRecord,
  createCustomerRequestRecord,
  createPublicCodeRequestRecord,
  createQuoteDraftRecord,
  deriveEstimateEngineInputRecord,
  exactLinkedCustomerSql,
  expireQuoteRecord,
  issueQuoteRecord,
  linkRequestRecord,
  listCustomerQuoteRecords,
  listCustomerRequestRecords,
  listStaffRequestRecords,
  loadCustomerRequestRecord,
  loadCustomerQuoteRecord,
  loadStaffRequestRecord,
  normalizeRequestRecord,
  setRequestResolutionRecord,
  staffRequestManageSql,
  staffRequestReadSql,
  transitionRequestRecord,
  updateQuoteDraftRecord,
  withdrawQuoteRecord,
  type CreateRequestRecordInput,
  type QuoteCommercialInput,
} from "./repository";
import type { QuoteLineInput } from "./types";

const dialect = new PgDialect();
const actorId = "10000000-0000-4000-8000-000000000001";
const requestId = "20000000-0000-4000-8000-000000000001";
const customerId = "30000000-0000-4000-8000-000000000001";
const propertyId = "40000000-0000-4000-8000-000000000001";
const assetId = "50000000-0000-4000-8000-000000000001";
const itemId = "60000000-0000-4000-8000-000000000001";
const estimateId = "70000000-0000-4000-8000-000000000001";
const quoteId = "80000000-0000-4000-8000-000000000001";
const updatedAt = new Date("2026-08-24T12:00:00.000Z");

function compile(query: SQL) {
  return dialect.sqlToQuery(query);
}

function executionDatabase(rows: readonly Record<string, unknown>[] = []) {
  const execute = vi.fn(async (query: SQL) => {
    void query;
    return { rows };
  });
  return {
    database: { execute } as unknown as Database,
    execute,
  };
}

function compiled(execute: ReturnType<typeof vi.fn>) {
  return compile(execute.mock.calls[0]![0] as SQL);
}

function sqlBetween(sqlText: string, start: string, end: string): string {
  const startIndex = sqlText.indexOf(start);
  const endIndex = sqlText.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return sqlText.slice(startIndex, endIndex);
}

function expectSelectedEstimateSemanticFreshness(sqlText: string): void {
  expect(sqlText).toContain("estimate.input_snapshot");
  expect(sqlText).toContain("current_estimate_semantics as materialized");
  expect(sqlText).toContain("when 'INDIVIDUAL' then 'RESIDENTIAL'");
  expect(sqlText).toContain("when 'BUSINESS' then 'B2B'");
  expect(sqlText).toContain("else null");
  expect(sqlText).toContain(
    "'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'",
  );
  expect(sqlText).not.toContain("'UNCLASSIFIED'");
  const freshnessDecision = sqlBetween(
    sqlText,
    "from current_estimate_semantics, selected_estimate",
    ") then 'CONFLICT'",
  );
  expect(freshnessDecision).toContain(
    "= (selected_estimate.input_snapshot ->> 'customerSegment')",
  );
  expect(freshnessDecision).toContain(
    "= (selected_estimate.input_snapshot ->> 'travelZoneCode')",
  );
  expect(freshnessDecision).not.toContain("is not distinct from");
}

function expectSelectedEstimateResolvedVat(query: ReturnType<typeof compile>): void {
  const end = query.sql.includes("estimate_evidence_integrity as materialized")
    ? "estimate_evidence_integrity as materialized"
    : "line_input as materialized";
  const selected = sqlBetween(query.sql, "selected_estimate as materialized", end);
  expect(selected).toContain("'{configuration,vatConfiguration}'");
  expect(selected).toContain("-> 'mode'");
  expect(selected).toContain("-> 'rateBasisPoints'");
  expect(selected).toContain("'{result,vatRateBasisPoints}'");
  expect(selected).toContain("estimate.vat_rate_basis_points is not null");
  expect(selected).toContain("= to_jsonb(estimate.vat_rate_basis_points)");
  expect(selected).toMatch(/-> 'rateBasisPoints'\) = \(estimate.price_snapshot #> '\{result,vatRateBasisPoints\}'\)/);
  expect(selected.match(/jsonb_typeof\([^\n]+\) = 'number'/g)).toHaveLength(2);
  expect(selected.match(/::numeric between \$\d+ and \$\d+/g)).toHaveLength(2);
  expect(selected).toContain("->> 'mode' = 'VAT_REGISTERED'");
  expect(selected).toContain("-> 'rateBasisPoints') = '0'::jsonb");
  expect(query.params).toEqual(expect.arrayContaining([
    "VAT_REGISTERED", "VAT_NOT_REGISTERED", 0, 10_000,
  ]));
  // Resolution is a source gate, not a reinterpretation of manual totals or history.
  expect(selected).not.toContain("gross_total_minor_units is not null");
  expect(query.sql).not.toContain('update "request_estimates"');
}

const requestItem = {
  serviceId: 10,
  cleaningItemTypeId: 20,
  cleaningAssetId: assetId,
  measurementModeId: 30,
  customerReportedConditionLevelId: 40,
  normalizedConditionLevelId: null,
  reportedFibreMaterialId: 50,
  normalizedFibreMaterialId: null,
  reportedSurfaceConstructionId: 60,
  normalizedSurfaceConstructionId: null,
  customerDescription: "One sofa",
  normalizedDescription: null,
  quantity: 1,
  areaHundredthsM2: null,
  seatCount: 2,
  sides: null,
  sortOrder: 0,
  issueTypeIds: [70],
  addonIds: [80],
} as const;

const baseRequest: CreateRequestRecordInput = {
  requestReference: "REQ-000000000000000000000001",
  source: "CUSTOMER_PORTAL",
  customerId,
  requestingProfileId: actorId,
  propertyId,
  preferredLocale: "en",
  contactName: "Customer",
  contactEmail: "customer@example.invalid",
  contactPhone: null,
  customerNotes: "Please review",
  preferredDate: "2026-09-01",
  preferredWindowCode: "morning",
  originalSubmission: { source: "test" },
  items: [requestItem],
};

const quoteLine: QuoteLineInput = {
  requestItemId: itemId,
  serviceId: 10,
  cleaningItemTypeId: 20,
  measurementModeId: 30,
  descriptionBg: "Диван",
  descriptionEn: "Sofa",
  quantity: 1,
  measurementSnapshot: {
    areaHundredthsM2: null,
    seatCount: 2,
    sides: null,
  },
  baseAmountMinorUnits: 4_000,
  modifierAmountMinorUnits: 0,
  addonAmountMinorUnits: 0,
  netAmountMinorUnits: 4_000,
  vatRateBasisPoints: 2_000,
  vatAmountMinorUnits: 800,
  grossTotalMinorUnits: 4_800,
  calculationSnapshot: {},
  sortOrder: 0,
};

const quoteCommercial: QuoteCommercialInput = {
  estimateId,
  currency: "EUR",
  priceBasis: "NET",
  netAmountMinorUnits: 4_000,
  vatRateBasisPoints: 2_000,
  vatAmountMinorUnits: 800,
  grossTotalMinorUnits: 4_800,
  estimatedDurationMinutes: 60,
  commercialSnapshot: {},
  termsSnapshot: {},
  validFrom: new Date("2026-08-24T12:00:00.000Z"),
  validUntil: new Date("2026-09-24T12:00:00.000Z"),
  staffNotes: "Internal",
  customerNotes: "Customer safe",
  items: [quoteLine],
};

describe("request/quote SQL authorization", () => {
  it("normalizes Neon HTTP timestamp strings at request and quote boundaries", async () => {
    const requestDates = {
      submittedAt: "2026-08-28T06:00:00.000Z",
      updatedAt: "2026-08-28T06:05:00.000Z",
    };
    const staff = executionDatabase([
      {
        id: requestId,
        requestReference: baseRequest.requestReference,
        source: "PUBLIC_WEB",
        customerResolutionStatus: "UNRESOLVED",
        customerId: null,
        propertyId: null,
        status: "SUBMITTED",
        preferredLocale: "bg",
        contactName: "Synthetic customer",
        contactEmail: null,
        contactPhone: null,
        manualReviewRequired: true,
        version: 1,
        ...requestDates,
        total: "1",
      },
    ]);
    const staffPage = await listStaffRequestRecords(staff.database, actorId, {
      limit: 25,
      offset: 0,
    });
    expect(staffPage.items[0]?.submittedAt).toEqual(
      new Date(requestDates.submittedAt),
    );

    const customer = executionDatabase([
      {
        requestReference: baseRequest.requestReference,
        status: "SUBMITTED",
        preferredLocale: "bg",
        customerNotes: null,
        preferredDate: null,
        preferredWindowCode: null,
        manualReviewRequired: true,
        ...requestDates,
      },
    ]);
    const customerRequests = await listCustomerRequestRecords(
      customer.database,
      actorId,
    );
    expect(customerRequests[0]?.updatedAt).toEqual(
      new Date(requestDates.updatedAt),
    );

    const quoteDates = {
      validFrom: "2026-08-28T06:00:00.000Z",
      validUntil: "2026-09-28T06:00:00.000Z",
      issuedAt: "2026-08-28T06:10:00.000Z",
    };
    const quote = executionDatabase([
      {
        quoteReference: "QUO-000000000000000000000001",
        requestReference: baseRequest.requestReference,
        quoteVersion: 1,
        status: "ISSUED",
        currency: "EUR",
        priceBasis: "NET",
        netAmountMinorUnits: 4_000,
        vatRateBasisPoints: 2_000,
        vatAmountMinorUnits: 800,
        grossTotalMinorUnits: 4_800,
        estimatedDurationMinutes: 60,
        customerNotes: null,
        ...quoteDates,
      },
    ]);
    const customerQuotes = await listCustomerQuoteRecords(
      quote.database,
      actorId,
    );
    expect(customerQuotes[0]?.validUntil).toEqual(
      new Date(quoteDates.validUntil),
    );
  });

  it("requires both current CRM and operations permissions for staff", () => {
    const read = compile(staffRequestReadSql(actorId));
    const manage = compile(staffRequestManageSql(actorId));

    expect(read.params).toEqual(
      expect.arrayContaining([
        "CUSTOMER_RECORDS_READ",
        "OPERATIONS_READ",
        actorId,
      ]),
    );
    expect(manage.params).toEqual(
      expect.arrayContaining([
        "CUSTOMER_RECORDS_MANAGE",
        "OPERATIONS_MANAGE",
        actorId,
      ]),
    );
    expect(read.sql).toContain("actor_profile.status = 'ACTIVE'");
    expect(read.sql).toContain("actor_assignment.active = true");
    expect(read.sql).toContain("actor_permission.active = true");
  });

  it("binds customer access to one exact active unrevoked link", () => {
    const query = compile(
      exactLinkedCustomerSql(actorId, customerId, "OWN_CUSTOMER_DATA_READ"),
    );
    expect(query.sql).toContain('from "customer_identity_links" exact_link');
    expect(query.sql).toContain("exact_link.active = true");
    expect(query.sql).toContain("exact_link.revoked_at is null");
    expect(query.sql).toContain("linked_customer.status = 'ACTIVE'");
    expect(query.params).toEqual(
      expect.arrayContaining([actorId, customerId, "OWN_CUSTOMER_DATA_READ"]),
    );
  });

  it("applies source, date, manual-review and bounded search inbox filters", async () => {
    const fake = executionDatabase();
    await listStaffRequestRecords(fake.database, actorId, {
      search: "REQ-ABC",
      source: "PUBLIC_WEB",
      manualReviewRequired: true,
      submittedFrom: new Date("2026-08-01T00:00:00.000Z"),
      submittedTo: new Date("2026-09-01T00:00:00.000Z"),
      limit: 25,
      offset: 0,
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("request.source =");
    expect(query.sql).toContain("request.manual_review_required =");
    expect(query.sql).toContain("request.submitted_at >=");
    expect(query.sql).toContain("request.submitted_at <");
    expect(query.sql).toContain("request.request_reference ilike");
    expect(query.sql).not.toContain("request.contact_name ilike");
    expect(query.sql).not.toContain("contact_email ilike");
  });

  it("loads internal audit evidence and complete frozen quote lines only for staff", async () => {
    const fake = executionDatabase();
    await loadStaffRequestRecord(fake.database, actorId, requestId);
    const query = compiled(fake.execute);
    expect(query.sql).toContain('from "quote_items" quote_item');
    expect(query.sql).toContain("'requestItemId', quote_item.request_item_id");
    expect(query.sql).toContain(
      "'calculationSnapshot', quote_item.calculation_snapshot",
    );
    expect(query.sql).toContain('as "auditTimeline"');
    expect(query.sql).toContain('request.staff_notes as "staffNotes"');
    expect(query.sql).toContain("'price_snapshot_sha256'");
    expect(query.sql).toContain("encode(sha256(convert_to");
    expect(query.sql).toContain(
      "'reportedFibreMaterialId', item.reported_fibre_material_id",
    );
    expect(query.sql).toContain(
      "'normalizedFibreMaterialId', item.normalized_fibre_material_id",
    );
    expect(query.sql).toContain(
      "'reportedSurfaceConstructionId', item.reported_surface_construction_id",
    );
    expect(query.sql).toContain(
      "'normalizedSurfaceConstructionId', item.normalized_surface_construction_id",
    );
  });

  it("keeps staff-normalized item details out of the customer request projection", async () => {
    const fake = executionDatabase();
    await loadCustomerRequestRecord(
      fake.database,
      actorId,
      baseRequest.requestReference,
    );
    const query = compiled(fake.execute);
    expect(query.sql).toContain(
      "'customerDescription', item.customer_description",
    );
    expect(query.sql).not.toContain("'normalizedDescription'");
    expect(query.sql).not.toContain("normalized_fibre_material_id");
    expect(query.sql).not.toContain("normalized_surface_construction_id");
  });
});

describe("request creation and CRM resolution", () => {
  it("creates anonymous requests unresolved without accounts, prices or inferred services", async () => {
    const fake = executionDatabase([
      {
        result: "CREATED",
        requestReference: baseRequest.requestReference,
        version: 1,
      },
    ]);
    await createPublicCodeRequestRecord(fake.database, {
      requestReference: baseRequest.requestReference,
      preferredLocale: "en",
      contactName: "Public customer",
      contactEmail: "public@example.invalid",
      contactPhone: null,
      customerNotes: null,
      preferredDate: null,
      preferredWindowCode: "flexible",
      originalSubmission: { services: ["SOFA_2_SEAT"] },
      itemTypeCodes: ["SOFA_2_SEAT"],
      conditionLevelCode: "NORMAL",
      customerDescription: "Original aggregate description",
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("resolved_items as materialized");
    expect(query.sql).toContain("item_type.active = true");
    expect(query.sql).toContain("condition.active = true");
    expect(query.sql).toContain("'PUBLIC_WEB', 'UNRESOLVED'");
    expect(query.sql).toContain("select created_request.id, null");
    expect(query.sql).toMatch(/concat\([\s\S]*\$\d+::text[\s\S]*\)/);
    expect(query.sql).toMatch(/'itemCount', \$\d+::integer/);
    expect(query.sql).toContain("'REQUEST_SUBMITTED'");
    expect(query.sql).not.toContain("customer_identity_links");
    expect(query.sql).not.toContain("user_profiles");
    expect(query.sql).not.toContain("price_books");
    expect(query.sql).not.toContain('join "services"');
  });

  it("proves every customer-selected property, asset and active catalogue reference", async () => {
    const fake = executionDatabase([
      {
        result: "CREATED",
        requestReference: baseRequest.requestReference,
        version: 1,
      },
    ]);
    const { source, requestingProfileId, ...customerRequest } = baseRequest;
    void source;
    void requestingProfileId;
    await createCustomerRequestRecord(fake.database, actorId, customerRequest);
    const query = compiled(fake.execute);
    expect(query.sql).toContain('from "cleaning_assets" selected_asset');
    expect(query.sql).toContain("asset_property.customer_id =");
    expect(query.sql).toContain("asset_property.id =");
    expect(query.sql).toContain("selected_asset.status = 'ACTIVE'");
    expect(query.sql).toContain("selected_service.active = true");
    expect(query.sql).toContain("selected_type.active = true");
    expect(query.sql).toContain('from "service_item_capabilities" capability');
    expect(query.sql).toContain('join "capability_statuses" capability_status');
    expect(query.sql).not.toContain("selected_service.category_id");
    expect(query.params.join(" ")).toContain(assetId);
  });

  it("creates a new CRM customer/contact/property and request link in one audited statement", async () => {
    const fake = executionDatabase([
      {
        result: "CHANGED",
        id: requestId,
        version: 2,
        updatedAt,
      },
    ]);
    await createCustomerFromRequestRecord(fake.database, actorId, {
      requestId,
      expectedVersion: 1,
      customerType: "INDIVIDUAL",
      displayName: "New customer",
      legalName: null,
      internalNotes: null,
      property: {
        propertyType: "RESIDENTIAL",
        label: "Home",
        city: "Sofia",
        district: "Centre",
        streetAddress: "Reviewed address",
        postalCode: null,
        serviceZoneId: 1,
      },
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain('insert into "customers"');
    expect(query.sql).toContain('insert into "customer_contacts"');
    expect(query.sql).toContain('insert into "properties"');
    expect(query.sql).toContain('from "travel_zones" zone');
    expect(query.sql).toContain("service_zone_id");
    expect(query.sql).toContain("zone.active = true");
    expect(query.sql).toContain('update "service_requests"');
    expect(query.sql).toContain("customer_resolution_status = 'LINKED'");
    expect(query.sql).toContain("'REQUEST_LINKED'");
    expect(query.sql).toContain("for update of request");
  });

  it("updates a linked request property for the same customer but rejects cross-customer relinking", async () => {
    const fake = executionDatabase([
      { result: "CHANGED", id: requestId, version: 2, updatedAt },
    ]);
    const result = await linkRequestRecord(fake.database, actorId, {
      requestId,
      expectedVersion: 1,
      customerId,
      propertyId,
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("property_id from target");
    expect(query.sql).toContain("is not distinct from");
    expect(query.sql).toContain(
      "when (select customer_id from target) is not null",
    );
    expect(query.sql).toContain("(select customer_id from target) <>");
    expect(query.sql).toContain("'propertyChanged'");
    expect(result).toMatchObject({ status: "CHANGED", version: 2 });
  });

  it("changes only unresolved CRM resolution states with optimistic locking and audit", async () => {
    const fake = executionDatabase([
      { result: "CHANGED", id: requestId, version: 2, updatedAt },
    ]);
    await setRequestResolutionRecord(fake.database, actorId, {
      requestId,
      expectedVersion: 1,
      fromStatus: "UNRESOLVED",
      toStatus: "MATCH_CANDIDATE",
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("customer_resolution_status =");
    expect(query.sql).toContain("request.customer_id is null");
    expect(query.sql).toContain(
      "request.status not in ('QUOTED', 'CLOSED', 'DECLINED')",
    );
    expect(query.sql).toContain("'customerResolutionStatus'");
    expect(query.sql).toContain("'REQUEST_STATUS_CHANGED'");
  });
});

describe("normalization and estimate integrity", () => {
  it("updates only normalized interpretation with active refs, versions and audit", async () => {
    const fake = executionDatabase([
      {
        result: "CHANGED",
        id: requestId,
        version: 3,
        updatedAt,
      },
    ]);
    await normalizeRequestRecord(fake.database, actorId, {
      requestId,
      expectedVersion: 2,
      staffNotes: "Reviewed",
      items: [
        {
          itemId,
          expectedVersion: 1,
          serviceId: 10,
          cleaningItemTypeId: 20,
          cleaningAssetId: assetId,
          measurementModeId: 30,
          normalizedConditionLevelId: 41,
          normalizedFibreMaterialId: 51,
          normalizedSurfaceConstructionId: 61,
          normalizedDescription: "Normalized sofa",
          quantity: 1,
          areaHundredthsM2: null,
          seatCount: 2,
          sides: null,
          sortOrder: 0,
          issueTypeIds: [70],
          addonIds: [80],
        },
      ],
    });
    const query = compiled(fake.execute);
    const serializedItems = query.params.find(
      (parameter) =>
        typeof parameter === "string" && parameter.includes('"item_id"'),
    );
    expect(serializedItems).toBeTypeOf("string");
    expect(JSON.parse(serializedItems as string)).toMatchObject([
      {
        normalized_fibre_material_id: 51,
        normalized_surface_construction_id: 61,
      },
    ]);
    expect(serializedItems).not.toContain("reported_fibre_material_id");
    expect(serializedItems).not.toContain("reported_surface_construction_id");
    expect(serializedItems).not.toContain(
      "customer_reported_condition_level_id",
    );
    expect(query.sql).toContain(
      "current_item.version <> item.expected_version",
    );
    expect(query.sql).toContain("selected_service.active = true");
    expect(query.sql).toContain("selected_type.active = true");
    expect(query.sql).toContain("selected_asset.property_id =");
    expect(query.sql).toContain(
      'from "cleaning_item_type_measurement_modes" supported_measurement',
    );
    expect(query.sql).toContain(
      'left join "service_addon_capabilities" addon_capability',
    );
    expect(query.sql).toContain("capability_status.code <> 'UNAVAILABLE'");
    expect(query.sql).toContain(
      "addon_capability_status.code <> 'UNAVAILABLE'",
    );
    expect(query.sql).toContain(
      "coalesce(item.normalized_fibre_material_id, current_item.reported_fibre_material_id)",
    );
    expect(query.sql).toContain(
      "coalesce(item.normalized_surface_construction_id, current_item.reported_surface_construction_id)",
    );
    expect(query.sql).toContain(
      "normalized_condition_level_id = item.normalized_condition_level_id",
    );
    expect(query.sql).toContain(
      "normalized_fibre_material_id = item.normalized_fibre_material_id",
    );
    expect(query.sql).toContain(
      "normalized_surface_construction_id = item.normalized_surface_construction_id",
    );
    expect(query.sql).not.toContain(
      "customer_reported_condition_level_id = item.condition_level_id",
    );
    expect(query.sql).not.toContain(
      "reported_fibre_material_id = item.normalized_fibre_material_id",
    );
    expect(query.sql).not.toContain(
      "reported_surface_construction_id = item.normalized_surface_construction_id",
    );
    expect(query.sql).toContain("unconfirmed_customer_issues as");
    expect(query.sql).toContain("set staff_confirmed = false");
    expect(query.sql).toContain("unconfirmed_customer_addons as");
    expect(query.sql).toContain("set staff_included = false");

    const staffIssueDeletion = sqlBetween(
      query.sql,
      "removed_staff_issues as",
      "unconfirmed_customer_issues as",
    );
    expect(staffIssueDeletion).toContain("current_issue.customer_reported = false");
    expect(staffIssueDeletion).toContain("not exists");
    expect(staffIssueDeletion).toContain(
      "jsonb_array_elements_text(item.issue_type_ids)",
    );
    expect(staffIssueDeletion).toContain(
      "retained_issue.value::integer = current_issue.issue_type_id",
    );

    const staffAddonDeletion = sqlBetween(
      query.sql,
      "removed_staff_addons as",
      "unconfirmed_customer_addons as",
    );
    expect(staffAddonDeletion).toContain("current_addon.customer_requested = false");
    expect(staffAddonDeletion).toContain("not exists");
    expect(staffAddonDeletion).toContain(
      "jsonb_array_elements_text(item.addon_ids)",
    );
    expect(staffAddonDeletion).toContain(
      "retained_addon.value::integer = current_addon.addon_id",
    );
    expect(query.sql).toContain("version = current_item.version + 1");
    expect(query.sql).toContain("'REQUEST_NORMALIZED'");
    expect(query.sql).not.toContain("original_submission =");
    expect(query.sql).not.toContain("customer_description =");
  });

  it("derives estimate codes and measurements exclusively from the persisted graph", async () => {
    const engineInput = {
      customerSegment: "RESIDENTIAL",
      items: [],
      conditionBandCode: "NORMAL",
      travelZoneCode: "SOFIA_CORE",
      timingCategoryCode: "STANDARD",
      governanceReviewReasonCodes: [],
    } as const;
    const fake = executionDatabase([{ result: "READY", engineInput }]);
    await deriveEstimateEngineInputRecord(fake.database, actorId, requestId, 4);
    const query = compiled(fake.execute);
    expect(query.sql).toContain("normalized_item_rows as materialized");
    expect(query.sql).toContain('join "services" service');
    expect(query.sql).toContain('join "cleaning_item_types" item_type');
    expect(query.sql).toContain('from "service_request_item_issues"');
    expect(query.sql).toContain('from "service_request_item_addons"');
    expect(query.sql).toContain('from "cleaning_asset_reported_risk_flags"');
    expect(query.sql).toContain("selected_issue.staff_confirmed = true");
    expect(query.sql).toContain("selected_addon.staff_included = true");
    expect(query.sql).toContain("capability_status.code <> 'UNAVAILABLE'");
    expect(query.sql).toContain("item.normalized_condition_level_id");
    expect(query.sql).toContain(
      "coalesce(item.normalized_fibre_material_id, item.reported_fibre_material_id)",
    );
    expect(query.sql).toContain(
      "coalesce(item.normalized_surface_construction_id, item.reported_surface_construction_id)",
    );
    expect(query.sql).toContain(
      'join "cleaning_item_type_measurement_modes" supported_measurement',
    );
    expect(query.sql).toContain("'CATALOGUE_ASSESSMENT_REQUIRED'");
    expect(query.sql).toContain("'CATALOGUE_SPECIALIST_ONLY'");
    expect(query.sql).toContain("'MISSING_MATERIAL'");
    expect(query.sql).toContain("'MISSING_MEASUREMENT'");
    expect(query.sql).toContain("'governanceReviewReasonCodes'");
    expect(query.sql).toContain("property.customer_id = target.customer_id");
    expect(query.sql).toContain(
      "customer.customer_type in ('INDIVIDUAL', 'BUSINESS')",
    );
    expect(query.sql).toContain(
      "'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'",
    );
    expect(query.sql).not.toContain("'UNCLASSIFIED'");
    expect(query.sql).not.toContain("customer.version");
    expect(query.sql).not.toContain("property.version");
    expect(query.sql).toContain("request.version");
    expect(query.sql).toContain("'READY_TO_QUOTE', 'QUOTED'");
    expect(query.params).toEqual(
      expect.arrayContaining([
        requestId,
        actorId,
        "CUSTOMER_RECORDS_MANAGE",
        "OPERATIONS_MANAGE",
        4,
      ]),
    );
    expect(query.params).not.toContain("TAMPERED_SERVICE");
  });

  it("appends a monotonic full-snapshot estimate and business audit", async () => {
    const calculation = calculateStaffEstimate(
      {
        customerSegment: "RESIDENTIAL",
        conditionBandCode: "NORMAL",
        travelZoneCode: "SOFIA_CORE",
        timingCategoryCode: "STANDARD",
        governanceReviewReasonCodes: [],
        items: [
          {
            serviceCode: "UPHOLSTERY_CARE",
            itemTypeCode: "SOFA_2_SEAT",
            quantity: 1,
            issueCodes: [],
            addonCodes: [],
            riskFlagCodes: [],
          },
        ],
      },
      "2026-08-24T12:00:00.000Z",
    );
    const fake = executionDatabase([
      {
        result: "CREATED",
        id: estimateId,
        estimateVersion: 2,
        requestVersion: 5,
      },
    ]);
    await appendEstimateRecord(fake.database, actorId, {
      requestId,
      expectedRequestVersion: 4,
      engineInput: calculation.priceSnapshot.input,
      calculation,
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain(
      "coalesce(max(estimate.estimate_version), 0) + 1",
    );
    expect(query.sql).toContain('insert into "request_estimates"');
    expect(query.sql).toContain("commercial_context as materialized");
    expect(query.sql).toContain("for share of customer, property");
    expect(query.sql).toContain("travel_context as materialized");
    expect(query.sql).toContain("for share of zone");
    expect(query.sql).toContain("current_estimate_semantics as materialized");
    expect(query.sql).toContain("when 'INDIVIDUAL' then 'RESIDENTIAL'");
    expect(query.sql).toContain("when 'BUSINESS' then 'B2B'");
    expect(query.sql).toContain("else null");
    expect(query.sql).toContain(
      "estimate_input.input_snapshot ->> 'customerSegment'",
    );
    expect(query.sql).toContain(
      "estimate_input.input_snapshot ->> 'travelZoneCode'",
    );
    const freshnessDecision = sqlBetween(
      query.sql,
      "from current_estimate_semantics, estimate_input",
      ") then 'CONFLICT'",
    );
    expect(freshnessDecision).toContain(
      "= (estimate_input.input_snapshot ->> 'customerSegment')",
    );
    expect(freshnessDecision).toContain(
      "= (estimate_input.input_snapshot ->> 'travelZoneCode')",
    );
    expect(freshnessDecision).not.toContain("is not distinct from");
    expect(query.sql).toContain(
      "'SOFIA_CORE', 'SOFIA_EXTENDED', 'SOFIA_OUTSKIRTS', 'OUTSIDE_SOFIA'",
    );
    expect(query.sql).not.toContain("'UNCLASSIFIED'");
    expect(query.sql).not.toContain("customer.version");
    expect(query.sql).not.toContain("property.version");
    expect(query.sql).toContain("then 'CONFLICT'");
    expect(query.sql).toContain("'READY_TO_QUOTE', 'QUOTED'");
    expect(query.sql).toContain("source_request_version");
    expect(query.sql).toContain("manual_review_required =");
    expect(query.sql).toContain("version = request.version + 1");
    expect(query.sql).toContain('request_changed.version as "requestVersion"');
    expect(query.sql).toContain("availability_snapshot");
    expect(query.sql).toContain("review_reason_codes");
    expect(query.sql).toContain("'ESTIMATE_CREATED'");
    expect(query.sql).not.toContain('update "request_estimates"');
  });
});

describe("quote lifecycle, concurrency and customer projection", () => {
  it("creates monotonic drafts and freezes quote lines with audit", async () => {
    const fake = executionDatabase([
      {
        result: "CREATED",
        id: quoteId,
        quoteReference: "Q-000000000000000000000001",
        quoteVersion: 2,
        recordVersion: 1,
        quoteStatus: "DRAFT",
      },
    ]);
    await createQuoteDraftRecord(fake.database, actorId, {
      ...quoteCommercial,
      requestId,
      expectedRequestVersion: 4,
      quoteReference: "Q-000000000000000000000001",
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain(
      "coalesce(max(quote_record.quote_version), 0) + 1",
    );
    expect(query.sql).toContain('insert into "quotes"');
    expect(query.sql).toContain("commercial_context as materialized");
    expect(query.sql).toContain("customer.status = 'ACTIVE'");
    expect(query.sql).toContain("property.status = 'ACTIVE'");
    expect(query.sql).toContain("property.customer_id = customer.id");
    expect(query.sql).toContain("estimate.source_request_version");
    expect(query.sql).toContain("estimate.decline_or_refer_required = false");
    expect(query.sql).toContain("priceSnapshotSha256");
    expect(query.sql).toContain("encode(sha256(convert_to");
    expectSelectedEstimateSemanticFreshness(query.sql);
    expectSelectedEstimateResolvedVat(query);
    expect(query.sql).toContain("source_request_version");
    expect(query.sql).toContain('insert into "quote_items"');
    expect(query.sql).toContain(
      "request_item.service_id is not distinct from line.service_id",
    );
    expect(query.sql).toContain("count(request_item_id) =");
    expect(query.sql).toContain("count(distinct request_item_id) =");
    expect(query.sql).toContain("request_item.quantity = line.quantity");
    expect(query.sql).toContain(
      "line.measurement_snapshot = jsonb_build_object",
    );
    expect(query.sql).toContain('join "services" line_service');
    expect(query.sql).toContain("line_capability_status.code <> 'UNAVAILABLE'");
    expect(query.sql).toContain("'DRAFT'");
    expect(query.sql).toContain("'QUOTE_DRAFT_CREATED'");
  });

  it("rejects null, duplicate or measurement-tampered quote line provenance at the SQL boundary", async () => {
    const fake = executionDatabase([{ result: "INVALID_REFERENCE" }]);
    const result = await createQuoteDraftRecord(fake.database, actorId, {
      ...quoteCommercial,
      requestId,
      expectedRequestVersion: 4,
      quoteReference: "Q-000000000000000000000001",
      items: [
        {
          ...quoteLine,
          requestItemId: null,
          quantity: 999,
          measurementSnapshot: {
            areaHundredthsM2: 999,
            seatCount: null,
            sides: null,
          },
        },
        quoteLine,
        { ...quoteLine, sortOrder: 2 },
      ],
    });
    const query = compiled(fake.execute);
    const serializedLines = query.params.find(
      (parameter) =>
        typeof parameter === "string" &&
        parameter.includes('"request_item_id"'),
    );

    expect(result).toEqual({ status: "INVALID_REFERENCE" });
    expect(query.sql).toContain("count(request_item_id) =");
    expect(query.sql).toContain("count(distinct request_item_id) =");
    expect(query.sql).toContain('from "service_request_items" request_item');
    expect(query.sql).toContain("request_item.quantity = line.quantity");
    expect(query.sql).toContain(
      "line.measurement_snapshot = jsonb_build_object",
    );
    expect(typeof serializedLines).toBe("string");
    if (typeof serializedLines !== "string") {
      throw new Error("Expected serialized quote lines in the SQL parameters.");
    }
    expect(serializedLines).toContain('"request_item_id":null');
    expect(serializedLines).toContain('"quantity":999');
    expect(serializedLines.split(itemId)).toHaveLength(3);
  });

  it("updates commercial fields only while status is DRAFT and with expected version", async () => {
    const fake = executionDatabase([
      {
        result: "CHANGED",
        id: quoteId,
        quoteReference: "Q-000000000000000000000001",
        quoteVersion: 1,
        recordVersion: 2,
        quoteStatus: "DRAFT",
      },
    ]);
    await updateQuoteDraftRecord(fake.database, actorId, {
      ...quoteCommercial,
      quoteId,
      expectedRecordVersion: 1,
      expectedRequestVersion: 4,
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("quote_record.status = 'DRAFT'");
    expect(query.sql).toContain("for share of customer, property");
    expect(query.sql).toContain("quote_record.record_version =");
    expect(query.sql).toContain(
      "not exists (select 1 from commercial_context)",
    );
    expect(query.sql).toContain(
      "request_item.cleaning_item_type_id is not distinct from line.cleaning_item_type_id",
    );
    expect(query.sql).toContain("count(request_item_id) =");
    expect(query.sql).toContain("count(distinct request_item_id) =");
    expect(query.sql).toContain("request_item.quantity = line.quantity");
    expect(query.sql).toContain(
      "line.measurement_snapshot = jsonb_build_object",
    );
    expect(query.sql).toContain("request.version as request_version");
    expect(query.sql).toContain("request_version from target");
    expect(query.sql).toContain(
      "estimate.source_request_version = target.request_version",
    );
    expect(query.sql).toContain("estimate.decline_or_refer_required = false");
    expect(query.sql).toContain("priceSnapshotSha256");
    expect(query.sql).toContain("encode(sha256(convert_to");
    expectSelectedEstimateSemanticFreshness(query.sql);
    expectSelectedEstimateResolvedVat(query);
    expect(query.sql).toContain(
      "source_request_version = target.request_version",
    );
    expect(query.sql).toContain(
      "record_version = quote_record.record_version + 1",
    );
    expect(query.sql).toContain("'QUOTE_DRAFT_UPDATED'");
    expect(query.sql).not.toContain("issued_at =");
    expect(query.sql).not.toContain("superseded_at =");
  });

  it("serializes issue/supersede under row locks and maps uniqueness races to conflict", async () => {
    const fake = executionDatabase([
      {
        result: "CHANGED",
        id: quoteId,
        quoteReference: "Q-000000000000000000000001",
        quoteVersion: 2,
        recordVersion: 2,
        quoteStatus: "ISSUED",
      },
    ]);
    await issueQuoteRecord(fake.database, actorId, {
      quoteId,
      expectedRecordVersion: 1,
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("for update of request, quote_record");
    expect(query.sql).toContain("for update of current_quote");
    expect(query.sql).toContain("status = 'SUPERSEDED'");
    expect(query.sql).toContain("status = 'ISSUED'");
    expect(query.sql).toContain("'QUOTE_SUPERSEDED'");
    expect(query.sql).toContain("'QUOTE_ISSUED'");
    expect(query.sql).toContain("request_quote_versions as materialized");
    expect(query.sql).toContain("latest_quote_version as materialized");
    expect(query.sql).toContain("source_request_version from target");
    expect(query.sql).toContain(
      "estimate.source_request_version = target.request_version",
    );
    expect(query.sql).toContain("estimate.decline_or_refer_required = false");
    expectSelectedEstimateSemanticFreshness(query.sql);
    expectSelectedEstimateResolvedVat(query);
    expect(query.sql).toContain("commercial_context as materialized");
    expect(query.sql).toContain("for share of customer, property");
    expect(query.sql).toContain("for share of estimate");
    expect(query.sql).toContain("estimate_evidence_integrity as materialized");
    expect(query.sql).toContain(
      "not exists (select 1 from estimate_evidence_integrity)",
    );
    expect(query.sql).toContain("jsonb_object_keys");
    expect(query.sql).toContain("jsonb_array_elements");
    expect(query.sql).toContain("'schedulingConfigurationReady'");
    expect(query.sql).toContain("pg_input_is_valid");
    expect(query.sql).toContain("price_config_rule");
    expect(query.sql).toContain("duration_config_rule");
    expect(query.sql).toContain("price_evidence_line");
    expect(query.sql).toContain("price_minimum_line");
    expect(query.sql).toContain("duration_evidence_line");
    expect(query.sql).toContain("unique_price_rule");
    expect(query.sql).toContain("unique_duration_rule");
    expect(query.sql).toContain("encode(sha256(convert_to");
    expect(query.sql).toContain("estimated_travel_minutes is null");
    expect(query.sql).not.toContain("jsonb_object_length");
    expect(query.sql).toContain("issued_source_snapshot as materialized");
    expect(query.sql).toContain(
      "acceptance_source_snapshot = issued_source_snapshot.value",
    );
    expect(query.sql).toContain("customer.version as customer_version");
    expect(query.sql).toContain("property.version as property_version");
    expect(query.sql).toContain("request_item.customer_description");
    expect(query.sql).toContain("request_item.normalized_description");
    expect(query.sql).toContain("selected_estimate.price_snapshot");
    expect(query.sql).toContain("selected_estimate.duration_snapshot");
    expect(query.sql).toContain("quote_item_source_rows as materialized");
    expect(query.sql).toContain("for share of quote_item");
    expect(query.sql).toContain("'quoteItems', coalesce");
    expect(query.sql).toContain("customer.status = 'ACTIVE'");
    expect(query.sql).toContain("property.status = 'ACTIVE'");
    expect(query.sql).toContain("current_catalogue_items as materialized");
    expect(query.sql).toContain("current_assets as materialized");
    expect(query.sql).toContain("request_item.normalized_fibre_material_id");
    expect(query.sql).toContain(
      "request_item.normalized_surface_construction_id",
    );
    expect(query.sql).toContain("line_asset.property_id = target.property_id");
    expect(query.sql).toContain("line_asset.status = 'ACTIVE'");
    expect(query.sql).toContain("for share of line_asset");
    expect(query.sql).toContain("current_addons as materialized");
    expect(query.sql).toContain("line_addon_status.code <> 'UNAVAILABLE'");
    expect(query.sql).toContain(
      "not exists (select 1 from current_request_graph)",
    );
    expect(query.sql).toContain("now() < (select valid_from from target)");
    expect(query.sql).toContain("now() >= (select valid_until from target)");
    expect(query.sql).toContain("'REQUEST_STATUS_CHANGED'");
    expect(query.sql).not.toContain("commercial_snapshot =");

    const execute = vi.fn(async () => {
      throw { code: "23505" };
    });
    const race = await issueQuoteRecord(
      { execute } as unknown as Database,
      actorId,
      { quoteId, expectedRecordVersion: 1 },
    );
    expect(race).toEqual({ status: "CONFLICT" });
  });

  it("withdraws or expires an issued quote and atomically reopens the request", async () => {
    for (const [operation, event, timestamp] of [
      [withdrawQuoteRecord, "QUOTE_WITHDRAWN", "withdrawn_at"],
      [expireQuoteRecord, "QUOTE_EXPIRED", "expired_at"],
    ] as const) {
      const fake = executionDatabase([
        {
          result: "CHANGED",
          id: quoteId,
          quoteReference: "Q-000000000000000000000001",
          quoteVersion: 1,
          recordVersion: 2,
          quoteStatus: event === "QUOTE_EXPIRED" ? "EXPIRED" : "WITHDRAWN",
        },
      ]);
      await operation(fake.database, actorId, {
        quoteId,
        expectedRecordVersion: 1,
      });
      const query = compiled(fake.execute);
      expect(query.sql).toContain(timestamp);
      expect(query.sql).toContain("status = 'READY_TO_QUOTE'");
      expect(query.sql).toContain(event);
      expect(query.sql).toContain("ACTIVE_QUOTE_BECAME_INACTIVE");
    }
  });

  it("customer quote reads require the exact linked customer and hide drafts/internal evidence", async () => {
    const fake = executionDatabase();
    await loadCustomerQuoteRecord(
      fake.database,
      actorId,
      "Q-000000000000000000000001",
    );
    const query = compiled(fake.execute);
    expect(query.sql).toContain("quote_record.issued_at is not null");
    expect(query.sql).toContain("quote_record.status <> 'DRAFT'");
    expect(query.sql).toContain("exact_link.customer_id = request.customer_id");
    expect(query.sql).not.toContain("staff_notes as");
    expect(query.sql).not.toContain("commercial_snapshot as");
    expect(query.sql).not.toContain("calculation_snapshot',");
  });

  it("enforces valid request transitions, expected version and same-transaction audit", async () => {
    const fake = executionDatabase([
      {
        result: "CHANGED",
        id: requestId,
        version: 2,
        updatedAt,
      },
    ]);
    await transitionRequestRecord(fake.database, actorId, {
      requestId,
      expectedVersion: 1,
      fromStatus: "SUBMITTED",
      toStatus: "IN_REVIEW",
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("request.version =");
    expect(query.sql).toContain("'SUBMITTED'");
    expect(query.sql).toContain("'IN_REVIEW'");
    expect(query.sql).toContain("'REQUEST_STATUS_CHANGED'");
  });

  it("fails closed before READY_TO_QUOTE unless linked normalized location data is current", async () => {
    const fake = executionDatabase([
      { result: "CHANGED", id: requestId, version: 5, updatedAt },
    ]);
    await transitionRequestRecord(fake.database, actorId, {
      requestId,
      expectedVersion: 4,
      fromStatus: "IN_REVIEW",
      toStatus: "READY_TO_QUOTE",
    });
    const query = compiled(fake.execute);
    expect(query.sql).toContain("ready_reference as materialized");
    expect(query.sql).toContain("target.customer_resolution_status = 'LINKED'");
    expect(query.sql).toContain("property.service_zone_id");
    expect(query.sql).toContain("item.normalized_condition_level_id");
    expect(query.sql).toContain(
      "coalesce(item.normalized_fibre_material_id, item.reported_fibre_material_id)",
    );
    expect(query.sql).toContain(
      "coalesce(item.normalized_surface_construction_id, item.reported_surface_construction_id)",
    );
    expect(query.sql).toContain('from "service_item_capabilities" capability');
    expect(query.sql).toContain(
      'from "cleaning_item_type_measurement_modes" supported_measurement',
    );
    expect(query.sql).toContain("capability_status.code <> 'UNAVAILABLE'");
    expect(query.sql).toContain("not exists (select 1 from ready_reference)");
  });
});
