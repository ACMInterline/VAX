import { describe, expect, it } from "vitest";
import { signupSchema } from "./validation";

const validSignup = {
  displayName: "Synthetic Customer",
  email: "customer@example.invalid",
  password: "correct horse battery staple",
  passwordConfirmation: "correct horse battery staple",
  preferredLocale: "en",
  termsAccepted: "on",
};

describe("authentication input validation", () => {
  it("accepts password-manager-friendly long passwords", () => {
    expect(signupSchema.safeParse(validSignup).success).toBe(true);
  });

  it("requires at least twelve characters without arbitrary composition rules", () => {
    expect(
      signupSchema.safeParse({
        ...validSignup,
        password: "short pass",
        passwordConfirmation: "short pass",
      }).success,
    ).toBe(false);
  });

  it("rejects mismatched confirmation", () => {
    const result = signupSchema.safeParse({
      ...validSignup,
      passwordConfirmation: "a different sufficiently long password",
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(["passwordConfirmation"]);
    }
  });

  it("strips client-supplied role data from registration input", () => {
    const result = signupSchema.parse({ ...validSignup, role: "OWNER" });
    expect(result).not.toHaveProperty("role");
  });
});
