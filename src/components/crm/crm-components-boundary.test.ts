import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function source(file: string): string {
  return readFileSync(path.join(process.cwd(), "src/components/crm", file), "utf8");
}

const formFiles = [
  "customer-form.tsx",
  "contact-form.tsx",
  "property-form.tsx",
  "property-area-form.tsx",
  "cleaning-asset-form.tsx",
  "identity-link-form.tsx",
] as const;

describe("CRM component boundaries", () => {
  it("keeps every mutation form client-side, independently pending and accessible", () => {
    for (const file of formFiles) {
      const form = source(file);
      expect(form).toContain('"use client"');
      expect(form).toContain("useCrmAction");
      expect(form).toContain("action={formAction}");
      expect(form).toContain("noValidate");
      expect(form).toContain("CrmFormFeedback");
      expect(form).toContain("crmFieldAccessibility");
      expect(form).toContain("pending={pending}");
      expect(form).toContain("crm-form__grid");
      expect(form).not.toMatch(/@\/db\/|customer-crm\/(?:repository|service)/);
      expect(form).not.toContain('"use server"');
    }
  });

  it("uses response object identity for shared field-summary focus", () => {
    const support = source("form-support.tsx");
    expect(support).toContain("response={state}");
    expect(support).toContain("ApplicationFormErrorSummary");
    expect(support).toContain("ApplicationActionStatus");
  });

  it("keeps structured business contact and canonical asset references explicit", () => {
    const customer = source("customer-form.tsx");
    const asset = source("cleaning-asset-form.tsx");

    expect(customer).toContain('name="initialContact.contactName"');
    expect(customer).toContain('name="initialContact.email"');
    expect(customer).toContain('name="initialContact.phone"');
    expect(asset).toContain("options.itemTypes.map");
    expect(asset).toContain("options.issueTypes.map");
    expect(asset).toContain("options.riskFlags.map");
  });

  it("makes the self-service card depend only on the safe DTO", () => {
    const card = source("customer-self-service-card.tsx");

    expect(card).toContain("CustomerSelfDetail");
    expect(card).not.toContain("StaffCustomerDetail");
    expect(card).not.toMatch(
      /\.(?:internalNotes|identityLinks|userProfileId|accessNotes|parkingNotes|operationalNotes|latitude|longitude)\b/,
    );
  });
});
