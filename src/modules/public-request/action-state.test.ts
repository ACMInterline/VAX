import { describe, expect, it } from "vitest";
import {
  publicRequestFieldErrorsFromZod,
  retainPublicRequestValues,
} from "./action-state";
import { createPublicRequestSchema } from "./request-schema";

describe("public request action state boundary", () => {
  it("retains only bounded allowlisted display values and never the honeypot", () => {
    const formData = new FormData();
    formData.set("name", "N".repeat(140));
    formData.set("email", "customer@example.com");
    formData.set("propertyType", "not-allowlisted");
    formData.append("services", "CARPET_FIXED");
    formData.append("services", "CARPET_FIXED");
    formData.append("services", "NOT_A_SERVICE");
    formData.set("condition", "NOTICEABLY_SOILED");
    formData.set("website", "secret bot value");
    formData.set("unexpected", "must never be reflected");

    const values = retainPublicRequestValues(formData);

    expect(values.name).toHaveLength(100);
    expect(values.propertyType).toBeUndefined();
    expect(values.services).toEqual(["CARPET_FIXED"]);
    expect(values.condition).toBe("NOTICEABLY_SOILED");
    expect(values).not.toHaveProperty("website");
    expect(values).not.toHaveProperty("unexpected");
  });

  it("allowlists localized Zod errors by visible field name", () => {
    const parsed = createPublicRequestSchema("en").safeParse({
      name: "",
      email: "customer@example.com",
      phone: "+359 88 123 4567",
      district: "Lozenets",
      propertyType: "apartment",
      services: ["CARPET_FIXED"],
      condition: "NOTICEABLY_SOILED",
      stainsPresent: "no",
      delicateMaterial: false,
      preferredTime: "flexible",
      unexpected: "input",
    });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const errors = publicRequestFieldErrorsFromZod(parsed.error);

    expect(errors.name).toContain("Enter your name.");
    expect(errors).not.toHaveProperty("unexpected");
    expect(errors).not.toHaveProperty("website");
  });
});
