import { describe, expect, it } from "vitest";
import {
  createCleaningAssetSchema,
  createContactSchema,
  createCustomerSchema,
  createPropertyAreaSchema,
  createPropertySchema,
  customerListInputSchema,
  updateCustomerSchema,
} from "./validation";

const customerId = "10000000-0000-4000-8000-000000000001";
const propertyId = "10000000-0000-4000-8000-000000000002";

describe("customer CRM validation", () => {
  it("normalizes a supported business customer without accepting unknown fields", () => {
    const result = createCustomerSchema.safeParse({
      customerType: "BUSINESS",
      displayName: "  Example Hotel  ",
      legalName: " Example Hotel EOOD ",
      preferredLocale: "en",
      primaryEmail: " OFFICE@EXAMPLE.INVALID ",
      primaryPhone: "+359 88 123 4567",
      internalNotes: "  Call reception before arrival. ",
      initialContact: {
        contactName: "Reception",
        email: "reception@example.invalid",
        phone: null,
        roleTitle: "Front desk",
        preferredContactMethod: "EMAIL",
        locale: "en",
      },
      authProviderUserId: "must-not-cross-the-boundary",
    });

    expect(result.success).toBe(false);
    expect(
      createCustomerSchema.parse({
        customerType: "BUSINESS",
        displayName: "  Example Hotel  ",
        legalName: " Example Hotel EOOD ",
        preferredLocale: "en",
        primaryEmail: " OFFICE@EXAMPLE.INVALID ",
        primaryPhone: "+359 88 123 4567",
        internalNotes: "  Call reception before arrival. ",
        initialContact: {
          contactName: "Reception",
          email: "reception@example.invalid",
          phone: null,
          roleTitle: "Front desk",
          preferredContactMethod: "EMAIL",
          locale: "en",
        },
      }),
    ).toEqual({
      customerType: "BUSINESS",
      displayName: "Example Hotel",
      legalName: "Example Hotel EOOD",
      preferredLocale: "en",
      primaryEmail: "office@example.invalid",
      primaryPhone: "+359 88 123 4567",
      internalNotes: "Call reception before arrival.",
      initialContact: {
        contactName: "Reception",
        email: "reception@example.invalid",
        phone: null,
        roleTitle: "Front desk",
        preferredContactMethod: "EMAIL",
        locale: "en",
      },
    });
  });

  it("requires an initial primary contact for a business customer", () => {
    expect(
      createCustomerSchema.safeParse({
        customerType: "BUSINESS",
        displayName: "Business Without Contact",
        preferredLocale: "bg",
      }).success,
    ).toBe(false);
    expect(
      createCustomerSchema.safeParse({
        customerType: "INDIVIDUAL",
        displayName: "Individual Customer",
        preferredLocale: "bg",
        primaryEmail: "individual@example.invalid",
      }).success,
    ).toBe(true);
  });

  it("requires a usable contact channel and a valid primary-contact state", () => {
    expect(
      createContactSchema.safeParse({
        customerId,
        contactName: "No Channel",
        email: null,
        phone: null,
        isPrimary: false,
        preferredContactMethod: "NO_PREFERENCE",
        locale: "bg",
      }).success,
    ).toBe(false);

    expect(
      createContactSchema.safeParse({
        customerId,
        contactName: "Primary Contact",
        email: "primary@example.invalid",
        phone: null,
        isPrimary: true,
        preferredContactMethod: "EMAIL",
        locale: "en",
      }).success,
    ).toBe(true);
  });

  it("requires coordinate pairs and enforces geographic bounds", () => {
    const base = {
      customerId,
      propertyType: "RESIDENTIAL",
      label: "Home",
      city: "Sofia",
      district: "Lozenets",
      streetAddress: "Synthetic 1",
      postalCode: "1000",
      accessNotes: null,
      parkingNotes: null,
      serviceZoneId: null,
    } as const;

    expect(
      createPropertySchema.safeParse({ ...base, latitude: 42.7, longitude: null })
        .success,
    ).toBe(false);
    expect(
      createPropertySchema.safeParse({ ...base, longitude: 23.3 }).success,
    ).toBe(false);
    expect(
      createPropertySchema.safeParse({ ...base, latitude: 91, longitude: 23.3 })
        .success,
    ).toBe(false);
    expect(
      createPropertySchema.safeParse({ ...base, latitude: 42.7, longitude: 23.3 })
        .success,
    ).toBe(true);
  });

  it("requires a custom area label only for OTHER", () => {
    expect(
      createPropertyAreaSchema.safeParse({
        propertyId,
        areaType: "OTHER",
        customLabel: null,
        floorLevel: null,
        notes: null,
      }).success,
    ).toBe(false);
    expect(
      createPropertyAreaSchema.safeParse({
        propertyId,
        areaType: "BEDROOM",
        customLabel: null,
        floorLevel: "2",
        notes: null,
      }).success,
    ).toBe(true);
  });

  it("rejects non-positive asset measures and duplicate identifiers", () => {
    const result = createCleaningAssetSchema.safeParse({
      propertyId,
      areaId: null,
      cleaningItemTypeId: 1,
      label: "Living-room sofa",
      approximateLengthCm: -1,
      approximateWidthCm: 200,
      approximateAreaHundredthsM2: null,
      approximateSeatCount: 3,
      reportedFibreMaterialId: null,
      reportedSurfaceConstructionId: null,
      customerReportedConditionLevelId: null,
      customerConditionNotes: null,
      colourAppearanceNotes: "Grey",
      approximateAcquisitionYear: 2020,
      operationalNotes: null,
      reportedIssueTypeIds: [1, 1],
      reportedRiskFlagIds: [],
    });

    expect(result.success).toBe(false);

    expect(
      createCleaningAssetSchema.safeParse({
        propertyId,
        areaId: null,
        cleaningItemTypeId: 1,
        label: "Zero-sized asset",
        approximateLengthCm: 0,
        reportedIssueTypeIds: [],
        reportedRiskFlagIds: [],
      }).success,
    ).toBe(false);
  });

  it("requires a positive integer optimistic version", () => {
    expect(
      updateCustomerSchema.safeParse({
        customerId,
        expectedVersion: 0,
        displayName: "Updated",
      }).success,
    ).toBe(false);
    expect(
      updateCustomerSchema.safeParse({
        customerId,
        expectedVersion: 2,
        displayName: "Updated",
      }).success,
    ).toBe(true);
  });

  it("bounds list input", () => {
    expect(customerListInputSchema.parse({ search: "  Example  " })).toEqual({
      search: "Example",
      limit: 25,
      offset: 0,
    });
    expect(customerListInputSchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
