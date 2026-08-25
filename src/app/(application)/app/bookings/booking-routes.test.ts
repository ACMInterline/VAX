import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app/(application)/app");

function source(path: string): string {
  return readFileSync(join(appRoot, path), "utf8");
}

describe("Phase 3E protected booking route boundary", () => {
  it("keeps every booking page dynamic and freshly authorized", () => {
    for (const page of [
      "my-bookings/page.tsx",
      "my-bookings/[bookingReference]/page.tsx",
      "bookings/page.tsx",
      "bookings/[bookingReference]/page.tsx",
    ]) {
      const pageSource = source(page);
      expect(pageSource).toContain('dynamic = "force-dynamic"');
      expect(pageSource).toMatch(
        /require(?:Customer|Staff)BookingPageContext()/,
      );
    }
  });

  it("strictly validates promised booking references and staff filters", () => {
    const helper = source("bookings/_lib/booking-page.ts");
    expect(helper).toContain("params: Promise<BookingRouteParams>");
    expect(helper).toContain("bookingRouteParamsSchema.safeParse(await params)");
    expect(helper).toContain(
      "staffBookingSearchParamsSchema.safeParse(await searchParams)",
    );
    expect(helper).toContain("bookingReferenceSchema");
    expect(helper).toContain("scheduledFrom: dateOnlySchema.optional()");
    expect(helper).toContain("scheduledTo: dateOnlySchema.optional()");
    expect(helper).toContain(".strict()");
  });

  it("renders all validated staff filters and no browser scheduling mutation", () => {
    const page = source("bookings/page.tsx");
    for (const field of [
      "search",
      "status",
      "schedulingStatus",
      "scheduledFrom",
      "scheduledTo",
    ]) {
      expect(page).toContain(`name="${field}"`);
    }
    expect(page).toContain('method="get"');
    expect(page).not.toMatch(
      /assignTeamAction|scheduleBookingAction|confirmSlotAction/,
    );
  });

  it("keeps customer projections free of staff, provider, and raw-ID fields", () => {
    const customer = [
      source("my-bookings/page.tsx"),
      source("my-bookings/[bookingReference]/page.tsx"),
    ].join("\n");
    expect(customer).toContain("listMyBookings(actor)");
    expect(customer).toContain("loadCustomerBookingOrNotFound");
    expect(customer).not.toMatch(
      /internalNotes|acceptanceNote|actorProfileId|commercialSnapshot|schedulingSnapshot|assignedTeamName|provider|subjectId/,
    );
    expect(customer).not.toContain("booking.id");
  });

  it("separates staff commercial, scheduling, customer-note, and internal-note evidence", () => {
    const detail = source("bookings/[bookingReference]/page.tsx");
    expect(detail).toContain("booking.commercialSnapshot");
    expect(detail).toContain("booking.schedulingSnapshot");
    expect(detail).toContain("booking.customerNotes");
    expect(detail).toContain("booking.internalNotes");
    expect(detail).toContain("<BookingCancellationForm");
    expect(detail).not.toContain("acceptMyQuoteAction");
  });

  it("integrates explicit customer and staff acceptance only through Server Actions", () => {
    const customerQuote = source("my-quotes/[quoteReference]/page.tsx");
    const staffRequest = source("requests/[requestId]/page.tsx");
    const actions = source("bookings/actions.ts");
    expect(customerQuote).toContain("<CustomerQuoteAcceptanceForm");
    expect(customerQuote).toContain("previewMyQuoteAcceptance");
    expect(staffRequest).toContain("<StaffQuoteAcceptanceForm");
    expect(actions).toContain('"use server"');
    expect(actions).toContain("requireAuthenticatedUser()");
    expect(actions.indexOf("requireAuthenticatedUser()")).toBeLessThan(
      actions.indexOf('scalar(formData, "quoteReference")'),
    );
    expect(actions).not.toMatch(/export async function .*GET/);
  });

  it.each(["my-bookings", "bookings"])(
    "provides bilingual accessible loading and generic retry states for %s",
    (route) => {
      const loading = source(`${route}/loading.tsx`);
      const error = source(`${route}/error.tsx`);
      expect(loading).toContain('lang="bg"');
      expect(loading).toContain('lang="en"');
      expect(loading).toContain('aria-live="polite"');
      expect(error).toContain('lang="bg"');
      expect(error).toContain('lang="en"');
      expect(error).toContain("onClick={reset}");
      expect(error).not.toMatch(
        /error\.(?:message|stack|cause)|database|provider/i,
      );
    },
  );

  it("introduces no payments, invoices, jobs, treatment, upload, or notification route", () => {
    const bookingRoutes = [
      source("my-bookings/page.tsx"),
      source("my-bookings/[bookingReference]/page.tsx"),
      source("bookings/page.tsx"),
      source("bookings/[bookingReference]/page.tsx"),
      source("bookings/actions.ts"),
    ].join("\n");
    expect(bookingRoutes).not.toMatch(
      /create(?:Payment|Invoice|Job|Treatment|Upload|Notification)|sendEmail|sendSms/,
    );
  });
});
