import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type {
  CustomerSelfDetail,
  CustomerSummary,
  StaffCustomerDetail,
} from "@/modules/customer-crm/types";
import { CustomerSelfServiceCard } from "./customer-self-service-card";
import { StaffCustomerCard } from "./staff-customer-card";

const customerId = "10000000-0000-4000-8000-000000000001";
const propertyId = "20000000-0000-4000-8000-000000000001";
const areaId = "30000000-0000-4000-8000-000000000001";
const assetId = "40000000-0000-4000-8000-000000000001";
const now = new Date("2026-08-24T09:00:00.000Z");

const summary: CustomerSummary = {
  id: customerId,
  customerType: "INDIVIDUAL",
  displayName: "Customer A",
  legalName: null,
  preferredLocale: "en",
  primaryEmail: "customer@example.invalid",
  primaryPhone: "+359 88 123 4567",
  status: "ACTIVE",
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const safeArea = {
  id: areaId,
  propertyId,
  areaType: "LIVING_ROOM" as const,
  customLabel: null,
  floorLevel: "1",
  active: true,
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const safeAsset = {
  id: assetId,
  propertyId,
  areaId,
  cleaningItemTypeId: 1,
  label: "Grey sofa",
  approximateLengthCm: 220,
  approximateWidthCm: 95,
  approximateAreaHundredthsM2: null,
  approximateSeatCount: 3,
  reportedFibreMaterialId: null,
  reportedSurfaceConstructionId: null,
  customerReportedConditionLevelId: null,
  customerConditionNotes: "Used every day",
  colourAppearanceNotes: "Grey",
  approximateAcquisitionYear: 2020,
  status: "ACTIVE" as const,
  reportedIssueTypeIds: [5],
  reportedRiskFlagIds: [6],
  version: 1,
  createdAt: now,
  updatedAt: now,
};

const selfDetail: CustomerSelfDetail = {
  ...summary,
  contacts: [],
  properties: [
    {
      id: propertyId,
      customerId,
      propertyType: "RESIDENTIAL",
      label: "Home",
      city: "Sofia",
      district: "Lozenets",
      streetAddress: "Synthetic 1",
      postalCode: "1000",
      serviceZoneId: null,
      status: "ACTIVE",
      version: 1,
      createdAt: now,
      updatedAt: now,
      areas: [safeArea],
      cleaningAssets: [safeAsset],
    },
  ],
};

const staffDetail: StaffCustomerDetail = {
  ...summary,
  internalNotes: "STAFF INTERNAL SUMMARY",
  contacts: [],
  identityLinks: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      customerId,
      userProfileId: "60000000-0000-4000-8000-000000000001",
      relationshipType: "OWNER",
      active: true,
      createdAt: now,
      revokedAt: null,
    },
  ],
  properties: [
    {
      ...selfDetail.properties[0],
      latitude: 42.7,
      longitude: 23.3,
      accessNotes: "STAFF ACCESS NOTE",
      parkingNotes: "STAFF PARKING NOTE",
      areas: [{ ...safeArea, notes: "STAFF AREA NOTE" }],
      cleaningAssets: [{ ...safeAsset, operationalNotes: "STAFF ASSET NOTE" }],
    },
  ],
};

describe("CRM read cards", () => {
  it("renders the authorized staff projection with operational context", () => {
    const html = renderToStaticMarkup(
      <StaffCustomerCard customer={staffDetail} locale="en" />,
    );

    expect(html).toContain("Customer A");
    expect(html).toContain("STAFF INTERNAL SUMMARY");
    expect(html).toContain("STAFF ACCESS NOTE");
    expect(html).toContain("STAFF PARKING NOTE");
    expect(html).toContain("STAFF AREA NOTE");
    expect(html).toContain("STAFF ASSET NOTE");
    expect(html).toContain("crm-staff-customer-card");
  });

  it("renders only the safe self-service projection even when runtime data has extras", () => {
    const customerWithUnexpectedExtras = {
      ...selfDetail,
      internalNotes: "DO NOT RENDER INTERNAL",
      identityLinks: staffDetail.identityLinks,
      properties: [
        {
          ...selfDetail.properties[0],
          latitude: 42.7,
          longitude: 23.3,
          accessNotes: "DO NOT RENDER ACCESS",
          parkingNotes: "DO NOT RENDER PARKING",
          areas: [{ ...safeArea, notes: "DO NOT RENDER AREA NOTE" }],
          cleaningAssets: [
            { ...safeAsset, operationalNotes: "DO NOT RENDER ASSET NOTE" },
          ],
        },
      ],
    };
    const html = renderToStaticMarkup(
      <CustomerSelfServiceCard
        customer={customerWithUnexpectedExtras}
        locale="en"
      />,
    );

    expect(html).toContain("This area is read-only");
    expect(html).toContain("Synthetic 1");
    expect(html).toContain("Grey sofa");
    expect(html).toContain("Approximate seat count");
    expect(html).not.toContain("DO NOT RENDER");
    expect(html).toContain("crm-customer-self-service-card");
  });
});
