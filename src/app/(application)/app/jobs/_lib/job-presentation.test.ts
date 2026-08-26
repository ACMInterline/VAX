import { describe, expect, it } from "vitest";
import {
  presentCustomerPassport,
  presentJobDetail,
  presentStaffAssetHistory,
  treatmentPlanOptions,
} from "./job-presentation";
import type { TechnicianJobDetail } from "@/modules/job-execution/types";

const completedAt = new Date("2026-08-25T12:00:00.000Z");
const safeEntry = {
  jobReference: "JOB-0123456789ABCDEF01234567",
  completedAt,
  serviceDescription: "Upholstery cleaning",
  observedConditionSummary: "Moderate",
  treatmentSummary: "Low-moisture extraction",
  resultClassification: "COMPLETED_AS_PLANNED" as const,
  careRecommendation: "Allow to dry",
  maintenanceRecommendation: null,
};

const domainJob: TechnicianJobDetail = {
  jobReference: "JOB-0123456789ABCDEF01234567",
  bookingReference: "BKG-0123456789ABCDEF01234567",
  status: "IN_PROGRESS",
  manualReviewRequired: false,
  scheduledStart: new Date("2026-08-25T09:00:00.000Z"),
  scheduledEnd: new Date("2026-08-25T11:00:00.000Z"),
  customerDisplayName: "Sample customer",
  propertyLabel: "Sample home",
  propertyAddress: "1 Example Street, Sofia",
  assignedTeamCode: "TEAM-A",
  assignedTeamName: "Team Alpha",
  itemCount: 1,
  version: 4,
  createdAt: new Date("2026-08-24T09:00:00.000Z"),
  updatedAt: new Date("2026-08-25T09:00:00.000Z"),
  property: {
    label: "Sample home",
    address: "1 Example Street, Sofia",
    accessNotes: "Ring the apartment bell.",
    parkingNotes: null,
  },
  visitContact: null,
  customerServiceNotes: "Please use shoe covers inside the home.",
  plannedDurationMinutes: 120,
  enRouteAt: null,
  arrivedAt: null,
  startedAt: new Date("2026-08-25T09:00:00.000Z"),
  completedAt: null,
  actualProductiveMinutes: null,
  actualOccupiedTeamMinutes: null,
  items: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      status: "INSPECTED",
      planned: {
        bookingItemId: "20000000-0000-4000-8000-000000000001",
        requestItemId: "30000000-0000-4000-8000-000000000001",
        cleaningAssetId: null,
        serviceId: 1,
        cleaningItemTypeId: 2,
        descriptionBg: "Диван",
        descriptionEn: "Sofa",
        customerDescription: "Food mark on the left cushion.",
        measurement: {
          measurementModeId: 3,
          quantity: 1,
          areaHundredthsM2: null,
          seatCount: 3,
          sides: null,
        },
        plannedConditionLevelId: 4,
        plannedFibreMaterialId: 5,
        plannedSurfaceConstructionId: 6,
        quotedAddonIds: [],
        treatmentAssumptions: {
          reportedIssues: [
            { issueTypeId: 7, notes: "Customer-reported only." },
          ],
        },
        sortOrder: 1,
      },
      inspection: {
        id: "40000000-0000-4000-8000-000000000001",
        sourceJobItemVersion: 1,
        observedCleaningItemTypeId: 2,
        observedMeasurement: {
          measurementModeId: 3,
          quantity: 1,
          areaHundredthsM2: null,
          seatCount: 3,
          sides: null,
        },
        observedConditionLevelId: 4,
        observedConditionCode: "NOTICEABLY_SOILED",
        confirmedFibreMaterialId: 5,
        confirmedSurfaceConstructionId: 6,
        existingDamageObserved: false,
        existingDamageNotes: null,
        colourfastnessConcern: false,
        moistureSensitivity: false,
        unsafeContaminationObserved: false,
        unsafeStructuralConditionObserved: false,
        technicianNotes: null,
        issues: [
          {
            issueTypeId: 8,
            handlingClassification: "ASSESSMENT_REQUIRED",
            technicianNote: null,
          },
        ],
        risks: [],
        inspectedAt: new Date("2026-08-25T09:15:00.000Z"),
        inspectedByProfileId: null,
      },
      treatmentPlan: null,
      treatmentExecution: null,
      resolutionReasonCategory: null,
      resolutionNotes: null,
      version: 2,
    },
  ],
};

const references = {
  services: [{ id: "1", label: "Upholstery cleaning" }],
  cleaningItemTypes: [],
  measurementModes: [],
  conditions: [{ id: "4", label: "Moderate" }],
  materials: [{ id: "5", label: "Textile" }],
  constructions: [{ id: "6", label: "Fixed upholstery" }],
  issues: [
    { id: "7", label: "Customer-reported food mark" },
    { id: "8", label: "Technician-observed colour transfer" },
  ],
  risks: [],
  treatmentLevels: [],
  mechanicalActions: [],
  treatmentApproaches: [],
  addons: [],
  products: [],
};

describe("Phase 3F route presentation projections", () => {
  it("preserves safe service notes and separates reported from observed issues", () => {
    const view = presentJobDetail(domainJob, references, "en");

    expect(view.customerServiceNotes).toBe(
      "Please use shoe covers inside the home.",
    );
    expect(view.items[0]?.planned.reportedIssueLabels).toEqual([
      "Customer-reported food mark",
    ]);
    expect(view.items[0]?.observed?.issueLabels).toEqual([
      "Technician-observed colour transfer",
    ]);
    expect(JSON.stringify(view)).not.toContain("Customer-reported only.");
  });

  it("ignores malformed and unknown reported issue references", () => {
    const unsafeAssumptionsJob: TechnicianJobDetail = {
      ...domainJob,
      items: domainJob.items.map((item) => ({
        ...item,
        planned: {
          ...item.planned,
          treatmentAssumptions: {
            reportedIssues: [
              { issueTypeId: "7" },
              { issueTypeId: -1 },
              { issueTypeId: 999 },
              { issueTypeId: 7.5 },
              "raw issue text",
              null,
            ],
          },
        },
      })),
    };

    expect(
      presentJobDetail(unsafeAssumptionsJob, references, "en").items[0]
        ?.planned.reportedIssueLabels,
    ).toEqual([]);
  });

  it("offers only quoted add-ons when confirming a treatment plan", () => {
    const references = {
      services: [],
      cleaningItemTypes: [],
      measurementModes: [],
      conditions: [],
      materials: [],
      constructions: [],
      issues: [],
      risks: [],
      treatmentLevels: [{ id: "1", label: "Corrective" }],
      mechanicalActions: [{ id: "2", label: "Gentle" }],
      treatmentApproaches: [{ id: "3", label: "Extraction" }],
      addons: [
        { id: "10", label: "Quoted deodorising" },
        { id: "11", label: "Unquoted protection" },
      ],
      products: [{ id: "4", label: "Neutral solution" }],
    };

    expect(treatmentPlanOptions(references, [10]).addons).toEqual([
      { id: "10", label: "Quoted deodorising" },
    ]);
  });

  it("adds only the independently proven property label to customer history", () => {
    const passport = presentCustomerPassport(
      { assetLabel: "Sofa", entries: [safeEntry] },
      "Home",
    );

    expect(passport).toEqual({
      assetLabel: "Sofa",
      propertyLabel: "Home",
      entries: [safeEntry],
    });
  });

  it("removes internal notes and immutable snapshots from staff rendering DTOs", () => {
    const history = presentStaffAssetHistory(
      {
        assetLabel: "Sofa",
        entries: [
          {
            ...safeEntry,
            id: "10000000-0000-4000-8000-000000000001",
            jobItemId: "20000000-0000-4000-8000-000000000001",
            inspectionIssueSummary: ["SPILL"],
            inspectionRiskSummary: ["DELICATE_MATERIAL"],
            internalTechnicianNotes: "DO NOT RENDER INTERNAL NOTE",
            immutableSnapshot: {
              quoteSnapshot: "DO NOT RENDER QUOTE SNAPSHOT",
              priceMinor: 12_500,
            },
          },
        ],
      },
      "Home",
    );

    const renderedData = JSON.stringify(history);
    expect(renderedData).not.toContain("DO NOT RENDER");
    expect(renderedData).not.toContain("internalTechnicianNotes");
    expect(renderedData).not.toContain("immutableSnapshot");
    expect(renderedData).not.toContain("priceMinor");
    expect(history.propertyLabel).toBe("Home");
    expect(history.entries[0]?.inspectionIssueSummary).toEqual(["SPILL"]);
  });
});
