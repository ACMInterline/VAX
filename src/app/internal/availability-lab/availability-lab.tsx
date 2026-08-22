"use client";

import { useMemo, useState } from "react";
import { getCatalogueLabel } from "@/modules/service-catalogue/catalogue";
import {
  commercialConditionBands,
  developmentDurationModel,
  residentialDraftPriceBook,
} from "@/modules/commercial-engine/development-config";
import { calculateDuration } from "@/modules/commercial-engine/duration";
import { calculatePrice } from "@/modules/commercial-engine/pricing";
import type {
  CommercialConditionBandCode,
  TravelZoneCode,
} from "@/modules/commercial-engine/types";
import {
  generateAvailabilityForTeams,
  getWorkingWindowForDate,
} from "@/modules/availability-engine/availability";
import {
  developmentAppointmentWindows,
  developmentEquipmentResources,
  developmentSchedulingPolicy,
  developmentServiceAreas,
  developmentTeams,
  developmentTravelTimeProfile,
  developmentWorkingHourPolicy,
} from "@/modules/availability-engine/development-config";
import {
  availabilityDevelopmentScenarios,
  itemsForScenarioMeasurement,
} from "@/modules/availability-engine/development-scenarios";
import { createDevelopmentTravelTimeEstimator } from "@/modules/availability-engine/travel";
import {
  calculateRevenueProductivity,
  calculateTeamAndLabourTime,
  calculateTeamUtilisation,
} from "@/modules/availability-engine/utilisation";
import type {
  AppointmentWindowCode,
  JobCapacityInput,
  LocationInput,
  OperationsTeamCode,
  SchedulingBlock,
} from "@/modules/availability-engine/types";

type SampleSchedule = "EMPTY" | "NEIGHBOURS" | "MIDDAY_BREAK" | "EQUIPMENT_OUT";

const euroFormatter = new Intl.NumberFormat("en-IE", {
  style: "currency",
  currency: "EUR",
});
const travelEstimator = createDevelopmentTravelTimeEstimator(
  developmentTravelTimeProfile,
);

function money(value: number | null): string {
  return value === null ? "Manual assessment" : euroFormatter.format(value / 100);
}

function clock(minute: number | null): string {
  if (minute === null) return "—";
  const hour = Math.floor(minute / 60);
  const remainder = minute % 60;
  return `${String(hour).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

function fixtureLocation(zoneCode: TravelZoneCode, district: string): LocationInput {
  return {
    city: zoneCode === "OUTSIDE_SOFIA" ? "External fixture" : "Sofia",
    district,
    addressText: "Development fixture only",
    postalCode: null,
    latitude: null,
    longitude: null,
    accessNotes: null,
    parkingNotes: null,
    zoneCode,
  };
}

function job(
  id: string,
  startMinute: number,
  endMinute: number,
  location: LocationInput,
  serviceMinutes: number,
  travelMinutes: number,
  bufferMinutes: number,
): SchedulingBlock {
  return {
    id,
    type: "JOB",
    status: "DEVELOPMENT_FIXTURE",
    startMinute,
    endMinute,
    location,
    serviceMinutes,
    travelMinutes,
    bufferMinutes,
  };
}

function occupancyFor(
  sample: SampleSchedule,
  teamCode: OperationsTeamCode,
): readonly SchedulingBlock[] {
  if (sample === "MIDDAY_BREAK") {
    return [
      {
        id: `${teamCode}-meal`,
        type: "MEAL_BREAK",
        status: "DEVELOPMENT_FIXTURE",
        startMinute: 12 * 60,
        endMinute: 12 * 60 + 30,
        location: null,
        serviceMinutes: 0,
        travelMinutes: 0,
        bufferMinutes: 0,
      },
    ];
  }
  if (sample !== "NEIGHBOURS") return [];
  if (teamCode === "TEAM_A") {
    return [
      job(
        "team-a-morning",
        8 * 60,
        9 * 60,
        fixtureLocation("SOFIA_CORE", "Center"),
        40,
        10,
        10,
      ),
      job(
        "team-a-afternoon",
        13 * 60 + 30,
        14 * 60 + 30,
        fixtureLocation("SOFIA_CORE", "Center"),
        40,
        10,
        10,
      ),
    ];
  }
  return [
    job(
      "team-b-morning",
      10 * 60,
      11 * 60 + 30,
      fixtureLocation("SOFIA_EXTENDED", "Mladost"),
      60,
      20,
      10,
    ),
  ];
}

function rejectionSummary(
  results: readonly { reasonCodes: readonly string[] }[],
): readonly [string, number][] {
  const counts = new Map<string, number>();
  for (const result of results) {
    for (const reason of result.reasonCodes) {
      counts.set(reason, (counts.get(reason) ?? 0) + 1);
    }
  }
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

export function AvailabilityLab() {
  const [scenarioCode, setScenarioCode] = useState("A");
  const [workDate, setWorkDate] = useState("2026-08-24");
  const [measurement, setMeasurement] = useState("25");
  const [condition, setCondition] =
    useState<CommercialConditionBandCode>("NORMAL");
  const [zoneCode, setZoneCode] = useState<TravelZoneCode>("SOFIA_CORE");
  const [windowCode, setWindowCode] = useState<AppointmentWindowCode | "">("");
  const [sampleSchedule, setSampleSchedule] =
    useState<SampleSchedule>("EMPTY");
  const [requiredTeamCount, setRequiredTeamCount] = useState<1 | 2>(1);
  const [parkingBufferMinutes, setParkingBufferMinutes] = useState(0);
  const [parkingUncertain, setParkingUncertain] = useState(false);

  const scenario =
    availabilityDevelopmentScenarios.find((entry) => entry.code === scenarioCode) ??
    availabilityDevelopmentScenarios[0];

  const calculation = useMemo(() => {
    try {
      const items = itemsForScenarioMeasurement(scenario, Number(measurement));
      const price = calculatePrice(residentialDraftPriceBook, {
        items,
        conditionBandCode: condition,
        travelZoneCode: zoneCode,
        timingCategoryCode: "STANDARD",
      });
      const duration = calculateDuration(developmentDurationModel, {
        items,
        conditionBandCode: condition,
      });
      const serviceArea = developmentServiceAreas.find(
        (area) => area.code === zoneCode,
      );
      if (!serviceArea) throw new Error("The selected service area is unavailable.");
      const preferredWindow =
        developmentAppointmentWindows.find(
          (window) => window.windowCode === windowCode,
        ) ?? null;
      const location: LocationInput = {
        ...scenario.location,
        city: zoneCode === "OUTSIDE_SOFIA" ? "External fixture" : "Sofia",
        district:
          zoneCode === "SOFIA_CORE"
            ? "Lozenets"
            : zoneCode === "SOFIA_EXTENDED"
              ? "Mladost"
              : zoneCode === "SOFIA_OUTSKIRTS"
                ? "Outskirts fixture"
                : "External fixture",
        zoneCode,
        parkingNotes: parkingUncertain ? "Parking requires confirmation" : null,
      };
      const request: JobCapacityInput = {
        priceCalculation: price,
        durationCalculation: duration,
        location,
        serviceArea,
        workDate,
        preferredWindow,
        requiredCapabilityCodes: scenario.requiredCapabilityCodes,
        requiredEquipmentCapabilityCodes:
          scenario.requiredEquipmentCapabilityCodes,
        requiredTeamCount,
        parkingBufferMinutes,
        manualAssessmentRequired:
          price.manualAssessmentRequired || duration.manualAssessmentRequired,
      };
      const contexts = developmentTeams.map((team) => {
        const workingWindow = getWorkingWindowForDate(
          developmentWorkingHourPolicy,
          workDate,
          team.code,
        );
        if (!workingWindow) throw new Error(`No working window for ${team.code}.`);
        return {
          team,
          equipmentResources:
            sampleSchedule === "EQUIPMENT_OUT"
              ? developmentEquipmentResources.map((resource) => ({
                  ...resource,
                  status: "MAINTENANCE" as const,
                }))
              : developmentEquipmentResources,
          workingWindow,
          occupancyBlocks: occupancyFor(sampleSchedule, team.code),
        };
      });
      const availability = generateAvailabilityForTeams({
        request,
        teamContexts: contexts,
        travelEstimator,
        schedulingPolicy: developmentSchedulingPolicy,
      });
      const utilisation = contexts.map((context) => ({
        teamCode: context.team.code,
        result: calculateTeamUtilisation({
          workingWindow: context.workingWindow,
          occupancyBlocks: context.occupancyBlocks,
        }),
      }));
      return { price, duration, availability, utilisation, request, contexts, error: null };
    } catch (error) {
      return {
        price: null,
        duration: null,
        availability: [],
        utilisation: [],
        request: null,
        contexts: [],
        error: error instanceof Error ? error.message : "Calculation unavailable.",
      };
    }
  }, [
    condition,
    measurement,
    parkingBufferMinutes,
    parkingUncertain,
    requiredTeamCount,
    sampleSchedule,
    scenario,
    windowCode,
    workDate,
    zoneCode,
  ]);

  function selectScenario(code: string) {
    const next = availabilityDevelopmentScenarios.find((entry) => entry.code === code);
    if (!next) return;
    setScenarioCode(next.code);
    setMeasurement(String(next.defaultMeasurement));
    setCondition(next.conditionBandCode);
    setZoneCode(next.travelZoneCode);
  }

  return (
    <div className="pricing-lab-grid availability-lab-grid">
      <section className="pricing-lab-panel pricing-lab-controls">
        <div className="pricing-lab-panel-heading">
          <p>01 · Inputs</p>
          <h2>Ephemeral scheduling request</h2>
        </div>
        <label>
          Scenario
          <select value={scenario.code} onChange={(event) => selectScenario(event.target.value)}>
            {availabilityDevelopmentScenarios.map((entry) => (
              <option key={entry.code} value={entry.code}>
                {entry.code} · {entry.name}
              </option>
            ))}
          </select>
        </label>
        <p className="pricing-lab-hint">{scenario.description}</p>
        <div className="availability-request-summary">
          {scenario.items.map((item, index) => (
            <span key={`${item.itemTypeCode}-${index}`}>
              {item.serviceCode} · {item.itemTypeCode}
            </span>
          ))}
        </div>
        <div className="pricing-lab-control-row">
          <label>
            Date
            <input type="date" value={workDate} onChange={(event) => setWorkDate(event.target.value)} />
          </label>
          <label>
            {scenario.measurementLabel}
            <input
              type="number"
              min="0.01"
              step={scenario.measurementKind === "AREA_M2" ? "0.01" : "1"}
              disabled={scenario.measurementKind === "FIXED"}
              value={measurement}
              onChange={(event) => setMeasurement(event.target.value)}
            />
          </label>
        </div>
        <label>
          Condition
          <select value={condition} onChange={(event) => setCondition(event.target.value as CommercialConditionBandCode)}>
            {commercialConditionBands.map((band) => (
              <option key={band.code} value={band.code}>{getCatalogueLabel(band, "en")}</option>
            ))}
          </select>
        </label>
        <div className="pricing-lab-control-row">
          <label>
            Sofia service-area label
            <select value={zoneCode} onChange={(event) => setZoneCode(event.target.value as TravelZoneCode)}>
              {developmentServiceAreas.map((area) => (
                <option key={area.code} value={area.code}>{area.name.en}</option>
              ))}
            </select>
          </label>
          <label>
            Preferred arrival window
            <select value={windowCode} onChange={(event) => setWindowCode(event.target.value as AppointmentWindowCode | "")}>
              <option value="">Any working time</option>
              {developmentAppointmentWindows.map((window) => (
                <option key={window.windowCode} value={window.windowCode}>{window.name.en}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Existing workload fixture
          <select value={sampleSchedule} onChange={(event) => setSampleSchedule(event.target.value as SampleSchedule)}>
            <option value="EMPTY">Empty day</option>
            <option value="NEIGHBOURS">Previous and next jobs</option>
            <option value="MIDDAY_BREAK">12:00 meal break</option>
            <option value="EQUIPMENT_OUT">Machines unavailable</option>
          </select>
        </label>
        <div className="pricing-lab-control-row">
          <label>
            Required teams
            <select value={requiredTeamCount} onChange={(event) => setRequiredTeamCount(event.target.value === "2" ? 2 : 1)}>
              <option value={1}>One team</option>
              <option value={2}>Two teams · review</option>
            </select>
          </label>
          <label>
            Parking buffer (min)
            <input type="number" min={0} step={5} value={parkingBufferMinutes} onChange={(event) => setParkingBufferMinutes(Math.max(0, Number(event.target.value) || 0))} />
          </label>
        </div>
        <label className="availability-check">
          <input type="checkbox" checked={parkingUncertain} onChange={(event) => setParkingUncertain(event.target.checked)} />
          Parking requires confirmation
        </label>
      </section>

      <div className="pricing-lab-results" aria-live="polite">
        {calculation.error ? (
          <section className="pricing-lab-panel pricing-lab-error" role="alert">
            <p>Calculation unavailable</p><h2>Check the fixture input</h2><div>{calculation.error}</div>
          </section>
        ) : null}

        {calculation.price && calculation.duration ? (
          <section className="pricing-lab-panel">
            <div className="pricing-lab-panel-heading"><p>02 · Composed inputs</p><h2>Price and service duration stay separate</h2></div>
            <dl className="availability-metrics">
              <div><dt>Draft gross estimate</dt><dd>{money(calculation.price.grossTotalMinorUnits)}</dd></div>
              <div><dt>Phase 2A service block</dt><dd>{calculation.duration.totalEstimatedMinutes ?? calculation.duration.partialEstimatedMinutes} min</dd></div>
              <div><dt>Setup / inspection / cleanup</dt><dd>{calculation.duration.setupMinutes} / {calculation.duration.inspectionMinutes} / {calculation.duration.cleanupMinutes} min · already included</dd></div>
              <div><dt>Assessment state</dt><dd>{calculation.price.manualAssessmentRequired || calculation.duration.manualAssessmentRequired ? "REQUEST REVIEW" : "Automatic estimate"}</dd></div>
            </dl>
          </section>
        ) : null}

        <section className="pricing-lab-panel">
          <div className="pricing-lab-panel-heading"><p>03 · Travel</p><h2>Deterministic fallback assumptions</h2></div>
          <p className="availability-notice">No live routing or paid map API is called. Distance remains unknown; all values are provisional fallbacks.</p>
          <div className="availability-travel-grid">
            {developmentTravelTimeProfile.rules.map((rule) => (
              <div key={rule.id}><span>{rule.sameDistrictOnly ? "Same core district" : `${rule.originZoneCode} ↔ ${rule.destinationZoneCode}`}</span><strong>{rule.estimatedTravelMinutes ?? "Review"} min</strong></div>
            ))}
          </div>
          <p className="pricing-lab-hint">Independent transition buffer: {developmentTravelTimeProfile.interJobBufferMinutes} minutes per neighbouring job.</p>
        </section>

        {calculation.availability.map((teamAvailability, index) => {
          const utilisation = calculation.utilisation[index]?.result;
          const first = teamAvailability.bookableSlots[0] ?? teamAvailability.reviewSlots[0] ?? null;
          const occupied = first?.operationalStartMinute !== null && first?.operationalEndMinute !== null
            ? (first?.operationalEndMinute ?? 0) - (first?.operationalStartMinute ?? 0)
            : 0;
          const time = occupied > 0 ? calculateTeamAndLabourTime(occupied, 2) : null;
          const productivity = occupied > 0 && calculation.price?.grossTotalMinorUnits !== null
            ? calculateRevenueProductivity({ grossRevenueMinorUnits: calculation.price?.grossTotalMinorUnits ?? 0, estimatedContributionMinorUnits: 0, occupiedTeamMinutes: occupied })
            : null;
          return (
            <section className="pricing-lab-panel" key={teamAvailability.teamCode}>
              <div className="pricing-lab-panel-heading"><p>{String(index + 4).padStart(2, "0")} · {teamAvailability.teamCode}</p><h2>Candidate capacity</h2></div>
              <dl className="availability-metrics">
                <div><dt>Bookable fixtures</dt><dd>{teamAvailability.bookableSlots.length}</dd></div>
                <div><dt>Review-only fixtures</dt><dd>{teamAvailability.reviewSlots.length}</dd></div>
                <div><dt>Rejected fixtures</dt><dd>{teamAvailability.rejectedSlots.length}</dd></div>
                <div><dt>Existing occupied utilisation</dt><dd>{utilisation ? `${(utilisation.occupiedUtilisationBasisPoints / 100).toFixed(2)}%` : "—"}</dd></div>
              </dl>
              <h3>First candidate starts</h3>
              <div className="availability-slots">
                {teamAvailability.bookableSlots.slice(0, 10).map((slot) => <span className="available" key={slot.serviceStartMinute}>{clock(slot.serviceStartMinute)}</span>)}
                {teamAvailability.bookableSlots.length === 0 ? <span className="empty">No automatic slots</span> : null}
              </div>
              {teamAvailability.reviewSlots.length > 0 ? <p className="pricing-lab-manual">Review starts: {teamAvailability.reviewSlots.slice(0, 8).map((slot) => clock(slot.serviceStartMinute)).join(", ")}</p> : null}
              {first ? (
                <dl className="availability-metrics availability-detail">
                  <div><dt>First operational block</dt><dd>{clock(first.operationalStartMinute)}–{clock(first.operationalEndMinute)}</dd></div>
                  <div><dt>Travel before / after</dt><dd>{first.travelBeforeMinutes} / {first.travelAfterMinutes} min</dd></div>
                  <div><dt>Transition buffer</dt><dd>{first.bufferMinutes} min</dd></div>
                  <div><dt>Team / labour hours</dt><dd>{time ? `${(time.teamHoursHundredths / 100).toFixed(2)} / ${(time.labourHoursHundredths / 100).toFixed(2)}` : "—"}</dd></div>
                  <div><dt>Gross per occupied team hour</dt><dd>{productivity ? money(productivity.grossRevenuePerOccupiedTeamHourMinorUnits) : "—"}</dd></div>
                  <div><dt>Disposition</dt><dd>{first.disposition}</dd></div>
                </dl>
              ) : null}
              <ul className="pricing-lab-warnings">
                {rejectionSummary([...teamAvailability.reviewSlots, ...teamAvailability.rejectedSlots]).slice(0, 6).map(([reason, count]) => <li key={reason}>{reason} · {count} candidate(s)</li>)}
              </ul>
            </section>
          );
        })}

        <section className="pricing-lab-panel availability-safety">
          <div className="pricing-lab-panel-heading"><p>Safety boundary</p><h2>No reservation is created</h2></div>
          <p>Every input and result exists only in this browser render. Team codes, draft travel assumptions, utilisation and provisional prices remain internal.</p>
        </section>
      </div>
    </div>
  );
}
