import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const stylesheet = readFileSync(
  path.join(process.cwd(), "src/styles/public-foundation.css"),
  "utf8",
);
const colors = new Map(
  [...stylesheet.matchAll(/--([a-z-]+):\s*(#[0-9a-f]{6});/gi)].map(
    ([, name, value]) => [name!, value!],
  ),
);

function luminance(token: string): number {
  const hex = colors.get(token);
  if (!hex) throw new Error(`Missing palette token: ${token}`);
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0]! * 0.2126 + channels[1]! * 0.7152 + channels[2]! * 0.0722;
}

describe("ATTELIER text palette accessibility", () => {
  it.each([
    ["ink", "canvas"],
    ["ink", "surface-sage"],
    ["ink-soft", "surface"],
    ["ink-soft", "surface-sage"],
    ["ink-faint", "canvas"],
    ["ink-faint", "surface-sage"],
    ["accent", "canvas"],
    ["warm", "canvas"],
    ["warm", "surface"],
    ["ink-inverse", "surface-deep"],
    ["ink-inverse", "surface-deeper"],
    ["attelier-yellow", "surface-deep"],
  ])("keeps normal %s text on %s at 4.5:1 or better", (foreground, background) => {
    const values = [luminance(foreground), luminance(background)].sort((a, b) => a - b);
    expect((values[1]! + 0.05) / (values[0]! + 0.05)).toBeGreaterThanOrEqual(4.5);
  });

  it("uses inverse colors for the dark price-guide heading and description", () => {
    const components = readFileSync(
      path.join(process.cwd(), "src/styles/public-components.css"),
      "utf8",
    );
    expect(components).toMatch(
      /\.section--deep \.section-heading \.eyebrow\s*\{\s*color: var\(--attelier-yellow\);\s*\}/,
    );
    expect(components).toMatch(
      /\.section--deep \.section-heading p:not\(\.eyebrow\)\s*\{\s*color: var\(--ink-inverse\);\s*\}/,
    );
  });

  it("keeps small footer text opaque on the dark footer", () => {
    const layout = readFileSync(
      path.join(process.cwd(), "src/styles/public-layout.css"),
      "utf8",
    );
    const rule = layout.match(/\.site-footer__bottom p\s*\{([^}]+)\}/)?.[1];
    expect(rule).toContain("color: var(--ink-inverse);");
    expect(rule).not.toMatch(/opacity|rgba/);
  });
});
