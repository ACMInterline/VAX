import { describe, expect, it } from "vitest";
import { ownerBootstrapDecision } from "./bootstrap-policy";

describe("owner bootstrap", () => {
  it("allows an explicit first owner only when none exists", () => {
    expect(ownerBootstrapDecision([], "profile-a")).toBe("ASSIGN_OWNER");
  });

  it("is idempotent for the same owner", () => {
    expect(
      ownerBootstrapDecision(
        [{ profileId: "profile-a", active: true }],
        "profile-a",
      ),
    ).toBe("ALREADY_OWNER");
  });

  it("refuses a different owner after ownership is established", () => {
    expect(
      ownerBootstrapDecision(
        [{ profileId: "profile-a", active: true }],
        "profile-b",
      ),
    ).toBe("OWNERSHIP_ALREADY_ESTABLISHED");
  });

  it("does not reactivate bootstrap after the first owner is revoked", () => {
    expect(
      ownerBootstrapDecision(
        [{ profileId: "profile-a", active: false }],
        "profile-a",
      ),
    ).toBe("OWNERSHIP_ALREADY_ESTABLISHED");
  });
});
