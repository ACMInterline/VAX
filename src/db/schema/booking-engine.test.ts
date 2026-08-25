import { getTableName } from "drizzle-orm";
import { getTableConfig } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { bookings as exportedBookings } from "../schema";
import {
  bookingAuditEvents,
  bookingItems,
  bookingOccupancies,
  bookings,
  quoteAcceptances,
} from "./booking-engine";

const bookingTables = [
  quoteAcceptances,
  bookings,
  bookingItems,
  bookingOccupancies,
  bookingAuditEvents,
] as const;

describe("quote acceptance and booking schema contract", () => {
  it("exports exactly the five additive Phase 3E tables without enabling RLS", () => {
    expect(bookingTables.map(getTableName)).toEqual([
      "quote_acceptances",
      "bookings",
      "booking_items",
      "booking_occupancies",
      "booking_audit_events",
    ]);
    expect(exportedBookings).toBe(bookings);
    expect(
      bookingTables.every((table) => !getTableConfig(table).enableRLS),
    ).toBe(true);
  });

  it("uses restrictive business references and nullable staff attribution only", () => {
    const foreignKeys = bookingTables.flatMap(
      (table) => getTableConfig(table).foreignKeys,
    );

    expect(foreignKeys).toHaveLength(22);
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

    for (const foreignKey of foreignKeys.filter(
      (candidate) => candidate.onDelete === "set null",
    )) {
      expect(
        foreignKey.reference().columns.map((column) => column.name),
      ).toEqual([
        expect.stringMatching(
          /^(?:accepted_by|actor|created_by|updated_by|cancelled_by)_profile_id$/,
        ),
      ]);
      expect(getTableName(foreignKey.reference().foreignTable)).toBe(
        "user_profiles",
      );
    }
  });

  it("freezes accepted quote provenance and booking inputs as JSONB snapshots", () => {
    for (const column of [
      quoteAcceptances.commercialSnapshot,
      quoteAcceptances.termsSnapshot,
      quoteAcceptances.pricingSnapshot,
      quoteAcceptances.durationSnapshot,
      quoteAcceptances.provenanceSnapshot,
      bookings.priceSnapshot,
      bookings.durationSnapshot,
      bookings.schedulingSnapshot,
      bookings.customerSnapshot,
      bookings.propertySnapshot,
      bookingItems.measurementSnapshot,
      bookingItems.calculationSnapshot,
      bookingItems.durationBasisSnapshot,
      bookingOccupancies.availabilityInputSnapshot,
      bookingOccupancies.availabilityResultSnapshot,
      bookingOccupancies.travelSnapshot,
      bookingOccupancies.workingHoursSnapshot,
      bookingOccupancies.equipmentSnapshot,
    ]) {
      expect(column.getSQLType()).toBe("jsonb");
      expect(column.notNull).toBe(true);
    }

    expect("updatedAt" in quoteAcceptances).toBe(false);
    expect("updatedAt" in bookingItems).toBe(false);
    expect("updatedAt" in bookingOccupancies).toBe(false);
    expect("updatedAt" in bookingAuditEvents).toBe(false);
  });

  it("stores copied commercial amounts as integer minor units", () => {
    for (const column of [
      bookingItems.baseAmountMinorUnits,
      bookingItems.modifierAmountMinorUnits,
      bookingItems.addonAmountMinorUnits,
      bookingItems.netAmountMinorUnits,
      bookingItems.vatRateBasisPoints,
      bookingItems.vatAmountMinorUnits,
      bookingItems.grossTotalMinorUnits,
    ]) {
      expect(column.getSQLType()).toBe("integer");
      expect(column.notNull).toBe(true);
    }
  });

  it("enforces one acceptance and booking per quote with immutable item ordering", () => {
    const uniqueIndexes = bookingTables.flatMap((table) =>
      getTableConfig(table).indexes
        .filter((index) => index.config.unique)
        .map((index) => index.config.name),
    );

    expect(uniqueIndexes).toEqual(
      expect.arrayContaining([
        "quote_acceptances_quote_unique",
        "quote_acceptances_booking_provenance_unique",
        "bookings_quote_unique",
        "bookings_acceptance_unique",
        "bookings_reference_unique",
        "booking_items_booking_sort_unique",
        "booking_items_booking_quote_item_unique",
        "booking_occupancies_booking_version_unique",
        "booking_occupancies_blocking_booking_unique",
      ]),
    );
  });

  it("models one team, optional equipment and append-oriented occupancy history", () => {
    expect(bookingOccupancies.teamId.notNull).toBe(true);
    expect(bookingOccupancies.equipmentResourceId.notNull).toBe(false);
    expect(bookingOccupancies.serviceStart.getSQLType()).toBe(
      "timestamp with time zone",
    );
    expect(bookingOccupancies.serviceEnd.getSQLType()).toBe(
      "timestamp with time zone",
    );
    expect(bookingOccupancies.operationalStart.getSQLType()).toBe(
      "timestamp with time zone",
    );
    expect(bookingOccupancies.operationalEnd.getSQLType()).toBe(
      "timestamp with time zone",
    );
    expect(bookingOccupancies.previousOccupancyId.getSQLType()).toBe("uuid");

    const checkNames = getTableConfig(bookingOccupancies).checks.map(
      (constraint) => constraint.name,
    );
    expect(checkNames).toEqual(
      expect.arrayContaining([
        "booking_occupancies_status_valid",
        "booking_occupancies_intervals_valid",
        "booking_occupancies_versions_positive",
        "booking_occupancies_equipment_consistent",
        "booking_occupancies_cancellation_consistent",
      ]),
    );
  });
});
