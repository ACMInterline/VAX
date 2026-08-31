import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const root = process.cwd();

describe("hosted staging deployment configuration", () => {
  it("uses locked Vercel installation and the repository build", async () => {
    const configuration = JSON.parse(
      await readFile(path.join(root, "vercel.json"), "utf8"),
    ) as Record<string, unknown>;

    expect(configuration).toMatchObject({
      framework: "nextjs",
      installCommand: "npm ci",
      buildCommand: "npm run build",
    });
  });

  it("excludes every local environment file and build artifact from uploads", async () => {
    const ignore = await readFile(path.join(root, ".vercelignore"), "utf8");

    expect(ignore).toMatch(/^\.env\*$/m);
    expect(ignore).toMatch(/^\.vercel$/m);
    expect(ignore).toMatch(/^node_modules$/m);
    expect(ignore).toMatch(/^security-reports$/m);
  });

  it("monitors only the fixed staging environment without accepting database or origin input", async () => {
    const workflow = await readFile(
      path.join(root, ".github/workflows/staging-monitor.yml"),
      "utf8",
    );

    expect(workflow).toContain("environment: staging");
    expect(workflow).toContain("STAGING_ORIGIN: ${{ vars.STAGING_ORIGIN }}");
    expect(workflow).toContain("contents: read");
    expect(workflow).toContain("issues: write");
    expect(workflow).toContain(
      "actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd",
    );
    expect(workflow).toContain("target.port ||");
    expect(workflow).not.toMatch(/\n\s+origin:\s*\n/);
    expect(workflow).not.toContain("DATABASE_URL");
    expect(workflow).not.toContain("production");
    expect(workflow).not.toContain("response.text");
  });

  it("normalizes the accepted staging origin before appending probe paths", async () => {
    const workflow = await readFile(
      path.join(root, ".github/workflows/staging-monitor.yml"),
      "utf8",
    );
    const validationScript = workflow.match(
      /node <<'NODE'\n([\s\S]*?)\n\s+NODE/,
    )?.[1];

    expect(validationScript).toBeDefined();

    const temporaryDirectory = await mkdtemp(
      path.join(tmpdir(), "vax-staging-monitor-"),
    );
    const outputPath = path.join(temporaryDirectory, "github-output");

    try {
      const result = spawnSync(process.execPath, ["-e", validationScript!], {
        encoding: "utf8",
        env: {
          ...process.env,
          GITHUB_OUTPUT: outputPath,
          STAGING_ORIGIN:
            "  https://vax-phase3m-staging-preview.vercel.app\t ",
        },
      });

      expect(result.status).toBe(0);
      expect(result.stderr).toBe("");
      expect(await readFile(outputPath, "utf8")).toBe(
        "origin=https://vax-phase3m-staging-preview.vercel.app\n",
      );
      expect(workflow).toContain(
        "PROBE_ORIGIN: ${{ steps.target.outputs.origin }}",
      );
      expect(workflow).toContain('"$PROBE_ORIGIN/api/liveness"');
      expect(workflow).toContain('"$PROBE_ORIGIN/api/readiness"');
      expect(workflow).not.toMatch(/\"\$STAGING_ORIGIN\/api\/(?:liveness|readiness)\"/);
    } finally {
      await rm(temporaryDirectory, { force: true, recursive: true });
    }
  });
});
