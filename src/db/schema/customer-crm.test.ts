import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { customers as exportedCustomers } from "../schema";
import {
  cleaningAssetReportedIssues,
  cleaningAssetReportedRiskFlags,
  cleaningAssets,
  customerContacts,
  customerIdentityLinks,
  customers,
  properties,
  propertyAreas,
} from "./customer-crm";

const crmIdentityTables = [
  customers,
  customerContacts,
  customerIdentityLinks,
  properties,
  propertyAreas,
  cleaningAssets,
] as const;

const crmTables = [
  ...crmIdentityTables,
  cleaningAssetReportedIssues,
  cleaningAssetReportedRiskFlags,
] as const;

describe("customer CRM schema contract", () => {
  it("exports exactly the eight additive CRM tables without enabling RLS", () => {
    expect(crmTables.map(getTableName)).toEqual([
      "customers",
      "customer_contacts",
      "customer_identity_links",
      "properties",
      "property_areas",
      "cleaning_assets",
      "cleaning_asset_reported_issues",
      "cleaning_asset_reported_risk_flags",
    ]);
    expect(exportedCustomers).toBe(customers);
    expect(crmTables.every((table) => !getTableConfig(table).enableRLS)).toBe(
      true,
    );
  });

  it("uses UUID identities and composite keys for current issue and risk profiles", () => {
    for (const table of crmIdentityTables) {
      expect(table.id.getSQLType()).toBe("uuid");
      expect(table.id.primary).toBe(true);
    }

    for (const table of [
      customers,
      customerContacts,
      properties,
      propertyAreas,
      cleaningAssets,
    ] as const) {
      expect(table.version.notNull).toBe(true);
      expect(table.version.hasDefault).toBe(true);
    }

    expect(
      getTableConfig(cleaningAssetReportedIssues).primaryKeys[0]?.columns.map(
        (column) => column.name,
      ),
    ).toEqual(["cleaning_asset_id", "issue_type_id"]);
    expect(
      getTableConfig(
        cleaningAssetReportedRiskFlags,
      ).primaryKeys[0]?.columns.map((column) => column.name),
    ).toEqual(["cleaning_asset_id", "risk_flag_id"]);
  });

  it("never cascades CRM foreign-key deletion", () => {
    const foreignKeys = crmTables.flatMap(
      (table) => getTableConfig(table).foreignKeys,
    );

    expect(foreignKeys.length).toBeGreaterThan(0);
    expect(foreignKeys.some((foreignKey) => foreignKey.onDelete === "cascade"))
      .toBe(false);
    expect(
      foreignKeys.every(
        (foreignKey) =>
          foreignKey.onDelete === "restrict" ||
          foreignKey.onDelete === "set null",
      ),
    ).toBe(true);
  });

  it("enforces property ownership when an asset names an area", () => {
    const ownershipForeignKey = getTableConfig(cleaningAssets).foreignKeys.find(
      (foreignKey) =>
        foreignKey.getName() === "cleaning_assets_area_property_fk",
    );

    expect(ownershipForeignKey).toBeDefined();
    const reference = ownershipForeignKey?.reference();
    expect(reference?.columns.map((column) => column.name)).toEqual([
      "area_id",
      "property_id",
    ]);
    expect(reference?.foreignColumns.map((column) => column.name)).toEqual([
      "id",
      "property_id",
    ]);
    expect(
      reference ? getTableName(reference.foreignTable) : undefined,
    ).toBe("property_areas");
    expect(ownershipForeignKey?.onDelete).toBe("restrict");
  });

  it("references existing canonical cleaning and service-area definitions", () => {
    const canonicalTargets = getTableConfig(cleaningAssets).foreignKeys.map(
      (foreignKey) => getTableName(foreignKey.reference().foreignTable),
    );

    expect(canonicalTargets).toEqual(
      expect.arrayContaining([
        "properties",
        "property_areas",
        "cleaning_item_types",
        "fibre_materials",
        "surface_constructions",
        "condition_levels",
      ]),
    );
    expect(
      getTableConfig(properties).foreignKeys.map((foreignKey) =>
        getTableName(foreignKey.reference().foreignTable),
      ),
    ).toContain("travel_zones");
    expect(
      getTableConfig(cleaningAssetReportedIssues).foreignKeys.map(
        (foreignKey) => getTableName(foreignKey.reference().foreignTable),
      ),
    ).toContain("issue_types");
    expect(
      getTableConfig(cleaningAssetReportedRiskFlags).foreignKeys.map(
        (foreignKey) => getTableName(foreignKey.reference().foreignTable),
      ),
    ).toContain("risk_flags");
  });

  it("defines active-primary and active-identity uniqueness plus ownership indexes", () => {
    const contactIndexes = getTableConfig(customerContacts).indexes;
    const linkIndexes = getTableConfig(customerIdentityLinks).indexes;
    const areaIndexes = getTableConfig(propertyAreas).indexes;
    const assetIndexes = getTableConfig(cleaningAssets).indexes;

    const activePrimary = contactIndexes.find(
      (index) => index.config.name === "customer_contacts_active_primary_unique",
    );
    expect(activePrimary?.config.unique).toBe(true);
    expect(activePrimary?.config.where).toBeDefined();

    const activeLink = linkIndexes.find(
      (index) =>
        index.config.name === "customer_identity_links_active_pair_unique",
    );
    expect(activeLink?.config.unique).toBe(true);
    expect(activeLink?.config.where).toBeDefined();

    expect(areaIndexes.map((index) => index.config.name)).toContain(
      "property_areas_id_property_unique",
    );
    expect(assetIndexes.map((index) => index.config.name)).toEqual(
      expect.arrayContaining([
        "cleaning_assets_property_status_idx",
        "cleaning_assets_area_status_idx",
        "cleaning_assets_item_type_status_idx",
      ]),
    );
  });

  it("keeps lifecycle, ownership, contact and measurement checks in the database", () => {
    const checkNames = crmTables.flatMap((table) =>
      getTableConfig(table).checks.map((constraint) => constraint.name),
    );

    expect(checkNames).toEqual(
      expect.arrayContaining([
        "customers_type_valid",
        "customers_status_valid",
        "customers_version_positive",
        "customer_contacts_preferred_method_channel_present",
        "customer_contacts_primary_active",
        "customer_contacts_version_positive",
        "customer_identity_links_relationship_valid",
        "customer_identity_links_active_revocation_consistent",
        "properties_coordinates_complete",
        "properties_coordinates_valid",
        "properties_version_positive",
        "property_areas_other_label_present",
        "property_areas_version_positive",
        "cleaning_assets_status_valid",
        "cleaning_assets_version_positive",
        "cleaning_assets_dimensions_positive",
      ]),
    );
  });
});
