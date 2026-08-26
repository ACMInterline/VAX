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
  plannedDurationMinutes: 120,
  customerDisplayName: "Sample customer",
  propertyLabel: "Sample home",
  serviceAddress: "1 Example Street, Sofia",
  accessInstructions: "Ring the apartment bell.",
  assignedTeamLabel: "Team Alpha",
  itemLabels: ["Three-seat sofa"],
  reviewReasons: [],
};

const detailJob: TechnicianJobDetail = {
  reference,
  status: "IN_PROGRESS",
  version: 4,
  scheduledStart: now,
  plannedDurationMinutes: 120,
  customerDisplayName: "Sample customer",
  propertyLabel: "Sample home",
  serviceAddress: "1 Example Street, Sofia",
  assignedTeamLabel: "Team Alpha",
  visitContact: { name: "Visit contact", phone: "+359 88 000 0000" },
  accessInstructions: "Ring the apartment bell.",
  parkingInstructions: "Use the marked visitor space.",
  customerServiceNotes: null,
  reviewReasons: [],
  items: [
    {
      id: "10000000-0000-4000-8000-000000000001",
      status: "COMPLETED",
      planned: {
        serviceLabel: "Upholstery cleaning",
        itemLabel: "Three-seat sofa",
        quantityLabel: "1 item",
        measurementLabel: "3 seats",
        reportedConditionLabel: "Moderate",
        reportedMaterialLabel: "Textile",
        reportedConstructionLabel: "Fixed upholstery",
        reportedIssueLabels: ["Food mark"],
        requestedAddonLabels: ["Deodorising"],
        customerDescription: "Used in the living room.",
      },
      observed: {
        inspectedAt: now,
        conditionLabel: "Moderate",
        materialLabel: "Textile",
        constructionLabel: "Fixed upholstery",
        measurementLabel: "3 seats",
        issueLabels: ["Food mark"],
        riskLabels: ["Colour transfer test required"],
      },
      confirmedTreatment: {
        confirmedAt: now,
        decision: "PERFORM",
        methodLabel: "Low-moisture extraction",
        addonLabels: ["Deodorising"],
        productLabel: "Neutral textile solution",
      },
      performed: {
        startedAt: now,
        completedAt: new Date("2026-08-25T11:00:00.000Z"),
        resultClassification: "COMPLETED_AS_PLANNED",
        methodLabel: "Low-moisture extraction",
        addonLabels: ["Deodorising"],
        productLabel: "Neutral textile solution",
        customerVisibleSummary: "The agreed sofa treatment was completed.",
        careInstructions: "Allow the fabric to dry fully before use.",
      },
    },
  ],
};

const staffHistory: StaffAssetHistory = {
  assetLabel: "Three-seat sofa",
  propertyLabel: "Sample home",
  entries: [
    {
      id: "20000000-0000-4000-8000-000000000001",
      jobReference: reference,
      completedAt: now,
      serviceDescription: "Upholstery cleaning",
      observedConditionSummary: "Moderate condition observed.",
      treatmentSummary: "Low-moisture extraction with deodorising.",
      resultClassification: "COMPLETED_AS_PLANNED",
      inspectionIssueSummary: ["Food mark"],
      inspectionRiskSummary: ["Colour transfer test required"],
      careRecommendation: "Allow the fabric to dry fully before use.",
      maintenanceRecommendation: null,
    },
  ],
};

const passport: CustomerCleaningPassport = {
  assetLabel: "Three-seat sofa",
  propertyLabel: "Sample home",
  entries: [
    {
      jobReference: reference,
      completedAt: now,
      serviceDescription: "Upholstery cleaning",
      observedConditionSummary: "Moderate condition observed.",
      treatmentSummary: "The agreed sofa treatment was completed.",
      resultClassification: "COMPLETED_AS_PLANNED",
      careRecommendation: "Allow the fabric to dry fully before use.",
      maintenanceRecommendation: {
        recommendedReviewDate: null,
        suggestedIntervalMonths: 12,
        reason: "Technician assessment",
      },
    },
  ],
};

describe("Phase 3F job execution presentation", () => {
  it.each([
    ["bg", "Работни задачи", "Отвори задачата"],
    ["en", "Field jobs", "Open job"],
  ] as const)("renders an accessible %s technician job list", (locale, title, open) => {
    const html = renderToStaticMarkup(
      <TechnicianJobList jobs={[listJob]} locale={locale} />,
    );

    expect(html).toContain(`id="job-list-title">${title}`);
    expect(html).toContain(`href="/app/jobs/${reference}"`);
    expect(html).toContain(open);
    expect(html).toContain("Team Alpha");
    expect(html).toContain("Sample customer");
    expect(html).toContain("Three-seat sofa");
    expect(html).toContain("Ring the apartment bell.");
  });

  it.each([
    ["bg", "Планирано", "Установено на място", "Потвърдена обработка", "Извършено", "Бележки за услугата от клиента"],
    ["en", "Planned", "Observed on site", "Confirmed treatment", "Performed", "Customer service notes"],
  ] as const)(
    "separates planned, observed, confirmed, and performed facts in %s",
    (locale, planned, observed, confirmed, performed, serviceNotesLabel) => {
      const jobWithServiceNotes = {
        ...detailJob,
        customerServiceNotes: "Please use shoe covers inside the home.",
      };
      const html = renderToStaticMarkup(
        <TechnicianJobDetailCard job={jobWithServiceNotes} locale={locale} />,
      );

      expect(html).toContain(`>${planned}</h4>`);
      expect(html).toContain(`>${observed}</h4>`);
      expect(html).toContain(`>${confirmed}</h4>`);
      expect(html).toContain(`>${performed}</h4>`);
      expect(html).toContain("aria-labelledby=");
      expect(html).toContain("Allow the fabric to dry fully before use.");
      expect(html).toContain("Use the marked visitor space.");
      expect(html).toContain(serviceNotesLabel);
      expect(html).toContain("Please use shoe covers inside the home.");
    },
  );

  it.each([
    ["bg", "История на почистването", "Паспорт на почистването"],
    ["en", "Cleaning history", "Cleaning passport"],
  ] as const)("renders bilingual staff and customer asset history in %s", (locale, staffTitle, customerTitle) => {
    const staffHtml = renderToStaticMarkup(
      <StaffAssetHistoryCard history={staffHistory} locale={locale} />,
    );
    const customerHtml = renderToStaticMarkup(
      <CustomerCleaningPassportCard passport={passport} locale={locale} />,
    );

    expect(staffHtml).toContain(staffTitle);
    expect(staffHtml).toContain("Colour transfer test required");
    expect(customerHtml).toContain(customerTitle);
    expect(customerHtml).toContain("The agreed sofa treatment was completed.");
    expect(customerHtml).toContain("12");
  });
});
