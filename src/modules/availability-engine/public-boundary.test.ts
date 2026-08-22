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

describe("availability public boundary", () => {
  it("does not link the internal lab or provisional team data publicly", () => {
    expect(publicRouteMap.some((route) => route.path.includes("internal"))).toBe(
      false,
    );

    const publicRoots = [
      "src/app/(public)",
      "src/app/(public-en)",
      "src/components/public",
      "src/content/public-site",
      "src/modules/public-request",
    ];
    for (const root of publicRoots) {
      for (const filePath of sourceFilesWithin(path.join(process.cwd(), root))) {
        const source = readFileSync(filePath, "utf8");
        expect(source).not.toMatch(
          /availability-engine|SOFIA_TRAVEL_V1_DRAFT|TEAM_A|TEAM_B/,
        );
      }
    }
  });

  it("marks the availability lab development-only and non-indexed", () => {
    const pageSource = readFileSync(
      path.join(process.cwd(), "src/app/internal/availability-lab/page.tsx"),
      "utf8",
    );
    expect(pageSource).toMatch(/DEVELOPMENT ONLY/);
    expect(pageSource).toMatch(/index:\s*false/);
    expect(pageSource).toMatch(/follow:\s*false/);

    const guardSource = readFileSync(
      path.join(process.cwd(), "src/app/internal/development-only.ts"),
      "utf8",
    );
    expect(guardSource).toMatch(/process\.env\.NODE_ENV !== "development"/);
    expect(guardSource).toMatch(/notFound\(\)/);

    for (const pagePath of [
      "src/app/internal/availability-lab/page.tsx",
      "src/app/internal/pricing-lab/page.tsx",
    ]) {
      expect(readFileSync(path.join(process.cwd(), pagePath), "utf8")).toMatch(
        /requireDevelopmentServer\(\)/,
      );
    }
  });
});
