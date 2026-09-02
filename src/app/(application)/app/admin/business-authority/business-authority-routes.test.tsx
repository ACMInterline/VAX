import { readFile } from "node:fs/promises";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { businessAuthorityDefinitions } from "@/modules/business-authority/registry";
import { authorityCategories } from "@/modules/business-authority/types";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/auth/authorization-service", () => ({
  requireUserPermission: vi.fn(),
}));
vi.mock("@/auth/enforce-rate-limit", () => ({
  isAuthAttemptAllowed: vi.fn(),
}));
vi.mock("@/db/client", () => ({ getDatabase: vi.fn() }));

import {
  AuthorityProposalForm,
  type AuthorityProposalOption,
} from "./authority-proposal-form";
import { AuthorityRecordActions } from "./authority-record-actions";

async function source(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

const options: readonly AuthorityProposalOption[] = businessAuthorityDefinitions
  .slice(0, 2)
  .map((definition) => ({
    key: definition.key,
    category: definition.category,
    label: definition.labelEn,
    description: definition.descriptionEn,
    evidenceClass: definition.evidenceClass,
    allowedValueKinds: definition.allowedValueKinds,
  }));

describe("business-authority protected UI", () => {
  it("keeps the route on the settings-read boundary and users on their narrower boundary", async () => {
    const [areaLayout, indexPage, usersLayout, page, principal] =
      await Promise.all([
        source("src/app/(application)/app/admin/layout.tsx"),
        source("src/app/(application)/app/admin/page.tsx"),
        source("src/app/(application)/app/admin/users/layout.tsx"),
        source("src/app/(application)/app/admin/business-authority/page.tsx"),
        source("src/app/(application)/app/admin/admin-principal.ts"),
      ]);

    expect(areaLayout).toContain("requireAdministrationPrincipal");
    expect(indexPage).toContain("/app/admin/business-authority");
    expect(usersLayout).toContain("requireIdentityAdminPrincipal");
    expect(page).toContain("requireBusinessAuthorityPrincipal");
    expect(principal).toContain('"SYSTEM_SETTINGS_READ"');
    expect(principal).toContain('"USER_ADMIN_READ"');
  });

  it("renders exactly the governed 17-category registry and derived packages", async () => {
    const page = await source(
      "src/app/(application)/app/admin/business-authority/page.tsx",
    );
    expect(authorityCategories).toHaveLength(17);
    expect(page).toContain("authorityCategories.map");
    expect(page).toContain("evaluateProductionReadiness");
    expect(page).toContain('environmentScope: "STAGING"');
    expect(page).toContain('environmentScope: "PRODUCTION"');
    expect(page).toContain("AuthorityPrintButton");
  });

  it("renders bounded governed values and safe evidence without internal notes or provider identities", async () => {
    const [page, presentation] = await Promise.all([
      source("src/app/(application)/app/admin/business-authority/page.tsx"),
      source(
        "src/app/(application)/app/admin/business-authority/authority-record-presentation.tsx",
      ),
    ]);
    expect(page).toContain("AuthorityPackageSummary");
    expect(page).toContain("AuthorityVersionHistory");
    expect(presentation).toContain("authorityValueSchema.safeParse(value)");
    expect(presentation).toContain("record.sourceReference");
    expect(presentation).toContain("record.safeEvidenceSummary");
    expect(presentation).not.toContain("record.internalNotes");
    expect(presentation).not.toContain("record.proposedByProfileId");
    expect(presentation).not.toContain("record.approvedByProfileId");
    expect(presentation).not.toContain("JSON.stringify");
  });

  it("renders every scoped record version and marks the readiness-selected version", async () => {
    const [page, presentation] = await Promise.all([
      source("src/app/(application)/app/admin/business-authority/page.tsx"),
      source(
        "src/app/(application)/app/admin/business-authority/authority-record-presentation.tsx",
      ),
    ]);
    expect(page).toContain("presentationRecords.filter");
    expect(page).toContain("projectAuthorityRecordForPresentation");
    expect(page).not.toContain("latestRecords");
    expect(presentation).toContain("orderedRecords.map");
    expect(presentation).toContain('data-version-role="current"');
    expect(presentation).toContain('data-version-role="latest"');
    expect(presentation).toContain('data-version-role="history"');
  });

  it("provides bilingual accessible privileged forms with bounded fields", () => {
    for (const locale of ["bg", "en"] as const) {
      const proposal = renderToStaticMarkup(
        <AuthorityProposalForm definitions={options} locale={locale} />,
      );
      expect(proposal).toContain("business-authority-proposal-title");
      expect(proposal).toContain(
        'aria-describedby="business-authority-value-help"',
      );
      expect(proposal).toContain('maxLength="16384"');
      expect(proposal).toContain('name="environmentScope"');
      expect(proposal).toContain('value="STAGING"');
      expect(proposal).toContain('value="PRODUCTION"');
      expect(proposal).not.toContain('value="DEVELOPMENT"');
      expect(proposal).not.toContain('name="status"');
      expect(proposal).not.toContain('name="actorProfileId"');
      expect(proposal).not.toContain('name="approvedByProfileId"');
      expect(proposal).toContain(
        locale === "en" ? "Privileged editor" : "Привилегирован редактор",
      );
    }
  });

  it("provides localized loading, empty, and safe error states", async () => {
    const [presentation, loading, error] = await Promise.all([
      source(
        "src/app/(application)/app/admin/business-authority/authority-record-presentation.tsx",
      ),
      source("src/app/(application)/app/admin/business-authority/loading.tsx"),
      source("src/app/(application)/app/admin/business-authority/error.tsx"),
    ]);
    expect(presentation).toContain("copy.noRecord");
    expect(loading).toContain('aria-live="polite"');
    expect(loading).toContain('lang="bg"');
    expect(loading).toContain('lang="en"');
    expect(error).toContain('role="alert"');
    expect(error).not.toContain("error.message");
    expect(error).not.toContain("error.digest");
  });

  it("uses accessible confirmation dialogs and a labelled approval control", () => {
    const html = renderToStaticMarkup(
      <AuthorityRecordActions
        locale="en"
        outstandingAuthorityTypes={["OWNER", "LEGAL"]}
        recordId="20000000-0000-4000-8000-000000000001"
        authorityVersion={2}
        recordVersion={3}
        contentHash={"a".repeat(64)}
        status="UNDER_REVIEW"
      />,
    );
    expect(html).toContain("Record approval");
    expect(html).toContain('name="decisionAuthorityType"');
    expect(html).toContain('name="expectedRecordVersion"');
    expect(html).toContain('name="expectedAuthorityVersion"');
    expect(html).toContain('name="expectedContentHash"');
    expect(html).toContain("Confirm governance action");
    expect(html).toContain("aria-labelledby=");
    expect(html).toContain("aria-describedby=");
  });

  it("keeps authentication, authorization, and rate limiting ahead of parsing", async () => {
    const actions = await source(
      "src/app/(application)/app/admin/business-authority/actions.ts",
    );
    const proposal = actions.slice(
      actions.indexOf("export async function createAuthorityProposalAction"),
      actions.indexOf("export async function transitionAuthorityAction"),
    );
    const transition = actions.slice(
      actions.indexOf("export async function transitionAuthorityAction"),
    );

    for (const body of [proposal, transition]) {
      expect(body.indexOf("await mutationContext()")).toBeGreaterThan(-1);
      expect(body.indexOf("await mutationContext()")).toBeLessThan(
        body.indexOf("exactFields(formData"),
      );
      expect(body.indexOf("exactFields(formData")).toBeLessThan(
        body.indexOf("scalar(formData"),
      );
    }
    expect(actions).toContain(
      'requireUserPermission("SYSTEM_SETTINGS_MANAGE")',
    );
    expect(actions).toContain(
      'isAuthAttemptAllowed("ADMIN_MUTATION", principal.profile.id)',
    );
  });

  it("keeps mutation controls Owner-only and hides them from print output", async () => {
    const [page, css] = await Promise.all([
      source("src/app/(application)/app/admin/business-authority/page.tsx"),
      source("src/app/(application)/app/app.css"),
    ]);
    expect(page).toContain('actor.roles.has("OWNER")');
    expect(page).toContain('actor.permissions.has("SYSTEM_SETTINGS_MANAGE")');
    expect(page).toContain('definition.evidenceClass !== "SYSTEM_VERIFIED"');
    expect(page).toContain("canControl ? (");
    expect(css).toContain("@media print");
    expect(css).toContain(".business-authority-screen-only");
  });
});
