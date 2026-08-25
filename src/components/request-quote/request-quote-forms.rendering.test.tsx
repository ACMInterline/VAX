import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RequestQuoteFormAction } from "./action-state";
import { RequestCreateForm } from "./request-create-form";
import {
  QuoteDraftForm,
  RequestLinkForm,
  RequestNormalizationForm,
} from "./staff-workflow-forms";

const requestId = "10000000-0000-4000-8000-000000000001";
const customerId = "20000000-0000-4000-8000-000000000001";
const propertyId = "30000000-0000-4000-8000-000000000001";
const assetId = "40000000-0000-4000-8000-000000000001";
const itemId = "50000000-0000-4000-8000-000000000001";
const quoteId = "70000000-0000-4000-8000-000000000001";

const unchangedAction: RequestQuoteFormAction = async (state, formData) => {
  void formData;
  return state;
};

const customers = [
  {
    id: customerId,
    label: "Linked customer",
    properties: [
      {
        id: propertyId,
        label: "Home",
        assets: [{ id: assetId, label: "Sofa" }],
      },
    ],
  },
] as const;

describe("request and quote form presentation", () => {
  it("renders customer creation choices as stable linked identifiers", () => {
    const html = renderToStaticMarkup(
      <RequestCreateForm
        action={unchangedAction}
        customers={customers}
        locale="en"
        mode="customer"
      />,
    );

    expect(html).toContain('name="customerId"');
    expect(html).toContain(`value="${customerId}"`);
    expect(html).toContain('name="propertyId"');
    expect(html).toContain(`value="${propertyId}"`);
    expect(html).toContain('name="cleaningAssetId"');
    expect(html).toContain(`value="${assetId}"`);
    expect(html).toContain('aria-busy="false"');
  });

  it("locks an already-linked customer while allowing only that customer's property", () => {
    const html = renderToStaticMarkup(
      <RequestLinkForm
        action={unchangedAction}
        customers={customers}
        expectedVersion={4}
        lockedCustomerId={customerId}
        locale="en"
        requestId={requestId}
      />,
    );

    expect(html).toContain(
      `<input type="hidden" name="customerId" value="${customerId}"`,
    );
    expect(html).not.toContain('<select id="request-link-customer"');
    expect(html).toContain(`value="${propertyId}"`);
    expect(html).toContain("Linked customer");
  });

  it("keeps customer-reported facts read-only and posts separate normalized values", () => {
    const html = renderToStaticMarkup(
      <RequestNormalizationForm
        action={unchangedAction}
        expectedVersion={5}
        items={[
          {
            id: itemId,
            version: 2,
            serviceId: 1,
            cleaningItemTypeId: 2,
            cleaningAssetId: assetId,
            measurementModeId: 3,
            customerReportedConditionLevelId: 98,
            normalizedConditionLevelId: 4,
            reportedFibreMaterialId: 95,
            reportedSurfaceConstructionId: 96,
            normalizedFibreMaterialId: 5,
            normalizedSurfaceConstructionId: 6,
            customerDescription: "Reported sofa",
            normalizedDescription: "Reviewed sofa",
            quantity: 1,
            areaHundredthsM2: null,
            seatCount: 3,
            sides: 1,
            sortOrder: 0,
            issueTypeIds: [],
            addonIds: [],
          },
        ]}
        locale="en"
        options={{
          services: [{ id: 1, label: "Cleaning" }],
          itemTypes: [{ id: 2, label: "Sofa" }],
          measurementModes: [{ id: 3, label: "Per seat" }],
          conditionLevels: [{ id: 4, label: "Normal" }],
          fibreMaterials: [{ id: 5, label: "Wool" }],
          surfaceConstructions: [{ id: 6, label: "Woven" }],
          issueTypes: [],
          addons: [],
          assets: [{ id: assetId, label: "Home — Sofa" }],
        }}
        requestId={requestId}
        staffNotes={null}
      />,
    );

    expect(html).toContain("Customer-reported condition: 98");
    expect(html).not.toContain('name="items.0.customerReportedConditionLevelId"');
    expect(html).toContain('name="items.0.normalizedConditionLevelId"');
    expect(html).toContain('value="4" selected=""');
    expect(html).toContain("Customer-reported material: 95");
    expect(html).toContain("Customer-reported construction: 96");
    expect(html).not.toContain('name="items.0.reportedFibreMaterialId"');
    expect(html).not.toContain('name="items.0.reportedSurfaceConstructionId"');
    expect(html).toContain('name="items.0.normalizedFibreMaterialId"');
    expect(html).toContain('name="items.0.normalizedSurfaceConstructionId"');
    expect(html).toContain('value="5" selected=""');
    expect(html).toContain('value="6" selected=""');
  });

  it("renders optimistic draft editing without a replaceable terms field", () => {
    const html = renderToStaticMarkup(
      <QuoteDraftForm
        action={unchangedAction}
        expectedRecordVersion={3}
        expectedRequestVersion={8}
        items={[
          {
            id: itemId,
            description: "Sofa cleaning",
            quantity: 1,
            netAmountMinorUnits: 10_000,
            manualOverrideReason: "Reviewed after inspection",
          },
        ]}
        locale="en"
        mode="update"
        quoteId={quoteId}
        requestId={requestId}
      />,
    );

    expect(html).toContain('name="quoteId"');
    expect(html).toContain('name="expectedRecordVersion" value="3"');
    expect(html).toContain('name="expectedRequestVersion" value="8"');
    expect(html).toContain('name="additionalAssumptions"');
    expect(html).toContain('name="quoteItems.0.manualOverrideReason"');
    expect(html).toContain("staff-reviewed lump sum");
    expect(html).not.toContain('name="estimateId"');
    expect(html).not.toContain('name="terms"');
    expect(html).toContain("controlled inspection, parking/travel, stain, drying and add-on terms");
  });
});
