import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app/(application)/app");

function source(relativePath: string): string {
  return readFileSync(join(appRoot, relativePath), "utf8");
}

describe("Phase 3F protected Job routes", () => {
  it("keeps list and detail reads dynamic and freshly authorized", () => {
    const list = source("jobs/page.tsx");
    const detail = source("jobs/[jobReference]/page.tsx");

    for (const page of [list, detail]) {
      expect(page).toContain('export const dynamic = "force-dynamic"');
      expect(page).toContain("requireJobPageContext()");
      expect(page.indexOf("requireJobPageContext()")).toBeLessThan(
        page.indexOf("createJobPageService()"),
      );
    }
    expect(list).toContain("parseJobSearchParams(searchParams)");
    expect(list).toContain(".listJobs(actor, parsed.filters)");
    expect(list).toContain(
      "jobExecutionContent[locale].statuses[status].label",
    );
    expect(detail).toContain("parseJobRouteParams(params)");
    expect(detail).toContain("loadJobOrNotFound(service, actor");
  });

  it("exposes booking creation and exact team assignment only to management authority", () => {
    const list = source("jobs/page.tsx");
    const detail = source("jobs/[jobReference]/page.tsx");

    for (const permission of [
      "FIELD_JOBS_READ",
      "OPERATIONS_MANAGE",
      "SCHEDULE_MANAGE",
    ]) {
      expect(list).toContain(`"${permission}"`);
      expect(detail).toContain(`"${permission}"`);
    }
    expect(list).toContain("CreateJobFromBookingForm");
    expect(list).toContain("createJobFromBookingAction");
    expect(detail).toContain("AssignJobTeamForm");
    expect(detail).toContain("assignJobTeamAction");
    expect(detail).toContain('["PREPARED", "READY"]');
  });

  it("authenticates, authorizes, and rate-limits every mutation before FormData parsing", () => {
    const actions = source("jobs/actions.ts");
    const actionNames = [
      "createJobFromBookingAction",
      "assignJobTeamAction",
      "progressJobAction",
      "recordJobItemInspectionAction",
      "confirmJobItemTreatmentPlanAction",
      "startJobItemTreatmentAction",
      "completeJobItemTreatmentAction",
      "completeJobAction",
      "cancelJobAction",
    ];

    expect(actions).toContain("requireAuthenticatedUser()");
    expect(actions).toContain("requireMutationAuthority(actor, authority)");
    expect(actions).toContain(
      'isAuthAttemptAllowed("JOB_MUTATION", principal.profile.id)',
    );
    for (const actionName of actionNames) {
      const start = actions.indexOf(`export async function ${actionName}`);
      const end = actions.indexOf("\nexport async function", start + 1);
      const body = actions.slice(start, end === -1 ? undefined : end);
      expect(body).toContain("authenticatedMutationContext(");
      expect(body.indexOf("authenticatedMutationContext(")).toBeLessThan(
        body.indexOf("scalar(formData"),
      );
    }
    expect(actions).not.toMatch(
      /scalar\(formData, "(?:actorProfileId|createdAt|updatedAt|assignedAt|startedAt|completedAt)"\)/,
    );
    expect(actions).not.toContain('"materialScopeChange"');
  });

  it("proves the full linked-customer property/asset relationship", () => {
    const page = source(
      "my-properties/[propertyId]/assets/[assetId]/page.tsx",
    );

    expect(page).toContain("requireCustomerPassportPageContext()");
    expect(page).toContain("parsePassportRouteParams(params)");
    expect(page).toContain("crmService.listMyCustomers(actor)");
    expect(page).toContain("loadLinkedCustomerFromSummary(");
    expect(page).toContain("candidate.id === route.propertyId");
    expect(page).toContain("asset.id === route.assetId");
    expect(page.indexOf("if (!property) notFound()")).toBeLessThan(
      page.indexOf("loadCustomerPassportOrNotFound("),
    );
    expect(page).not.toMatch(/internalNotes|price|margin|quoteSnapshot/);
  });

  it("proves customer, property, and asset scope before staff history read", () => {
    const page = source(
      "customers/[customerId]/properties/[propertyId]/assets/[assetId]/page.tsx",
    );

    expect(page).toContain("requireStaffPassportPageContext()");
    expect(page).toContain("parseStaffPassportRouteParams(params)");
    expect(page).toContain("loadStaffPropertyOrNotFound(");
    expect(page).toContain("route.customerId");
    expect(page).toContain("route.propertyId");
    expect(page).toContain("asset.id === route.assetId");
    expect(page.indexOf("loadStaffPropertyOrNotFound(")).toBeLessThan(
      page.indexOf("loadStaffAssetHistoryOrNotFound("),
    );
    expect(page).not.toMatch(/internalTechnicianNotes|immutableSnapshot|price|margin/);
  });

  it("links both protected passports from the existing property views", () => {
    expect(source("my-properties/page.tsx")).toContain(
      "`/app/my-properties/${property.id}/assets/${asset.id}`",
    );
    expect(
      source("customers/[customerId]/properties/[propertyId]/page.tsx"),
    ).toContain(
      "`/app/customers/${customer.id}/properties/${property.id}/assets/${asset.id}`",
    );
  });

  it("strictly validates promised route and filter inputs", () => {
    const helper = source("jobs/_lib/job-page.ts");

    expect(helper).toContain("jobRouteParamsSchema.safeParse(await params)");
    expect(helper).toContain("cleaningPassportRouteSchema.safeParse(await params)");
    expect(helper).toContain("staffPassportRouteSchema.safeParse(await params)");
    expect(helper).toContain("jobSearchParamsSchema.safeParse(await searchParams)");
    expect(helper).toContain(".strict()");
    expect(helper).toContain("value <= 4_167");
  });
});
