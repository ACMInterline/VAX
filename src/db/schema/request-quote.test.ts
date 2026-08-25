import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { serviceRequests as exportedServiceRequests } from "../schema";
import {
  businessAuditEvents,
  quoteItems,
  quotes,
  requestEstimates,
  serviceRequestItemAddons,
  serviceRequestItemIssues,
  serviceRequestItems,
  serviceRequests,
} from "./request-quote";

const requestQuoteTables = [
  serviceRequests,
  serviceRequestItems,
  serviceRequestItemIssues,
  serviceRequestItemAddons,
  requestEstimates,
  quotes,
  quoteItems,
  businessAuditEvents,
] as const;

describe("request, estimate, quote and business-audit schema contract", () => {
  it("exports exactly the eight additive Phase 3D tables without enabling RLS", () => {
    expect(requestQuoteTables.map(getTableName)).toEqual([
      "service_requests",
      "service_request_items",
      "service_request_item_issues",
      "service_request_item_addons",
      "request_estimates",
      "quotes",
      "quote_items",
      "business_audit_events",
    ]);
    expect(exportedServiceRequests).toBe(serviceRequests);
    expect(
      requestQuoteTables.every((table) => !getTableConfig(table).enableRLS),
    ).toBe(true);
  });

  it("uses UUID records and relational issue/add-on keys", () => {
    for (const table of [
      serviceRequests,
      serviceRequestItems,
      requestEstimates,
      quotes,
      quoteItems,
      businessAuditEvents,
    ] as const) {
      expect(table.id.getSQLType()).toBe("uuid");
      expect(table.id.primary).toBe(true);
    }

    expect(
      getTableConfig(serviceRequestItemIssues).primaryKeys[0]?.columns.map(
        (column) => column.name,
      ),
    ).toEqual(["request_item_id", "issue_type_id"]);
    expect(
      getTableConfig(serviceRequestItemAddons).primaryKeys[0]?.columns.map(
        (column) => column.name,
      ),
    ).toEqual(["request_item_id", "addon_id"]);
  });

  it("never cascades deletion of request, estimate, quote or audit history", () => {
    const foreignKeys = requestQuoteTables.flatMap(
      (table) => getTableConfig(table).foreignKeys,
    );

    expect(foreignKeys.length).toBeGreaterThan(0);
    expect(
      foreignKeys.some((foreignKey) => foreignKey.onDelete === "cascade"),
    ).toBe(false);
    expect(
      foreignKeys.every(
        (foreignKey) =>
          foreignKey.onDelete === "restrict" ||
          foreignKey.onDelete === "set null",
      ),
    ).toBe(true);
  });

  it("retains the immutable submission and full estimate/quote snapshots as JSONB", () => {
    expect(serviceRequests.originalSubmission.getSQLType()).toBe("jsonb");
    expect(requestEstimates.inputSnapshot.getSQLType()).toBe("jsonb");
    expect(requestEstimates.priceSnapshot.getSQLType()).toBe("jsonb");
    expect(requestEstimates.durationSnapshot.getSQLType()).toBe("jsonb");
    expect(requestEstimates.availabilitySnapshot.getSQLType()).toBe("jsonb");
    expect(requestEstimates.reviewReasonCodes.getSQLType()).toBe("jsonb");
    expect(quotes.commercialSnapshot.getSQLType()).toBe("jsonb");
    expect(quotes.termsSnapshot.getSQLType()).toBe("jsonb");
    expect(quotes.acceptanceSourceSnapshot.getSQLType()).toBe("jsonb");
    expect(quotes.acceptanceSourceSnapshot.notNull).toBe(false);
    expect(quoteItems.calculationSnapshot.getSQLType()).toBe("jsonb");
  });

  it("keeps customer-reported and staff-normalized provenance separate", () => {
    expect(serviceRequestItems.customerReportedConditionLevelId.name).toBe(
      "customer_reported_condition_level_id",
    );
    expect(serviceRequestItems.normalizedConditionLevelId.name).toBe(
      "normalized_condition_level_id",
    );
    expect(serviceRequestItems.normalizedConditionLevelId).not.toBe(
      serviceRequestItems.customerReportedConditionLevelId,
    );
    expect(serviceRequestItems.reportedFibreMaterialId.name).toBe(
      "reported_fibre_material_id",
    );
    expect(serviceRequestItems.normalizedFibreMaterialId.name).toBe(
      "normalized_fibre_material_id",
    );
    expect(serviceRequestItems.normalizedFibreMaterialId).not.toBe(
      serviceRequestItems.reportedFibreMaterialId,
    );
    expect(serviceRequestItems.reportedSurfaceConstructionId.name).toBe(
      "reported_surface_construction_id",
    );
    expect(serviceRequestItems.normalizedSurfaceConstructionId.name).toBe(
      "normalized_surface_construction_id",
    );
    expect(serviceRequestItems.normalizedSurfaceConstructionId).not.toBe(
      serviceRequestItems.reportedSurfaceConstructionId,
    );
  });

  it("references canonical CRM, catalogue and commercial definitions", () => {
    const targets = requestQuoteTables.flatMap((table) =>
      getTableConfig(table).foreignKeys.map((foreignKey) =>
        getTableName(foreignKey.reference().foreignTable),
      ),
    );

    expect(targets).toEqual(
      expect.arrayContaining([
        "customers",
        "properties",
        "cleaning_assets",
        "user_profiles",
        "services",
        "cleaning_item_types",
        "measurement_modes",
        "condition_levels",
        "issue_types",
        "service_addons",
        "price_books",
        "duration_models",
      ]),
    );
  });

  it("enforces version uniqueness and a single active issued quote per request", () => {
    const estimateIndexes = getTableConfig(requestEstimates).indexes;
    const quoteIndexes = getTableConfig(quotes).indexes;

    const estimateVersion = estimateIndexes.find(
      (index) =>
        index.config.name === "request_estimates_request_version_unique",
    );
    expect(estimateVersion?.config.unique).toBe(true);

    const quoteVersion = quoteIndexes.find(
      (index) => index.config.name === "quotes_request_version_unique",
    );
    expect(quoteVersion?.config.unique).toBe(true);

    const activeIssued = quoteIndexes.find(
      (index) => index.config.name === "quotes_active_issued_request_unique",
    );
    expect(activeIssued?.config.unique).toBe(true);
    expect(activeIssued?.config.where).toBeDefined();

    expect(requestEstimates.sourceRequestVersion.getSQLType()).toBe("integer");
    expect(quotes.sourceRequestVersion.getSQLType()).toBe("integer");
  });

  it("uses integer EUR money and keeps append-oriented history free of update columns", () => {
    for (const column of [
      requestEstimates.netAmountMinorUnits,
      requestEstimates.vatAmountMinorUnits,
      requestEstimates.grossTotalMinorUnits,
      quotes.netAmountMinorUnits,
      quotes.vatAmountMinorUnits,
      quotes.grossTotalMinorUnits,
      quoteItems.netAmountMinorUnits,
      quoteItems.grossTotalMinorUnits,
    ]) {
      expect(column.getSQLType()).toBe("integer");
    }

    expect("updatedAt" in requestEstimates).toBe(false);
    expect("updatedAt" in quoteItems).toBe(false);
    expect("updatedAt" in businessAuditEvents).toBe(false);
  });

  it("declares lifecycle, provenance, money and reference checks in the database", () => {
    const checkNames = requestQuoteTables.flatMap((table) =>
      getTableConfig(table).checks.map((constraint) => constraint.name),
    );

    expect(checkNames).toEqual(
      expect.arrayContaining([
        "service_requests_reference_valid",
        "service_requests_source_valid",
        "service_requests_resolution_valid",
        "service_requests_status_valid",
        "service_requests_version_positive",
        "service_request_item_issues_provenance_present",
        "service_request_item_addons_provenance_present",
        "request_estimates_status_valid",
        "request_estimates_source_request_version_positive",
        "request_estimates_amount_group_consistent",
        "quotes_reference_valid",
        "quotes_status_valid",
        "quotes_source_request_version_positive",
        "quotes_amounts_consistent",
        "quotes_lifecycle_timestamps_consistent",
        "quote_items_amounts_consistent",
        "business_audit_events_event_type_valid",
      ]),
    );
  });
});
