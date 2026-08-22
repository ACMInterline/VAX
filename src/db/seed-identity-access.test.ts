import { describe, expect, it } from "vitest";
import {
  canonicalPermissionConflictUpdate,
  canonicalRoleConflictUpdate,
} from "./seed-identity-access";

describe("identity-access seed conflict policy", () => {
  it("preserves operational role activation state", () => {
    expect(canonicalRoleConflictUpdate).not.toHaveProperty("active");
  });

  it("preserves operational permission activation state", () => {
    expect(canonicalPermissionConflictUpdate).not.toHaveProperty("active");
  });
});
