import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("documented ATTELIER staging activation order", () => {
  for (const path of [
    "docs/DEVELOPMENT_WORKFLOW.md",
    "docs/DEPLOYMENT_RUNBOOK.md",
  ]) {
    it(`${path} activates reviewed authority before checking retained counts`, () => {
      const source = readFileSync(path, "utf8");
      const sequence = source.match(
        /```text\n(?:(?!```)[\s\S])*?npm run db:migrate:staging(?:(?!```)[\s\S])*?```/,
      )?.[0];
      expect(sequence).toBeDefined();
      const commands = sequence!
        .split("\n")
        .filter((line) => line.startsWith("npm "));
      const security = commands.indexOf("npm run db:verify-security:staging");
      const activation = commands.indexOf(
        "npm run authority:activate:attelier:staging",
      );
      expect(security).toBeGreaterThan(
        commands.indexOf("npm run db:migrate:staging"),
      );
      expect(activation).toBeGreaterThan(security);
      expect(commands.indexOf("npm run db:verify-state:staging")).toBeGreaterThan(
        activation,
      );
      expect(commands).not.toContain("npm run db:rehearse-staging-rebuild");
      expect(source).toContain("not a fresh-database bootstrap");
      expect(source).toContain("unique active Owner");
      expect(source).toContain("separate authorization");
    });
  }
});
