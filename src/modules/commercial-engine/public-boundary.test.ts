import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { publicRouteMap } from "@/content/public-site/routes";

function sourceFilesWithin(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = path.join(directory, entry);
    return statSync(filePath).isDirectory()
      ? sourceFilesWithin(filePath)
      : /\.(?:ts|tsx)$/.test(entry)
        ? [filePath]
        : [];
  });
}

describe("draft commercial-data boundary", () => {
  it("does not expose the internal pricing lab through public navigation data", () => {
    expect(publicRouteMap.some((route) => route.path.includes("internal"))).toBe(
      false,
    );
  });

  it("keeps provisional prices and commercial-engine imports out of public source", () => {
    const projectRoot = process.cwd();
    const publicRoots = [
      "src/app/(public)",
      "src/app/(public-en)",
      "src/components/public",
      "src/content/public-site",
      "src/modules/public-request",
    ];

    for (const root of publicRoots) {
      for (const filePath of sourceFilesWithin(path.join(projectRoot, root))) {
        const source = readFileSync(filePath, "utf8");
        expect(source).not.toMatch(/commercial-engine|SOFIA_RESIDENTIAL_V1_DRAFT/);
        expect(source).not.toMatch(/€\s*(?:49|79)|(?:3\.60|3\.00|2\.60)\s*\/\s*m/i);
      }
    }
  });

  it("marks the local-only lab as non-indexed and development-only", () => {
    const pageSource = readFileSync(
      path.join(process.cwd(), "src/app/internal/pricing-lab/page.tsx"),
      "utf8",
    );

    expect(pageSource).toMatch(/index:\s*false/);
    expect(pageSource).toMatch(/follow:\s*false/);
    expect(pageSource).toMatch(/DEVELOPMENT ONLY/);
  });
});
