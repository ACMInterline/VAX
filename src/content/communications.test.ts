import { describe, expect, it } from "vitest";
import { communicationsContent } from "./communications";

describe("Phase 3I communications content", () => {
  it("keeps complete Bulgarian and English labels for controlled values", () => {
    for (const locale of ["bg", "en"] as const) {
      expect(Object.keys(communicationsContent[locale].events)).toHaveLength(9);
      expect(Object.keys(communicationsContent[locale].documents)).toHaveLength(6);
      expect(Object.keys(communicationsContent[locale].statuses)).toHaveLength(6);
      expect(Object.keys(communicationsContent[locale].channels)).toHaveLength(4);
    }
  });

  it("describes portal publication without claiming external delivery", () => {
    expect(communicationsContent.bg.staff.portalOnly).toMatch(/не изпраща/i);
    expect(communicationsContent.en.staff.portalOnly).toMatch(/does not send/i);
    expect(communicationsContent.en.channels.EMAIL_FUTURE).toMatch(/future/i);
    expect(communicationsContent.en.channels.SMS_FUTURE).toMatch(/future/i);
  });
});
