import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appRoot = join(process.cwd(), "src/app/(application)/app");

function route(path: string): string {
  return readFileSync(join(appRoot, path), "utf8");
}

describe("Phase 3I protected communication route boundary", () => {
  it("keeps staff and customer pages dynamic and freshly authorized", () => {
    for (const [path, context] of [
      ["communications/page.tsx", "requireStaffCommunicationsPageContext"],
      ["communications/[communicationReference]/page.tsx", "requireStaffCommunicationsPageContext"],
      ["my-communications/page.tsx", "requireCustomerCommunicationsPageContext"],
      ["my-documents/[documentReference]/page.tsx", "requireCustomerCommunicationsPageContext"],
    ] as const) {
      const source = route(path);
      expect(source).toContain('dynamic = "force-dynamic"');
      expect(source).toContain(`${context}()`);
    }
  });

  it("strictly validates references and filters before protected reads", () => {
    const helper = route("communications/_lib/communications-page.ts");
    expect(helper).toContain("communicationReferenceSchema");
    expect(helper).toContain("documentReferenceSchema");
    expect(helper).toContain("safeParse(await params)");
    expect(helper).toContain("safeParse(await searchParams)");
    expect(helper).toContain(".strict()");
  });

  it("maps missing and forbidden records to the same not-found boundary", () => {
    const helper = route("communications/_lib/communications-page.ts");
    expect(helper).toContain('error.code === "RECORD_NOT_FOUND_OR_FORBIDDEN"');
    expect(helper).toContain("notFound()");
    expect(helper).not.toMatch(/belongs to another|wrong customer|subject id/i);
  });

  it("keeps customer ownership on an exact active identity link", () => {
    const repository = readFileSync(
      join(process.cwd(), "src/modules/communications-documents/repository.ts"),
      "utf8",
    );
    expect(repository).toContain('"OWN_CUSTOMER_DATA_READ"');
    expect(repository).toContain("exact_link.user_profile_id");
    expect(repository).toContain("exact_link.customer_id");
    expect(repository).toContain("exact_link.active = true");
    expect(repository).toContain("exact_link.revoked_at is null");
    expect(repository).not.toMatch(/email\s*=\s*.*subject|subject.*email\s*=/i);
  });

  it("exposes only finalized locally published documents to customer routes", () => {
    const repository = readFileSync(
      join(process.cwd(), "src/modules/communications-documents/repository.ts"),
      "utf8",
    );
    expect(repository).toContain("document.status in ('FINAL', 'SUPERSEDED')");
    expect(repository).toContain("intent.status = 'DELIVERED_LOCAL'");
    expect(repository).toContain("intent.channel = 'PORTAL'");
    expect(repository).toContain("result.result_code = 'PORTAL_PUBLISHED'");
  });

  it("binds immutable document language to the stored document locale", () => {
    const page = route("my-documents/[documentReference]/page.tsx");
    expect(page).toContain("<ImmutableDocumentView document={document} />");
    expect(page).toContain('lang={document.locale}');
    expect(page).not.toContain("content={content}");
    expect(page).not.toContain("locale={locale}");
  });

  it("keeps database and provider access out of pages and client components", () => {
    const sources = [
      route("communications/page.tsx"),
      route("communications/[communicationReference]/page.tsx"),
      route("my-communications/page.tsx"),
      route("my-documents/[documentReference]/page.tsx"),
      readFileSync(join(process.cwd(), "src/components/communications/forms.tsx"), "utf8"),
      readFileSync(join(process.cwd(), "src/components/communications/read-cards.tsx"), "utf8"),
    ].join("\n");
    expect(sources).not.toMatch(/getDatabase|DATABASE_URL|fetch\(|axios|nodemailer|twilio/i);
    expect(sources).not.toContain("dangerouslySetInnerHTML");
  });

  it.each(["communications", "my-communications", "my-documents"])(
    "provides bilingual accessible loading and generic retry states for %s",
    (name) => {
      const loading = route(`${name}/loading.tsx`);
      const error = route(`${name}/error.tsx`);
      const combinedLoading = name === "communications" ? loading : route("communications/loading.tsx");
      const combinedError = name === "communications" ? error : route("communications/error.tsx");
      expect(combinedLoading).toContain('lang="bg"');
      expect(combinedLoading).toContain('lang="en"');
      expect(combinedLoading).toContain('aria-live="polite"');
      expect(combinedError).toContain('role="alert"');
      expect(combinedError).not.toMatch(/error\.(?:message|stack|cause)|credential|provider/i);
    },
  );
});
