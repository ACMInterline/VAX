import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { JobFormAction } from "./types";
import {
  JobCompletionForm,
  JobItemInspectionForm,
  JobItemProgressForm,
  JobItemTreatmentCompletionForm,
  JobItemTreatmentPlanForm,
  JobProgressForm,
} from "./workflow-forms";

const reference = "JOB-0123456789ABCDEF01234567";
const itemId = "10000000-0000-4000-8000-000000000001";
const unchangedAction: JobFormAction = async (state, formData) => {
  void formData;
  return state;
};
const inspectionOptions = {
  cleaningItemTypes: [{ id: "item-type-1", label: "Sofa" }],
  measurementModes: [{ id: "measurement-1", label: "Per seat" }],
  conditions: [{ id: "condition-1", label: "Moderate" }],
  materials: [{ id: "material-1", label: "Textile" }],
  constructions: [{ id: "construction-1", label: "Fixed upholstery" }],
  issues: [{ id: "issue-1", label: "Food mark" }],
  risks: [{ id: "risk-1", label: "Colour transfer" }],
};
const planOptions = {
  treatmentLevels: [{ id: "level-1", label: "Corrective" }],
  mechanicalActions: [{ id: "action-1", label: "Gentle agitation" }],
  treatmentApproaches: [{ id: "approach-1", label: "Low-moisture extraction" }],
  addons: [{ id: "addon-1", label: "Deodorising" }],
  products: [{ id: "product-1", label: "Neutral textile solution" }],
};

function expectAuthorityFields(html: string) {
  expect(html).toContain(`name="jobReference" value="${reference}"`);
  expect(html).toContain('name="expectedJobVersion" value="4"');
  expect(html).not.toMatch(
    /name="(?:price|margin|teamId|customerId|bookingId|quoteId|startedAt|completedAt|actorId)"/,
  );
}

describe("Phase 3F workflow forms", () => {
  it.each([
    ["bg", "Проверка на място", "Установено състояние"],
    ["en", "On-site inspection", "Observed condition"],
  ] as const)("renders accessible inspection controls in %s", (locale, title, condition) => {
    const html = renderToStaticMarkup(
      <JobItemInspectionForm
        action={unchangedAction}
        expectedItemVersion={2}
        expectedJobVersion={4}
        jobItemId={itemId}
        jobReference={reference}
        locale={locale}
        options={inspectionOptions}
      />,
    );

    expect(html).toContain(title);
    expect(html).toContain(`>${condition}</label>`);
    expect(html).toContain('name="observedCleaningItemTypeId"');
    expect(html).toContain('name="measurementModeId"');
    expect(html).toContain('name="quantity"');
    expect(html).toContain('name="observedConditionLevelId"');
    expect(html).toContain('name="confirmedFibreMaterialId"');
    expect(html).toContain('name="confirmedSurfaceConstructionId"');
    expect(html).toContain('name="issueTypeIds"');
    expect(html).toContain('name="riskFlagIds"');
    expect(html).toContain('name="unsafeContaminationObserved"');
    expect(html).toContain('name="unsafeStructuralConditionObserved"');
    expect(html).toContain('name="noKnownIssuesAcknowledged"');
    expect(html).toContain('name="noKnownRisksAcknowledged"');
    expect(html).toContain('name="expectedJobItemVersion" value="2"');
    expect(html).toMatch(/<label for="[^"]+">/);
    expectAuthorityFields(html);
  });

  it("renders a fixed treatment decision without commercial authority", () => {
    const html = renderToStaticMarkup(
      <JobItemTreatmentPlanForm
        action={unchangedAction}
        expectedItemVersion={2}
        expectedJobVersion={4}
        jobItemId={itemId}
        jobReference={reference}
        locale="en"
        options={planOptions}
        sourceInspectionId="20000000-0000-4000-8000-000000000001"
      />,
    );

    expect(html).toContain("Confirm treatment");
    expect(html).toMatch(/type="radio"[^>]*name="decision"[^>]*value="PERFORM"/);
    expect(html).toContain('value="PERFORM_WITH_LIMITATIONS"');
    expect(html).toContain('value="DECLINE"');
    expect(html).toContain('value="REFER"');
    expect(html).toContain('value="REQUIRES_REVIEW"');
    expect(html).toContain('name="sourceInspectionId"');
    expect(html).toContain('name="treatmentLevelId"');
    expect(html).toContain('name="mechanicalActionLevelId"');
    expect(html).toContain('name="treatmentApproachId"');
    expect(html).toContain('name="technicianRationale"');
    expect(html).toContain('name="safetyAcknowledged"');
    expect(html).not.toContain('name="materialScopeChange"');
    expect(html).toContain("does not change the commercial terms");
    expectAuthorityFields(html);
  });

  it("uses fixed progress operations and accepts no client timestamps", () => {
    const jobHtml = renderToStaticMarkup(
      <JobProgressForm
        action={unchangedAction}
        expectedJobVersion={4}
        jobReference={reference}
        locale="en"
        operation="MARK_ARRIVED"
      />,
    );
    const itemHtml = renderToStaticMarkup(
      <JobItemProgressForm
        action={unchangedAction}
        expectedItemVersion={2}
        expectedJobVersion={4}
        jobItemId={itemId}
        jobReference={reference}
        locale="en"
        operation="START_TREATMENT"
        treatmentPlanId="20000000-0000-4000-8000-000000000001"
      />,
    );

    expect(jobHtml).toContain('name="operation" value="MARK_ARRIVED"');
    expect(jobHtml).toContain("Mark arrived");
    expect(itemHtml).toContain('name="operation" value="START_TREATMENT"');
    expect(itemHtml).toContain('name="treatmentPlanId"');
    expect(itemHtml).toContain("Start treatment");
    expectAuthorityFields(jobHtml);
    expectAuthorityFields(itemHtml);
  });

  it("captures actual treatment and a controlled result without client timestamps", () => {
    const html = renderToStaticMarkup(
      <JobItemTreatmentCompletionForm
        action={unchangedAction}
        expectedItemVersion={3}
        expectedJobVersion={4}
        expectedTreatmentExecutionVersion={1}
        jobItemId={itemId}
        jobReference={reference}
        locale="en"
        options={planOptions}
        treatmentExecutionId="30000000-0000-4000-8000-000000000001"
      />,
    );

    expect(html).toContain("Complete treatment");
    expect(html).toContain('name="performedTreatmentLevelId"');
    expect(html).toContain('name="performedMechanicalActionLevelId"');
    expect(html).toContain('name="performedTreatmentApproachId"');
    expect(html).toContain('name="performedAddonIds"');
    expect(html).toContain('name="resultClassification"');
    expect(html).toContain('value="STOPPED_FOR_SAFETY"');
    expect(html).toContain('name="expectedTreatmentExecutionVersion" value="1"');
    expectAuthorityFields(html);
  });

  it.each([
    ["bg", "Завършване на задачата", "Резюме за клиента"],
    ["en", "Complete job", "Customer summary"],
  ] as const)("renders an accessible customer-safe completion form in %s", (locale, title, summary) => {
    const html = renderToStaticMarkup(
      <JobCompletionForm
        action={unchangedAction}
        expectedJobVersion={4}
        jobReference={reference}
        locale={locale}
      />,
    );

    expect(html).toContain(title);
    expect(html).toContain(`>${summary}</label>`);
    expect(html).toContain('name="internalCompletionNotes"');
    expect(html).toContain('name="customerVisibleCompletionNotes"');
    expect(html).toContain('name="customerVisibleCareNotes"');
    expect(html).toContain('name="completionAcknowledged"');
    expect(html).toContain("required");
    expectAuthorityFields(html);
  });
});
