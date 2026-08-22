import { describe, expect, it } from "vitest";
import {
  createPublicRequestSchema,
  readPublicRequestForm,
} from "./request-schema";

function validRequest() {
  return {
    name: "Nikolay Customer",
    email: "customer@example.com",
    phone: "+359 88 123 4567",
    district: "Lozenets",
    propertyType: "apartment",
    services: ["CARPET_FIXED", "SOFA_3_SEAT"],
    estimatedQuantity: "1 sofa, 2 rooms",
    approximateArea: "35 m²",
    condition: "NOTICEABLY_SOILED",
    stainsPresent: "yes",
    delicateMaterial: true,
    preferredDate: "2026-09-10",
    preferredTime: "morning",
    notes: "Please assess a wool rug separately.",
  };
}

describe("localized public request schema", () => {
  it("accepts the same multi-service request in both locales", () => {
    for (const locale of ["bg", "en"] as const) {
      const result = createPublicRequestSchema(locale).safeParse(validRequest());

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.services).toEqual([
          "CARPET_FIXED",
          "SOFA_3_SEAT",
        ]);
        expect(result.data.delicateMaterial).toBe(true);
      }
    }
  });

  it("returns natural Bulgarian validation messages on the primary route", () => {
    const result = createPublicRequestSchema("bg").safeParse({
      ...validRequest(),
      email: "not-an-email",
      phone: "",
      propertyType: "",
      services: [],
      condition: "",
      stainsPresent: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.email).toContain("Въведете валиден имейл адрес.");
      expect(fields.phone).toContain("Въведете телефонен номер.");
      expect(fields.propertyType).toContain("Изберете вид имот.");
      expect(fields.services).toContain(
        "Изберете поне една повърхност или артикул.",
      );
      expect(fields.condition).toContain("Изберете общо състояние.");
      expect(fields.stainsPresent).toContain(
        "Посочете дали виждате петна.",
      );
    }
  });

  it("retains equivalent English validation messages", () => {
    const result = createPublicRequestSchema("en").safeParse({
      ...validRequest(),
      email: "not-an-email",
      phone: "",
      propertyType: "",
      services: [],
      condition: "",
      stainsPresent: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.email).toContain("Enter a valid email address.");
      expect(fields.phone).toContain("Enter a phone number.");
      expect(fields.propertyType).toContain("Select a property type.");
      expect(fields.services).toContain("Select at least one surface or item.");
      expect(fields.condition).toContain("Select the general condition.");
      expect(fields.stainsPresent).toContain(
        "Select whether you can see stains.",
      );
    }
  });

  it("normalizes browser FormData without performing persistence", () => {
    const formData = new FormData();
    Object.entries(validRequest()).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((entry) => formData.append(key, entry));
      } else if (typeof value === "boolean") {
        if (value) formData.set(key, "on");
      } else {
        formData.set(key, value);
      }
    });

    expect(readPublicRequestForm(formData)).toMatchObject({
      name: "Nikolay Customer",
      services: ["CARPET_FIXED", "SOFA_3_SEAT"],
      delicateMaterial: true,
    });
  });
});
