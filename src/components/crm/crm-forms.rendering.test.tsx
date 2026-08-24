import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  initialCrmActionState,
  type CrmActionState,
  type CrmFormAction,
} from "./action-state";
import { CleaningAssetForm } from "./cleaning-asset-form";
import { ContactForm } from "./contact-form";
import { CrmConfirmationAction } from "./confirmation-action";
import { CustomerForm } from "./customer-form";
import { CrmFormFeedback } from "./form-support";
import { IdentityLinkForm } from "./identity-link-form";
import { PropertyAreaForm } from "./property-area-form";
import { PropertyForm } from "./property-form";

const customerId = "10000000-0000-4000-8000-000000000001";
const propertyId = "20000000-0000-4000-8000-000000000001";
const areaId = "30000000-0000-4000-8000-000000000001";
const assetId = "40000000-0000-4000-8000-000000000001";

const unchangedAction: CrmFormAction = async (state, formData) => {
  void formData;
  return state;
};

describe("CRM form presentation", () => {
  it("renders structured business creation and versioned customer editing", () => {
    const createHtml = renderToStaticMarkup(
      <CustomerForm
        action={unchangedAction}
        locale="en"
        mode="create"
        initialValues={{
          customerType: "BUSINESS",
          displayName: "Example Hotel",
          preferredLocale: "en",
          initialContact: {
            contactName: "Reception",
            preferredContactMethod: "EMAIL",
            locale: "en",
          },
        }}
      />,
    );
    const editHtml = renderToStaticMarkup(
      <CustomerForm
        action={unchangedAction}
        locale="bg"
        mode="edit"
        initialValues={{
          customerId,
          expectedVersion: 7,
          customerType: "INDIVIDUAL",
          displayName: "Клиент",
          legalName: null,
          preferredLocale: "bg",
          primaryEmail: null,
          primaryPhone: "+359 88 123 4567",
          internalNotes: null,
        }}
      />,
    );

    expect(createHtml).toContain("Create customer");
    expect(createHtml).toContain('name="customerType"');
    expect(createHtml).toContain('value="BUSINESS" selected=""');
    expect(createHtml).toContain('name="initialContact.contactName"');
    expect(createHtml).toContain('name="initialContact.preferredContactMethod"');
    expect(createHtml).toContain('name="initialContact.locale"');
    expect(createHtml).toContain("crm-form__grid");
    expect(editHtml).toContain("Редактиране на клиент");
    expect(editHtml).toContain('name="customerId"');
    expect(editHtml).toContain(`value="${customerId}"`);
    expect(editHtml).toContain('name="expectedVersion"');
    expect(editHtml).toContain('value="7"');
  });

  it("renders bounded contact, property and area inputs with stable values", () => {
    const contactHtml = renderToStaticMarkup(
      <ContactForm
        action={unchangedAction}
        customerId={customerId}
        locale="en"
      />,
    );
    const propertyHtml = renderToStaticMarkup(
      <PropertyForm
        action={unchangedAction}
        locale="en"
        mode="create"
        customerId={customerId}
        serviceZoneOptions={[{ id: 11, label: "Sofia central" }]}
      />,
    );
    const propertyEditHtml = renderToStaticMarkup(
      <PropertyForm
        action={unchangedAction}
        locale="bg"
        mode="edit"
        initialValues={{
          propertyId,
          expectedVersion: 3,
          propertyType: "OFFICE",
          label: "Офис",
          city: "София",
          district: null,
          streetAddress: "Тестов адрес 1",
          postalCode: null,
          latitude: null,
          longitude: null,
          accessNotes: null,
          parkingNotes: null,
          serviceZoneId: null,
        }}
        serviceZoneOptions={[]}
      />,
    );
    const areaHtml = renderToStaticMarkup(
      <PropertyAreaForm
        action={unchangedAction}
        locale="en"
        propertyId={propertyId}
      />,
    );

    expect(contactHtml).toContain('name="preferredContactMethod"');
    expect(contactHtml).toContain('value="NO_PREFERENCE"');
    expect(contactHtml).toContain('name="isPrimary"');
    expect(propertyHtml).toContain('value="HOTEL_GUEST_ACCOMMODATION"');
    expect(propertyHtml).toContain('name="serviceZoneId"');
    expect(propertyHtml).toContain('value="11"');
    expect(propertyEditHtml).toContain('name="propertyId"');
    expect(propertyEditHtml).toContain('name="expectedVersion"');
    expect(areaHtml).toContain('value="MEETING_ROOM"');
    expect(areaHtml).toContain('name="customLabel"');
  });

  it("takes all asset canonical choices as props and posts stable identifiers", () => {
    const html = renderToStaticMarkup(
      <CleaningAssetForm
        action={unchangedAction}
        locale="en"
        propertyId={propertyId}
        options={{
          areas: [{ id: areaId, label: "Living room" }],
          itemTypes: [{ id: 1, label: "Sofa" }],
          fibreMaterials: [{ id: 2, label: "Wool" }],
          surfaceConstructions: [{ id: 3, label: "Woven" }],
          conditionLevels: [{ id: 4, label: "Used" }],
          issueTypes: [{ id: 5, label: "Stain" }],
          riskFlags: [{ id: 6, label: "Delicate" }],
        }}
      />,
    );

    expect(html).toContain('name="cleaningItemTypeId"');
    expect(html).toContain('value="1"');
    expect(html).toContain('name="areaId"');
    expect(html).toContain(`value="${areaId}"`);
    expect(html).toContain('name="reportedFibreMaterialId"');
    expect(html).toContain('name="reportedSurfaceConstructionId"');
    expect(html).toContain('name="customerReportedConditionLevelId"');
    expect(html).toContain('name="reportedIssueTypeIds"');
    expect(html).toContain('name="reportedRiskFlagIds"');
    expect(html).toContain("does not calculate a price");
  });

  it("renders explicit profile-link and destructive confirmation context", () => {
    const linkHtml = renderToStaticMarkup(
      <IdentityLinkForm
        action={unchangedAction}
        customerId={customerId}
        locale="en"
      />,
    );
    const archiveHtml = renderToStaticMarkup(
      <CrmConfirmationAction
        action={unchangedAction}
        locale="en"
        target={{ kind: "asset", assetId, expectedVersion: 2 }}
      >
        Archive asset
      </CrmConfirmationAction>,
    );
    const revokeHtml = renderToStaticMarkup(
      <CrmConfirmationAction
        action={unchangedAction}
        locale="bg"
        target={{ kind: "identity-link", linkId: "50000000-0000-4000-8000-000000000001" }}
      >
        Отнеми достъпа
      </CrmConfirmationAction>,
    );

    expect(linkHtml).toContain('name="userProfileId"');
    expect(linkHtml).toContain('value="AUTHORIZED_CONTACT"');
    expect(linkHtml).toContain("matching email never creates access");
    expect(archiveHtml).toContain('name="assetId"');
    expect(archiveHtml).toContain('name="expectedVersion"');
    expect(revokeHtml).toContain('name="linkId"');
    expect(revokeHtml).toContain("Клиентският запис няма да бъде изтрит");
  });

  it("links localized validation feedback to every invalid field", () => {
    const state: CrmActionState = {
      status: "ERROR",
      message: "Check the fields.",
      fieldErrors: {
        displayName: ["Enter a display name."],
        primaryEmail: ["Enter a valid email."],
      },
    };
    const html = renderToStaticMarkup(
      <CrmFormFeedback
        fields={[
          { name: "displayName", id: "customer-displayName", label: "Display name" },
          { name: "primaryEmail", id: "customer-primaryEmail", label: "Primary email" },
        ]}
        state={state}
        title="Check the highlighted fields"
      />,
    );

    expect(initialCrmActionState).toEqual({ status: "IDLE" });
    expect(html).toContain('href="#customer-displayName"');
    expect(html).toContain('href="#customer-primaryEmail"');
    expect(html).toContain("Display name: Enter a display name.");
  });
});
