import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function sourceFilesWithin(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = path.join(directory, entry);
    return statSync(filePath).isDirectory()
      ? sourceFilesWithin(filePath)
      : /\.(?:ts|tsx)$/.test(entry) && !entry.endsWith(".test.ts")
        ? [filePath]
        : [];
  });
}

describe("public request persistence boundary", () => {
  it("accepts an injected action and delegates submission to React action state", () => {
    const form = readFileSync(
      path.join(process.cwd(), "src/modules/public-request/request-form.tsx"),
      "utf8",
    );

    expect(form).toContain('"use client"');
    expect(form).toContain("useActionState(");
    expect(form).toContain("action={formAction}");
    expect(form).toContain("action: PublicRequestFormAction");
    expect(form).not.toContain("event.preventDefault()");
    expect(form).not.toMatch(/\bfetch\s*\(/);
    expect(form).not.toMatch(/\baxios\b|XMLHttpRequest|navigator\.sendBeacon/);
  });

  it("has no server action, route handler, database, or environment dependency", () => {
    const publicRequestFiles = sourceFilesWithin(
      path.join(process.cwd(), "src/modules/public-request"),
    );

    for (const filePath of publicRequestFiles) {
      const source = readFileSync(filePath, "utf8");
      expect(source).not.toContain('"use server"');
      expect(source).not.toMatch(/@\/db\/|server-only|DATABASE_URL|process\.env/);
      expect(source).not.toMatch(/@\/auth\/|@neondatabase|drizzle-orm/);
      expect(source).not.toMatch(/export\s+async\s+function\s+(?:POST|PUT|PATCH|DELETE)\b/);
    }
  });
});
