import { describe, expect, it } from "vitest";
import { crmContent } from "./crm";

const expectedCodes = {
  customerTypes: ["INDIVIDUAL", "BUSINESS"],
  lifecycleStatuses: ["ACTIVE", "INACTIVE", "ARCHIVED"],
  contactMethods: ["EMAIL", "PHONE", "NO_PREFERENCE"],
  identityRelationships: ["OWNER", "PRIMARY_CONTACT", "AUTHORIZED_CONTACT"],
  propertyTypes: [
    "RESIDENTIAL",
    "OFFICE",
    "HOTEL_GUEST_ACCOMMODATION",
    "SERVICED_APARTMENT",
    "RESTAURANT_CAFE",
    "COMMERCIAL_PUBLIC",
    "OTHER",
  ],
  areaTypes: [
    "LIVING_ROOM",
    "BEDROOM",
    "DINING_ROOM",
    "OFFICE",
    "RECEPTION",
    "CORRIDOR",
    "STAIRCASE",
    "MEETING_ROOM",
    "HOTEL_ROOM",
    "OTHER",
  ],
} as const;

describe("CRM localized content", () => {
  it("keeps Bulgarian and English on the same exact content contract", () => {
    expect(Object.keys(crmContent.bg)).toEqual(Object.keys(crmContent.en));
    expect(Object.keys(crmContent.bg.forms)).toEqual(Object.keys(crmContent.en.forms));
    expect(Object.keys(crmContent.bg.labels)).toEqual(Object.keys(crmContent.en.labels));
  });

  it.each(["bg", "en"] as const)(
    "covers every stable CRM code in %s without translating the code",
    (locale) => {
      const labels = crmContent[locale].labels;

      expect(Object.keys(labels.customerTypes)).toEqual(expectedCodes.customerTypes);
      expect(Object.keys(labels.lifecycleStatuses)).toEqual(
        expectedCodes.lifecycleStatuses,
      );
      expect(Object.keys(labels.contactMethods)).toEqual(expectedCodes.contactMethods);
      expect(Object.keys(labels.identityRelationships)).toEqual(
        expectedCodes.identityRelationships,
      );
      expect(Object.keys(labels.propertyTypes)).toEqual(expectedCodes.propertyTypes);
      expect(Object.keys(labels.areaTypes)).toEqual(expectedCodes.areaTypes);
      expect(Object.values(labels).flatMap((record) => Object.values(record))).not.toContain(
        "",
      );
    },
  );

  it("provides safe localized ownership, internal-note, and self-service states", () => {
    expect(crmContent.bg.detail.internalNotesWarning).toContain("екипа");
    expect(crmContent.en.detail.internalNotesWarning).toContain("staff");
    expect(crmContent.bg.selfService.notLinkedTitle).toContain("свързан");
    expect(crmContent.en.selfService.notLinkedTitle).toContain("linked");
    expect(crmContent.bg.selfService.readOnlyNotice).toContain("само за преглед");
    expect(crmContent.en.selfService.readOnlyNotice).toContain("read-only");
  });

  it("localizes list summaries independently", () => {
    expect(crmContent.bg.list.pageSummary(2, 31)).toBe("Страница 2 · 31 клиенти");
    expect(crmContent.en.list.pageSummary(2, 31)).toBe("Page 2 · 31 customers");
  });
});
