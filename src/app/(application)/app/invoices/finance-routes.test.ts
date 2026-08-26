import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app/(application)/app");

function source(path: string): string {
  return readFileSync(join(appRoot, path), "utf8");
}

describe("Phase 3H protected finance route boundary", () => {
  it("keeps every finance page dynamic and freshly authorized", () => {
    for (const [page, context] of [
      ["finance/page.tsx", "requireStaffFinancePageContext"],
      ["invoices/page.tsx", "requireStaffFinancePageContext"],
      ["invoices/[invoiceReference]/page.tsx", "requireStaffFinancePageContext"],
      ["my-invoices/page.tsx", "requireCustomerFinancePageContext"],
      [
        "my-invoices/[invoiceReference]/page.tsx",
        "requireCustomerFinancePageContext",
      ],
    ] as const) {
      const pageSource = source(page);
      expect(pageSource).toContain('dynamic = "force-dynamic"');
      expect(pageSource).toContain(`${context}()`);
    }
  });

  it("strictly validates promised invoice references and staff filters", () => {
    const helper = source("invoices/_lib/finance-page.ts");
    expect(helper).toContain("params: Promise<InvoiceRouteParams>");
    expect(helper).toContain("invoiceRouteParamsSchema.safeParse(await params)");
    expect(helper).toContain(
      "staffInvoiceSearchParamsSchema.safeParse(await searchParams)",
    );
    expect(helper).toContain("invoiceReferenceSchema");
    expect(helper).toContain(".strict()");
  });

  it("uses permission-aware finance service reads backed by the database repository", () => {
    const helper = source("invoices/_lib/finance-page.ts");
    const staff = [
      source("finance/page.tsx"),
      source("invoices/page.tsx"),
      source("invoices/[invoiceReference]/page.tsx"),
    ].join("\n");
    const customer = [
      source("my-invoices/page.tsx"),
      source("my-invoices/[invoiceReference]/page.tsx"),
    ].join("\n");

    expect(helper).toContain("requireStaffFinanceRead");
    expect(helper).toContain("requireCustomerInvoiceRead");
    expect(helper).toContain("createDatabaseFinanceRepository(getDatabase())");
    expect(staff).toMatch(/\.dashboard\(actor\)|\.listInvoices\(|loadStaffInvoiceOrNotFound/);
    expect(customer).toContain("listMyInvoices(actor)");
    expect(customer).toContain("loadCustomerInvoiceOrNotFound");
  });

  it("keeps customer invoice ownership on the active exact-link repository boundary", () => {
    const repository = readFileSync(
      join(
        process.cwd(),
        "src/modules/finance-invoicing/repository.ts",
      ),
      "utf8",
    );
    expect(repository).toContain("customerInvoiceAccessSql");
    expect(repository).toContain('"OWN_CUSTOMER_DATA_READ"');
    expect(repository).toContain("exact_link.user_profile_id");
    expect(repository).toContain("exact_link.customer_id");
    expect(repository).toContain("exact_link.active = true");
    expect(repository).toContain("exact_link.revoked_at is null");
    expect(repository).toContain("linked_customer.status = 'ACTIVE'");
  });

  it("keeps draft and cancelled invoices outside both customer read queries", () => {
    const repository = readFileSync(
      join(
        process.cwd(),
        "src/modules/finance-invoicing/repository.ts",
      ),
      "utf8",
    );
    const customerReads = repository.slice(
      repository.indexOf("export async function listCustomerInvoicesRecord"),
      repository.indexOf("export async function listPaymentsRecord"),
    );
    expect(customerReads.match(/invoice\.status in \('ISSUED', 'PARTIALLY_PAID', 'PAID'\)/g))
      .toHaveLength(2);
    expect(customerReads).not.toMatch(/DRAFT|READY_TO_ISSUE|CANCELLED/);
  });

  it("maps missing and forbidden invoice detail to the same not-found boundary", () => {
    const helper = source("invoices/_lib/finance-page.ts");
    expect(helper).toContain('error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"');
    expect(helper).toContain("notFound()");
    expect(helper).not.toMatch(/record does not exist|belongs to another|wrong customer/i);
  });

  it("keeps customer pages on customer-safe projections without internal fields", () => {
    const customer = [
      source("my-invoices/page.tsx"),
      source("my-invoices/[invoiceReference]/page.tsx"),
    ].join("\n");
    expect(customer).toContain("listMyInvoices(actor)");
    expect(customer).toContain("loadCustomerInvoiceOrNotFound");
    expect(customer).not.toMatch(
      /internalNote|auditTimeline|safeMetadata|commercialSnapshot|provenanceSnapshot|reviewReasonCodes|actorProfileId|subjectId|provider/,
    );
    expect(customer).not.toContain("invoice.id");
  });

  it("renders an accessible printable invoice structure", () => {
    const component = readFileSync(
      join(process.cwd(), "src/components/finance/read-cards.tsx"),
      "utf8",
    );
    const details = [
      source("invoices/[invoiceReference]/page.tsx"),
      source("my-invoices/[invoiceReference]/page.tsx"),
    ].join("\n");
    expect(component).toContain('data-print-document="invoice"');
    expect(component).toContain("<table>");
    expect(component).toContain("<caption>");
    expect(component).toContain('scope="col"');
    expect(component).toContain('scope="row"');
    expect(details).toContain("<PrintQuoteButton");
  });

  it.each(["finance", "invoices", "my-invoices"])(
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
        /error\.(?:message|stack|cause)|database|provider|credential/i,
      );
    },
  );

  it("keeps route authorization and finance persistence server-mediated", () => {
    const routes = [
      source("finance/page.tsx"),
      source("invoices/page.tsx"),
      source("invoices/[invoiceReference]/page.tsx"),
      source("my-invoices/page.tsx"),
      source("my-invoices/[invoiceReference]/page.tsx"),
    ].join("\n");
    expect(routes).not.toMatch(/fetch\(|axios|useEffect|useState|localStorage/);
    expect(routes).not.toMatch(/getDatabase|createDatabaseFinanceRepository/);
    expect(routes).not.toMatch(/name=["']customerId|name=["']grossAmount/);
  });
});
