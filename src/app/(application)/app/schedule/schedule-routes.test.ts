import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app/(application)/app");
const sourceRoot = join(process.cwd(), "src");

function appSource(path: string): string {
  return readFileSync(join(appRoot, path), "utf8");
}

function source(path: string): string {
  return readFileSync(join(sourceRoot, path), "utf8");
}

describe("Phase 3G protected scheduling route boundary", () => {
  it("keeps staff scheduling pages dynamic and freshly authorized", () => {
    for (const page of [
      "schedule/page.tsx",
      "schedule/bookings/[bookingReference]/page.tsx",
    ]) {
      const pageSource = appSource(page);
      expect(pageSource).toContain('dynamic = "force-dynamic"');
      expect(pageSource).toContain("requireSchedulePageContext()");
    }
  });

  it("strictly validates promised query and route selectors", () => {
    const helper = appSource("schedule/_lib/schedule-page.ts");
    expect(helper).toContain("searchParams: Promise<ScheduleSearchParams>");
    expect(helper).toContain(
      "scheduleSearchParamsSchema.safeParse(await searchParams)",
    );
    expect(helper).toContain("params: Promise<ScheduleBookingRouteParams>");
    expect(helper).toContain(
      "scheduleBookingRouteParamsSchema.safeParse(await params)",
    );
    expect(helper).toContain("schedulingBookingReferenceSchema");
    expect(helper).toContain("schedulingDateSchema.optional()");
    expect(helper).toContain(".strict()");
  });

  it("requires the complete read boundary and minimizes client preview data", () => {
    const helper = appSource("schedule/_lib/schedule-page.ts");
    expect(helper).toContain("requireStaffSchedulingRead(actor)");
    expect(helper).toContain("presentBookingSchedulePreview");
    expect(helper).toContain("key: candidate.key");
    const presenter = helper.slice(
      helper.indexOf("export function presentBookingSchedulePreview"),
    );
    expect(presenter).not.toMatch(
      /teamId|equipmentResourceId|operationalStart|operationalEnd|travelBeforeMinutes|travelAfterMinutes|occupiedWorkloadMinutes|occupancyId/,
    );
  });

  it("authenticates, authorizes, and rate limits before parsing allowlisted form fields", () => {
    const action = appSource("schedule/actions.ts");
    const authenticatedAt = action.indexOf("requireAuthenticatedUser()");
    const authorizedAt = action.indexOf("requireStaffSchedulingManage(actor)");
    const limitedAt = action.indexOf("isAuthAttemptAllowed(");
    const parsedAt = action.indexOf('scalar(formData, "bookingReference")');

    expect(action).toContain('"use server"');
    expect(authenticatedAt).toBeGreaterThan(-1);
    expect(authorizedAt).toBeGreaterThan(authenticatedAt);
    expect(limitedAt).toBeGreaterThan(authorizedAt);
    expect(parsedAt).toBeGreaterThan(limitedAt);
    expect(action).toContain("scheduleConfirmationInputSchema.safeParse(input)");
    expect(action).toContain("rejectUnexpectedFields(formData)");
    expect(action).not.toMatch(
      /scalar\(formData, "(?:teamId|equipmentId|serviceStart|serviceEnd|duration|travelMinutes|bufferMinutes|commercialSnapshot|schedulingSnapshot|customerId|propertyId|price)"\)/,
    );
  });

  it("passes each action response object directly to accessible focus feedback", () => {
    const form = source(
      "components/scheduling/schedule-confirmation-form.tsx",
    );
    expect(form).toContain("response={state}");
    expect(form).toContain("<ApplicationActionStatus state={state}");
    expect(form).toContain("<dialog");
    expect(form).toContain("aria-labelledby=");
    expect(form).toContain("aria-describedby=");
  });

  it("reuses row-scoped Job listing with Sofia civil-day bounds for technician today", () => {
    const today = appSource("jobs/today/page.tsx");
    const jobs = appSource("jobs/page.tsx");
    expect(today).toContain('dynamic = "force-dynamic"');
    expect(today).toContain("requireJobPageContext()");
    expect(today).toContain("requireTechnicianTodayRead(actor)");
    expect(today).toContain("error instanceof SchedulingAuthorizationError");
    expect(today).toContain('redirect("/app?access=denied")');
    expect(today).toContain("sofiaTodayDate()");
    expect(today).toContain("sofiaDayBounds(workDate)");
    expect(today).toContain("createJobPageService().listJobs(actor");
    expect(today).toContain("scheduledFrom: startInclusive");
    expect(today).toContain("scheduledTo: endExclusive");
    expect(today).not.toMatch(/customerId|propertyId|assignedTeamId/);
    expect(jobs).toContain('href="/app/jobs/today"');
    expect(jobs).toContain('today: "Днешни посещения"');
    expect(jobs).toContain('today: "Today\'s visits"');
  });

  it("provides explicit bilingual loading and generic retry states", () => {
    for (const route of ["schedule", "jobs/today"]) {
      const loading = appSource(`${route}/loading.tsx`);
      const error = appSource(`${route}/error.tsx`);
      expect(loading).toContain('lang="bg"');
      expect(loading).toContain('lang="en"');
      expect(loading).toContain('aria-live="polite"');
      expect(error).toContain('lang="bg"');
      expect(error).toContain('lang="en"');
      expect(error).toContain("onClick={reset}");
      expect(error).not.toMatch(
        /error\.(?:message|stack|cause)|database|provider|constraint/i,
      );
    }
  });

  it("formats every affected Booking and Job date explicitly in Europe/Sofia", () => {
    for (const path of [
      "components/job-execution/job-cards.tsx",
      "components/job-execution/asset-history.tsx",
      "app/(application)/app/bookings/page.tsx",
      "app/(application)/app/bookings/[bookingReference]/page.tsx",
      "app/(application)/app/my-bookings/page.tsx",
      "app/(application)/app/my-bookings/[bookingReference]/page.tsx",
    ]) {
      expect(source(path)).toContain('timeZone: "Europe/Sofia"');
    }
  });

  it("keeps the customer appointment projection free of dispatch internals", () => {
    const customerDetail = appSource(
      "my-bookings/[bookingReference]/page.tsx",
    );
    expect(customerDetail).toContain("loadCustomerBookingOrNotFound");
    expect(customerDetail).not.toMatch(
      /travelMinutes|bufferMinutes|team workload|equipmentResource|candidateKey|operationalStart|operationalEnd/,
    );
  });

  it("adds a compact day/list surface without out-of-scope finance or notification work", () => {
    const implementation = [
      appSource("schedule/page.tsx"),
      appSource("schedule/bookings/[bookingReference]/page.tsx"),
      appSource("schedule/actions.ts"),
      appSource("jobs/today/page.tsx"),
      source("components/scheduling/dispatch-board.tsx"),
      source("components/scheduling/schedule-confirmation-form.tsx"),
    ].join("\n");
    const css = appSource("app.css");

    expect(implementation).toContain('href="/app/schedule"');
    expect(implementation).toContain("schedule-unscheduled-list");
    expect(implementation).toContain("schedule-team-grid");
    expect(css).toContain(".schedule-team-grid");
    expect(css).toContain("@media (max-width: 38rem)");
    expect(implementation).not.toMatch(
      /create(?:Payment|Invoice|Notification)|sendEmail|sendSms|payroll/i,
    );
  });
});
