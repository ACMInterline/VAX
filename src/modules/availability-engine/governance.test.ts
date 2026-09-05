import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  developmentAppointmentWindows,
  developmentEquipmentResources,
  developmentSchedulingPolicy,
  developmentTeams,
  developmentTravelTimeProfile,
  developmentWorkingHourPolicy,
} from "./development-config";
import {
  attelierAppointmentWindows,
  attelierServiceAreas,
  attelierWorkingHourPolicy,
} from "./attelier-config";

describe("availability configuration governance", () => {
  it("seeds two neutral two-worker teams without specialist claims", () => {
    expect(developmentTeams.map((team) => team.code)).toEqual([
      "TEAM_A",
      "TEAM_B",
    ]);
    expect(developmentTeams.every((team) => team.defaultCrewSize === 2)).toBe(
      true,
    );
    expect(
      developmentTeams.every(
        (team) => !team.capabilityCodes.includes("SPECIALIST_ASSESSMENT"),
      ),
    ).toBe(true);
  });

  it("uses one neutral portable machine per development team", () => {
    expect(developmentEquipmentResources.map((resource) => resource.code)).toEqual(
      ["CLEANING_MACHINE_A", "CLEANING_MACHINE_B"],
    );
    expect(
      developmentEquipmentResources.every(
        (resource) =>
          resource.status === "ACTIVE" && resource.serialNumber === null,
      ),
    ).toBe(true);
  });

  it("defines 06:00-22:00 rules, five request windows and 30-minute slots", () => {
    expect(developmentWorkingHourPolicy.rules).toHaveLength(7);
    expect(
      developmentWorkingHourPolicy.rules.every(
        (rule) =>
          rule.enabled &&
          rule.startMinute === 6 * 60 &&
          rule.endMinute === 22 * 60,
      ),
    ).toBe(true);
    expect(
      developmentAppointmentWindows.map((window) => [
        window.windowCode,
        window.startMinute,
        window.endMinute,
      ]),
    ).toEqual([
      ["EARLY_MORNING", 360, 540],
      ["MORNING", 540, 720],
      ["MIDDAY", 720, 900],
      ["AFTERNOON", 900, 1080],
      ["EVENING", 1080, 1320],
    ]);
    expect(developmentSchedulingPolicy.candidateIntervalMinutes).toBe(30);
    expect(developmentSchedulingPolicy).toMatchObject({
      version: 1,
      status: "DRAFT",
      active: false,
      provisional: true,
    });
  });

  it("keeps travel and working assumptions inactive versioned drafts", () => {
    expect(developmentTravelTimeProfile).toMatchObject({
      version: 1,
      status: "DRAFT",
      active: false,
      provisional: true,
      interJobBufferMinutes: 10,
    });
    expect(developmentWorkingHourPolicy).toMatchObject({
      version: 1,
      status: "DRAFT",
      active: false,
      provisional: true,
    });
  });

  it("uses insert-only conflict handling for versioned scheduling assumptions", () => {
    const seedSource = readFileSync(
      path.join(process.cwd(), "src/db/seed-availability-engine.ts"),
      "utf8",
    );

    expect(seedSource).toMatch(
      /insert\(availabilityTables\.workingHourPolicies\)[\s\S]*?onConflictDoNothing/,
    );
    expect(seedSource).toMatch(
      /insert\(availabilityTables\.travelTimeProfiles\)[\s\S]*?onConflictDoNothing/,
    );
    expect(seedSource).not.toMatch(/customers|bookings|quotes|payments|invoices/i);
  });

  it("defines exact ATTELIER hours, windows and non-fabricated service bands", () => {
    expect(attelierWorkingHourPolicy).toMatchObject({
      status: "ACTIVE",
      active: true,
      provisional: false,
    });
    expect(
      attelierWorkingHourPolicy.rules.every(
        (rule) => rule.startMinute === 360 && rule.endMinute === 1_320,
      ),
    ).toBe(true);
    expect(
      attelierAppointmentWindows.map((window) => [
        window.startMinute,
        window.endMinute,
      ]),
    ).toEqual([
      [360, 540],
      [540, 720],
      [720, 900],
      [900, 1_080],
      [1_080, 1_320],
    ]);
    expect(
      attelierServiceAreas.map((area) => [
        area.code,
        area.minimumOrderOverrideMinorUnits,
        area.manualConfirmationRequired,
      ]),
    ).toEqual([
      ["SOFIA_CORE", 4_500, false],
      ["SOFIA_EXTENDED", 6_000, false],
      ["SOFIA_OUTSKIRTS", 8_000, false],
      ["OUTSIDE_SOFIA", 10_000, true],
    ]);
    expect(attelierServiceAreas[0]?.geographicMetadata).toBeNull();
    expect(attelierServiceAreas[1]?.geographicMetadata).toBeNull();
  });
});
