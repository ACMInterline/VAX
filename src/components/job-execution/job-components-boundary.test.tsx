import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  CustomerCleaningPassportCard,
  StaffAssetHistoryCard,
} from "./asset-history";
import {
  TechnicianJobDetailCard,
  TechnicianJobList,
} from "./job-cards";
import type {
  CustomerCleaningPassport,
  StaffAssetHistory,
  TechnicianJobDetail,
  TechnicianJobListItem,
} from "./types";

const now = new Date("2026-08-25T09:30:00.000Z");
const reference = "JOB-0123456789ABCDEF01234567";
const listJob: TechnicianJobListItem = {
  reference,
  status: "READY",
  scheduledStart: now,
  plannedDurationMinutes: 60,
  customerDisplayName: "Sample customer",
  propertyLabel: "Sample home",
  serviceAddress: "1 Example Street, Sofia",
  assignedTeamLabel: "Team Alpha",
  itemLabels: ["Sofa"],
  reviewReasons: [],
};
const detailJob: TechnicianJobDetail = {
  reference,
  status: "READY",
  version: 1,
  scheduledStart: now,
  plannedDurationMinutes: 60,
  customerDisplayName: "Sample customer",
  propertyLabel: "Sample home",
  serviceAddress: "1 Example Street, Sofia",
  assignedTeamLabel: "Team Alpha",
  visitContact: null,
  accessInstructions: null,
  parkingInstructions: null,
  customerServiceNotes: "Please use shoe covers.",
  reviewReasons: [],
  items: [{
    id: "10000000-0000-4000-8000-000000000001",
    status: "PENDING_INSPECTION",
    planned: {
      serviceLabel: "Upholstery cleaning",
      itemLabel: "Sofa",
      quantityLabel: "1",
      measurementLabel: null,
      reportedConditionLabel: null,
      reportedMaterialLabel: null,
      reportedConstructionLabel: null,
      reportedIssueLabels: [],
      requestedAddonLabels: [],
      customerDescription: null,
    },
    observed: null,
    confirmedTreatment: null,
    performed: null,
  }],
};
const passport: CustomerCleaningPassport = {
  assetLabel: "Sofa",
  propertyLabel: "Sample home",
  entries: [{
    jobReference: reference,
    completedAt: now,
    serviceDescription: "Upholstery cleaning",
    observedConditionSummary: "Moderate condition",
    treatmentSummary: "Completed treatment",
    resultClassification: "COMPLETED_AS_PLANNED",
    careRecommendation: null,
    maintenanceRecommendation: null,
  }],
};
const staffHistory: StaffAssetHistory = {
  assetLabel: "Sofa",
  propertyLabel: "Sample home",
  entries: [{
    id: "30000000-0000-4000-8000-000000000001",
    jobReference: reference,
    completedAt: now,
    serviceDescription: "Upholstery cleaning",
    observedConditionSummary: "Moderate condition",
    treatmentSummary: "Extraction",
    resultClassification: "COMPLETED_AS_PLANNED",
    inspectionIssueSummary: [],
    inspectionRiskSummary: [],
    careRecommendation: null,
    maintenanceRecommendation: null,
  }],
};

const forbiddenValues = [
  "DO NOT RENDER PRICE",
  "DO NOT RENDER MARGIN",
  "DO NOT RENDER QUOTE SNAPSHOT",
  "DO NOT RENDER INTERNAL NOTE",
  "DO NOT RENDER CUSTOMER EMAIL",
];

function expectSafeProjection(html: string) {
  for (const value of forbiddenValues) expect(html).not.toContain(value);
}

describe("Phase 3F presentational boundaries", () => {
  it("does not render commercial or unrelated identity fields in technician views", () => {
    const unsafeListRuntimeValue = {
      ...listJob,
      totalAmountMinor: "DO NOT RENDER PRICE",
      grossMargin: "DO NOT RENDER MARGIN",
      acceptanceSourceSnapshot: "DO NOT RENDER QUOTE SNAPSHOT",
      customerEmail: "DO NOT RENDER CUSTOMER EMAIL",
    };
    const unsafeDetailRuntimeValue = {
      ...detailJob,
      totalAmountMinor: "DO NOT RENDER PRICE",
      grossMargin: "DO NOT RENDER MARGIN",
      acceptanceSourceSnapshot: "DO NOT RENDER QUOTE SNAPSHOT",
      internalNotes: "DO NOT RENDER INTERNAL NOTE",
      customerEmail: "DO NOT RENDER CUSTOMER EMAIL",
      items: detailJob.items.map((item) => ({
        ...item,
        priceMinor: "DO NOT RENDER PRICE",
        internalNotes: "DO NOT RENDER INTERNAL NOTE",
      })),
    };

    expectSafeProjection(
      renderToStaticMarkup(
        <TechnicianJobList jobs={[unsafeListRuntimeValue]} locale="en" />,
      ),
    );
    expectSafeProjection(
      renderToStaticMarkup(
        <TechnicianJobDetailCard job={unsafeDetailRuntimeValue} locale="en" />,
      ),
    );
  });

  it("keeps the customer passport narrower than staff and job projections", () => {
    const unsafeRuntimePassport = {
      ...passport,
      accessInstructions: "DO NOT RENDER INTERNAL NOTE",
      quoteSnapshot: "DO NOT RENDER QUOTE SNAPSHOT",
      customerEmail: "DO NOT RENDER CUSTOMER EMAIL",
      entries: passport.entries.map((entry) => ({
        ...entry,
        priceMinor: "DO NOT RENDER PRICE",
        marginMinor: "DO NOT RENDER MARGIN",
        internalNotes: "DO NOT RENDER INTERNAL NOTE",
      })),
    };

    const html = renderToStaticMarkup(
      <CustomerCleaningPassportCard passport={unsafeRuntimePassport} locale="en" />,
    );
    expect(html).toContain("Cleaning passport");
    expectSafeProjection(html);
    expect(html).not.toContain("Visit contact");
    expect(html).not.toContain("Access instructions");
  });

  it("does not accidentally render commercial or internal extras in staff history", () => {
    const unsafeRuntimeHistory = {
      ...staffHistory,
      entries: staffHistory.entries.map((entry) => ({
        ...entry,
        priceMinor: "DO NOT RENDER PRICE",
        marginMinor: "DO NOT RENDER MARGIN",
        internalNotes: "DO NOT RENDER INTERNAL NOTE",
        quoteSnapshot: "DO NOT RENDER QUOTE SNAPSHOT",
      })),
    };
    const html = renderToStaticMarkup(
      <StaffAssetHistoryCard history={unsafeRuntimeHistory} locale="en" />,
    );

    expect(html).toContain("Cleaning history");
    expectSafeProjection(html);
  });
});
