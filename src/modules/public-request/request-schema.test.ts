import { describe, expect, it } from "vitest";
import {
  publicRequestSchema,
  readPublicRequestForm,
} from "./request-schema";

function validRequest() {
  return {
    name: "Nikolay Customer",
    email: "customer@example.com",
    phone: "+359 88 123 4567",
    district: "Lozenets",
    propertyType: "apartment",
    services: ["carpet", "sofa"],
    estimatedQuantity: "1 sofa, 2 rooms",
    approximateArea: "35 m²",
    condition: "visible-soil",
    stainsPresent: "yes",
    delicateMaterial: true,
    preferredDate: "2026-09-10",
    preferredTime: "morning",
    notes: "Please assess a wool rug separately.",
  };
}

describe("publicRequestSchema", () => {
  it("accepts a multi-service prototype request", () => {
    const result = publicRequestSchema.safeParse(validRequest());

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.services).toEqual(["carpet", "sofa"]);
      expect(result.data.delicateMaterial).toBe(true);
    }
  });

  it("rejects missing contact details and an empty service selection", () => {
    const result = publicRequestSchema.safeParse({
      ...validRequest(),
      email: "not-an-email",
      phone: "",
      services: [],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      const fields = result.error.flatten().fieldErrors;
      expect(fields.email).toContain("Enter a valid email address.");
      expect(fields.phone).toContain("Enter a phone number.");
      expect(fields.services).toContain("Select at least one service.");
    }
  });

  it("normalizes browser FormData without performing any persistence", () => {
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
      services: ["carpet", "sofa"],
      delicateMaterial: true,
    });
  });
});
