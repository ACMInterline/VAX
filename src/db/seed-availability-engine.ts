import { eq, sql } from "drizzle-orm";
import type { Database } from "./client";
import {
  developmentAppointmentWindows,
  developmentEquipmentResources,
  developmentTeams,
  developmentTravelTimeProfile,
  developmentWorkingHourPolicy,
} from "@/modules/availability-engine/development-config";
import {
  attelierAppointmentWindows,
  attelierServiceAreas,
  attelierWorkingHourPolicy,
} from "@/modules/availability-engine/attelier-config";
import * as availabilityTables from "./schema/availability-engine";
import * as commercialTables from "./schema/commercial-engine";

function idMap(rows: readonly { id: number; code: string }[]) {
  return new Map(rows.map((row) => [row.code, row.id]));
}

function requiredId(ids: ReadonlyMap<string, number>, code: string): number {
  const id = ids.get(code);
  if (id === undefined) {
    throw new Error(`Required availability reference code was not persisted: ${code}`);
  }
  return id;
}

export async function seedAvailabilityEngine(database: Database): Promise<void> {
  for (const area of attelierServiceAreas) {
    await database
      .update(commercialTables.travelZones)
      .set({
        serviceEligible: area.serviceEligible,
        minimumOrderOverrideMinorUnits: area.minimumOrderOverrideMinorUnits,
        estimatedBaseTravelMinutes: area.estimatedBaseTravelMinutes,
        manualConfirmationRequired: area.manualConfirmationRequired,
        geographicMetadata: area.geographicMetadata,
      })
      .where(eq(commercialTables.travelZones.code, area.code));
  }

  const workingHourPolicies = [
    developmentWorkingHourPolicy,
    attelierWorkingHourPolicy,
  ];
  await database
    .insert(availabilityTables.workingHourPolicies)
    .values(
      workingHourPolicies.map((policy) => ({
        code: policy.code,
        name: policy.name,
        market: "SOFIA" as const,
        timeZone: policy.timeZone,
        version: policy.version,
        status: policy.status,
        effectiveFrom: null,
        effectiveUntil: null,
        provisional: policy.provisional,
        active: policy.active,
      })),
    )
    .onConflictDoNothing({ target: availabilityTables.workingHourPolicies.code });

  const workingPolicyIds = idMap(
    await database
      .select({
        id: availabilityTables.workingHourPolicies.id,
        code: availabilityTables.workingHourPolicies.code,
      })
      .from(availabilityTables.workingHourPolicies),
  );

  await database
    .insert(availabilityTables.operationsTeams)
    .values(
      developmentTeams.map((team) => ({
        code: team.code,
        name: team.name,
        active: team.active,
        defaultCrewSize: team.defaultCrewSize,
        workingHourPolicyId: requiredId(
          workingPolicyIds,
          team.workingHourPolicyCode,
        ),
        notes: team.notes,
      })),
    )
    .onConflictDoUpdate({
      target: availabilityTables.operationsTeams.code,
      set: {
        name: sql`excluded."name"`,
        active: sql`excluded."active"`,
        defaultCrewSize: sql`excluded."default_crew_size"`,
        workingHourPolicyId: sql`excluded."working_hour_policy_id"`,
        notes: sql`excluded."notes"`,
        updatedAt: sql`now()`,
      },
    });

  const teamIds = idMap(
    await database
      .select({
        id: availabilityTables.operationsTeams.id,
        code: availabilityTables.operationsTeams.code,
      })
      .from(availabilityTables.operationsTeams),
  );

  await database
    .insert(availabilityTables.workingHourRules)
    .values(
      workingHourPolicies.flatMap((policy) =>
        policy.rules.map((rule) => ({
          policyId: requiredId(workingPolicyIds, policy.code),
          code: rule.id,
          weekday: rule.weekday,
          startMinute: rule.startMinute,
          endMinute: rule.endMinute,
          enabled: rule.enabled,
          teamId:
            rule.teamCode === null ? null : requiredId(teamIds, rule.teamCode),
        })),
      ),
    )
    .onConflictDoNothing({ target: availabilityTables.workingHourRules.code });

  const capabilityRows = developmentTeams.flatMap((team) =>
    team.capabilityCodes.map((capabilityCode) => ({
      teamId: requiredId(teamIds, team.code),
      capabilityCode,
      active: true,
      notes: "Development scheduling capability; owner approval is required before production use.",
    })),
  );
  if (capabilityRows.length > 0) {
    await database
      .insert(availabilityTables.teamCapabilities)
      .values(capabilityRows)
      .onConflictDoUpdate({
        target: [
          availabilityTables.teamCapabilities.teamId,
          availabilityTables.teamCapabilities.capabilityCode,
        ],
        set: {
          active: sql`excluded."active"`,
          notes: sql`excluded."notes"`,
          updatedAt: sql`now()`,
        },
      });
  }

  await database
    .insert(availabilityTables.equipmentResources)
    .values(
      developmentEquipmentResources.map((resource) => ({
        code: resource.code,
        name: resource.name,
        equipmentTypeCode: resource.equipmentTypeCode,
        capabilityCode: resource.capabilityCode,
        status: resource.status,
        active: resource.active,
        serialNumber: resource.serialNumber,
        notes: resource.notes,
      })),
    )
    .onConflictDoUpdate({
      target: availabilityTables.equipmentResources.code,
      set: {
        name: sql`excluded."name"`,
        equipmentTypeCode: sql`excluded."equipment_type_code"`,
        capabilityCode: sql`excluded."capability_code"`,
        status: sql`excluded."status"`,
        active: sql`excluded."active"`,
        serialNumber: sql`excluded."serial_number"`,
        notes: sql`excluded."notes"`,
        updatedAt: sql`now()`,
      },
    });

  const equipmentIds = idMap(
    await database
      .select({
        id: availabilityTables.equipmentResources.id,
        code: availabilityTables.equipmentResources.code,
      })
      .from(availabilityTables.equipmentResources),
  );
  const assignmentRows = developmentEquipmentResources.flatMap((resource) =>
    resource.assignedTeamCode === null
      ? []
      : [
          {
            teamId: requiredId(teamIds, resource.assignedTeamCode),
            equipmentResourceId: requiredId(equipmentIds, resource.code),
            effectiveFrom: null,
            effectiveUntil: null,
            active: true,
            notes: "Neutral development assignment; no ownership claim.",
          },
        ],
  );
  if (assignmentRows.length > 0) {
    await database
      .insert(availabilityTables.teamEquipmentAssignments)
      .values(assignmentRows)
      .onConflictDoUpdate({
        target: [
          availabilityTables.teamEquipmentAssignments.teamId,
          availabilityTables.teamEquipmentAssignments.equipmentResourceId,
        ],
        set: {
          active: sql`excluded."active"`,
          notes: sql`excluded."notes"`,
          updatedAt: sql`now()`,
        },
      });
  }

  await database
    .insert(availabilityTables.appointmentWindowDefinitions)
    .values(
      [...developmentAppointmentWindows, ...attelierAppointmentWindows].map((window) => ({
        profileCode: window.profileCode,
        version: window.version,
        status: window.status,
        windowCode: window.windowCode,
        labelBg: window.name.bg,
        labelEn: window.name.en,
        startMinute: window.startMinute,
        endMinute: window.endMinute,
        effectiveFrom: null,
        effectiveUntil: null,
        provisional: window.provisional,
        active: window.active,
      })),
    )
    .onConflictDoNothing();

  await database
    .insert(availabilityTables.travelTimeProfiles)
    .values({
      code: developmentTravelTimeProfile.code,
      name: developmentTravelTimeProfile.name,
      market: developmentTravelTimeProfile.market,
      version: developmentTravelTimeProfile.version,
      status: developmentTravelTimeProfile.status,
      defaultTravelMinutes: developmentTravelTimeProfile.defaultTravelMinutes,
      interJobBufferMinutes:
        developmentTravelTimeProfile.interJobBufferMinutes,
      effectiveFrom: null,
      effectiveUntil: null,
      provisional: developmentTravelTimeProfile.provisional,
      active: developmentTravelTimeProfile.active,
    })
    .onConflictDoNothing({ target: availabilityTables.travelTimeProfiles.code });

  const travelProfileIds = idMap(
    await database
      .select({
        id: availabilityTables.travelTimeProfiles.id,
        code: availabilityTables.travelTimeProfiles.code,
      })
      .from(availabilityTables.travelTimeProfiles),
  );
  const travelZoneIds = idMap(
    await database
      .select({
        id: commercialTables.travelZones.id,
        code: commercialTables.travelZones.code,
      })
      .from(commercialTables.travelZones),
  );

  await database
    .insert(availabilityTables.travelTimeMatrixRules)
    .values(
      developmentTravelTimeProfile.rules.map((rule) => ({
        travelTimeProfileId: requiredId(
          travelProfileIds,
          developmentTravelTimeProfile.code,
        ),
        code: rule.id,
        originTravelZoneId: requiredId(travelZoneIds, rule.originZoneCode),
        destinationTravelZoneId: requiredId(
          travelZoneIds,
          rule.destinationZoneCode,
        ),
        estimatedTravelMinutes: rule.estimatedTravelMinutes,
        bidirectional: rule.bidirectional,
        sameDistrictOnly: rule.sameDistrictOnly,
        manualAssessmentRequired: rule.manualAssessmentRequired,
        priority: rule.priority,
        active: rule.active,
        notes: rule.notes,
      })),
    )
    .onConflictDoNothing({ target: availabilityTables.travelTimeMatrixRules.code });
}
