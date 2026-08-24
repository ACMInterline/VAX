import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const routeRoot = join(
  process.cwd(),
  "src/app/(application)/app/customers",
);

const staffRoutes = [
  "page.tsx",
  "new/page.tsx",
  "[customerId]/page.tsx",
  "[customerId]/edit/page.tsx",
  "[customerId]/contacts/new/page.tsx",
  "[customerId]/access/new/page.tsx",
  "[customerId]/properties/new/page.tsx",
  "[customerId]/properties/[propertyId]/page.tsx",
  "[customerId]/properties/[propertyId]/edit/page.tsx",
  "[customerId]/properties/[propertyId]/areas/new/page.tsx",
  "[customerId]/properties/[propertyId]/assets/new/page.tsx",
] as const;

function source(relativePath: string): string {
  return readFileSync(join(routeRoot, relativePath), "utf8");
}

describe("protected customer CRM route boundary", () => {
  it.each(staffRoutes)("keeps %s behind a fresh server authorization context", (route) => {
    const page = source(route);

    expect(page).toMatch(/requireStaffCrm(Read|Manage|Identity)PageContext\(\)/);
  });

  it.each(staffRoutes.filter((route) => route !== "new/page.tsx"))(
    "creates a request-local CRM service for queried route %s",
    (route) => {
      expect(source(route)).toContain("createCustomerCrmPageService()");
    },
  );

  it.each(staffRoutes.filter((route) => route.includes("[customerId]")))(
    "validates promised dynamic params for %s",
    (route) => {
      const page = source(route);

      expect(page).toContain("params: Promise<");
      expect(page).toMatch(/parse(Customer|Property)RouteParams\(params\)/);
    },
  );

  it("validates promised list filters before querying", () => {
    const page = source("page.tsx");

    expect(page).toContain("searchParams: Promise<CrmSearchParams>");
    expect(page).toContain("parseCustomerSearchParams(searchParams)");
    expect(page).toContain("service.listCustomers(actor");

    const helper = source("_lib/crm-page.ts");
    expect(helper).toContain("value <= 4_167");
  });

  it("wires the complete focused action set without unsupported edit routes", () => {
    const combined = staffRoutes.map(source).join("\n");

    for (const action of [
      "createCustomerAction",
      "updateCustomerAction",
      "archiveCustomerAction",
      "createContactAction",
      "archiveContactAction",
      "linkCustomerIdentityAction",
      "revokeCustomerIdentityLinkAction",
      "createPropertyAction",
      "updatePropertyAction",
      "archivePropertyAction",
      "createAreaAction",
      "archiveAreaAction",
      "createAssetAction",
      "archiveAssetAction",
    ]) {
      expect(combined).toContain(action);
    }

    expect(staffRoutes).not.toContain(
      "[customerId]/contacts/[contactId]/edit/page.tsx",
    );
    expect(staffRoutes).not.toContain(
      "[customerId]/properties/[propertyId]/areas/[areaId]/edit/page.tsx",
    );
    expect(staffRoutes).not.toContain(
      "[customerId]/properties/[propertyId]/assets/[assetId]/edit/page.tsx",
    );
  });

  it("keeps the linked-customer page identifier-free and on the safe projection", () => {
    const page = readFileSync(
      join(process.cwd(), "src/app/(application)/app/my-properties/page.tsx"),
      "utf8",
    );

    expect(page).toContain("requireSelfCrmPageContext()");
    expect(page).toContain("service.listMyCustomers(actor)");
    expect(page).toContain("loadLinkedCustomerFromSummary(service, actor");
    expect(page).toContain("CustomerSelfServiceCard");
    expect(page).not.toMatch(/params|searchParams|customerId|StaffCustomerDetail|internalNotes/);

    const helper = source("_lib/crm-page.ts");
    expect(helper).toContain("service.getMyCustomer(actor");
  });

  it("has a route-local authorization helper that gates before CRM reads", () => {
    const helper = source("_lib/crm-page.ts");

    expect(helper).toContain("requireApplicationPrincipal()");
    expect(helper).toContain("requireStaffCustomerRead(actor)");
    expect(helper).toContain("requireStaffCustomerManagement(actor)");
    expect(helper).toContain("requireCustomerIdentityLinkManagement(actor)");
    expect(helper).toContain("requireCustomerSelfRead(actor)");
    expect(helper).toContain("customerIdSchema.safeParse(await params)");
  });

  it.each([
    "src/app/(application)/app/customers",
    "src/app/(application)/app/my-properties",
  ])("provides localized loading and retryable generic errors for %s", (route) => {
    const loading = readFileSync(join(process.cwd(), route, "loading.tsx"), "utf8");
    const error = readFileSync(join(process.cwd(), route, "error.tsx"), "utf8");

    expect(loading).toContain('lang="bg"');
    expect(loading).toContain('lang="en"');
    expect(loading).toContain('aria-live="polite"');
    expect(error).toContain('lang="bg"');
    expect(error).toContain('lang="en"');
    expect(error).toContain("onClick={reset}");
    expect(error).not.toMatch(/error\.(message|stack|cause)|database|provider/i);
  });
});
