import { describe, expect, it } from "vitest";
import { withVerificationNextStep } from "./action-state";

describe("authentication action state", () => {
  it("marks a generic response with the email-verification next step", () => {
    expect(
      withVerificationNextStep(
        { status: "ERROR", message: "Verify your email before continuing." },
        true,
      ),
    ).toEqual({
      status: "ERROR",
      message: "Verify your email before continuing.",
      nextStep: "VERIFY_EMAIL",
    });
  });

  it("does not add verification navigation when the policy does not require it", () => {
    expect(
      withVerificationNextStep(
        { status: "SUCCESS", message: "Request accepted." },
        false,
      ),
    ).toEqual({ status: "SUCCESS", message: "Request accepted." });
  });
});
