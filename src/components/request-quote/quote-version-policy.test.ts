import { describe, expect, it } from "vitest";
import {
  isCurrentQuotableEstimate,
  isLatestEditableQuoteDraft,
} from "./quote-version-policy";

describe("staff quote-version controls", () => {
  it("allows edit and issue controls only for the newest draft version", () => {
    expect(isLatestEditableQuoteDraft("DRAFT", 3, 3)).toBe(true);
    expect(isLatestEditableQuoteDraft("DRAFT", 2, 3)).toBe(false);
    expect(isLatestEditableQuoteDraft("ISSUED", 3, 3)).toBe(false);
    expect(isLatestEditableQuoteDraft("DRAFT", 0, 0)).toBe(false);
  });

  it("hides quote controls for stale or decline-and-refer estimates", () => {
    expect(isCurrentQuotableEstimate(8, 8, false)).toBe(true);
    expect(isCurrentQuotableEstimate(7, 8, false)).toBe(false);
    expect(isCurrentQuotableEstimate(8, 8, true)).toBe(false);
    expect(isCurrentQuotableEstimate(8, 8, undefined)).toBe(false);
  });
});
