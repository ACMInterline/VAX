import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app/(application)/app");

function source(path: string): string {
  return readFileSync(join(appRoot, path), "utf8");
}

describe("Phase 3D protected route boundary", () => {
  it("keeps every request and quote page dynamic and freshly authorized", () => {
    const pages = [
      "requests/page.tsx",
      "requests/new/page.tsx",
      "requests/[requestId]/page.tsx",
      "my-requests/page.tsx",
      "my-requests/new/page.tsx",
      "my-requests/[requestReference]/page.tsx",
      "my-quotes/page.tsx",
      "my-quotes/[quoteReference]/page.tsx",
    ];
    for (const page of pages) {
      const pageSource = source(page);
      expect(pageSource).toContain('dynamic = "force-dynamic"');
      expect(pageSource).toMatch(
        /require(?:Staff|Customer)Request(?:Read|Manage|Update)PageContext\(\)/,
      );
    }
  });

  it("strictly validates promised UUID/reference params and inbox filters", () => {
    const helper = source("requests/_lib/request-page.ts");
    expect(helper).toContain("params: Promise<StaffRequestRouteParams>");
    expect(helper).toContain("params: Promise<CustomerRequestRouteParams>");
    expect(helper).toContain("params: Promise<CustomerQuoteRouteParams>");
    expect(helper).toContain("staffRequestRouteParamsSchema.safeParse(await params)");
    expect(helper).toContain("customerRequestRouteParamsSchema.safeParse(await params)");
    expect(helper).toContain("customerQuoteRouteParamsSchema.safeParse(await params)");
    expect(helper).toContain("staffRequestSearchParamsSchema.safeParse(await searchParams)");
    expect(helper).toContain("submittedFrom: dateOnlySchema.optional()");
    expect(helper).toContain("submittedTo: dateOnlySchema.optional()");
    expect(helper).toContain("24 * 60 * 60 * 1_000");
    expect(helper).toContain(".strict()");
  });

  it("renders all inbox filters without accepting unvalidated query keys", () => {
    const inbox = source("requests/page.tsx");
    for (const name of [
      "search",
      "status",
      "source",
      "resolutionStatus",
      "manualReview",
      "submittedFrom",
      "submittedTo",
    ]) {
      expect(inbox).toContain(`name="${name}"`);
    }
    expect(inbox).toContain("parseStaffRequestSearchParams(searchParams)");
    expect(inbox).toContain('"Референция на заявка"');
    expect(inbox).toContain('"Request reference"');
    expect(inbox).toContain("placeholder={requestReferenceSearchLabel}");
    expect(inbox).not.toContain("content.inbox.search");
  });

  it("uses safe customer projections and never exposes draft or staff-only fields", () => {
    const customerRoutes = [
      source("my-requests/page.tsx"),
      source("my-requests/[requestReference]/page.tsx"),
      source("my-quotes/page.tsx"),
      source("my-quotes/[quoteReference]/page.tsx"),
    ].join("\n");
    expect(customerRoutes).toContain("listMyRequests(actor)");
    expect(customerRoutes).toContain("listMyQuotes(actor)");
    expect(customerRoutes).toContain("loadCustomerQuoteOrNotFound");
    expect(customerRoutes).not.toMatch(
      /staffNotes|actorProfileId|commercialSnapshot|calculationSnapshot|internalNotes/,
    );
    expect(customerRoutes).not.toContain('status === "DRAFT"');
    expect(customerRoutes).toContain("content.self.noAcceptance");
  });

  it("renders only the immutable customer description in customer request detail", () => {
    const detail = source("my-requests/[requestReference]/page.tsx");

    expect(detail).toContain("{content.detail.original}</h2>");
    expect(detail).not.toContain("{content.detail.normalized}</h2>");
    expect(detail).toContain("<strong>{item.customerDescription}</strong>");
    expect(detail).not.toContain("item.normalizedDescription");
  });

  it("gates draft edit and issue controls through the latest-version policy", () => {
    const detail = source("requests/[requestId]/page.tsx");
    expect(detail).toContain("isLatestEditableQuoteDraft");
    expect(detail).toContain("isLatestDraft");
    expect(detail).toContain("updateQuoteDraftAction");
    expect(detail).toContain('mode="update"');
    expect(detail).not.toMatch(/status === "ISSUED"[\s\S]{0,300}updateQuoteDraftAction/);
  });

  it("limits staff provenance mutations and locks an existing linked customer", () => {
    const detail = source("requests/[requestId]/page.tsx");
    expect(detail).toContain('request.status === "IN_REVIEW"');
    expect(detail).toContain('request.status === "NEEDS_REVIEW"');
    expect(detail).toContain("normalizedConditionLevelId");
    expect(detail).toContain("lockedCustomerId={linkedCustomer.id}");
    expect(detail).toContain("selectedPropertyId={request.propertyId}");
    expect(detail).toContain("source_request_version");
    expect(detail).toContain("!hasLatestDraft");
    expect(detail).toContain("isCurrentRequestQuote");
    expect(detail).toContain("canUpdateLatestDraft");
    expect(detail).toContain("latestEstimateAllowsQuote");
  });

  it("offers estimates only in review/ready states and fails stale draft issue controls closed", () => {
    const detail = source("requests/[requestId]/page.tsx");
    expect(detail).toMatch(
      /request\.status === "IN_REVIEW"[\s\S]{0,200}request\.status === "NEEDS_REVIEW"[\s\S]{0,200}request\.status === "READY_TO_QUOTE"[\s\S]{0,200}request\.status === "QUOTED"[\s\S]{0,200}<EstimateCreationForm/,
    );
    expect(detail).toContain("isLatestDraft && isCurrentRequestQuote");
    expect(detail).toContain("older request version");
    expect(detail).not.toContain("estimateId={latestEstimateId}");
    expect(detail).toContain("manualOverrideReason");
  });

  it.each(["requests", "my-requests", "my-quotes"])(
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
      expect(error).not.toMatch(/error\.(?:message|stack|cause)|database|provider/i);
    },
  );
});
