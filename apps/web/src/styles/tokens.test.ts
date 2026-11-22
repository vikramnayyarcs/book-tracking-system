import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseTokens } from "./parse-tokens.ts";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");
const tokens = parseTokens(css);

function channel(value: number) {
  const s = value / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(hex);
  if (!m) {
    throw new Error(`not a 6-digit hex colour: ${hex}`);
  }
  const n = Number.parseInt(m[1] as string, 16);
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const TEXT = 4.5;
const NON_TEXT = 3;

const pairs: [string, string, number][] = [
  ["--ink", "--surface", TEXT],
  ["--ink", "--surface-raised", TEXT],
  ["--ink", "--surface-sunken", TEXT],
  ["--ink-muted", "--surface", TEXT],
  ["--ink-muted", "--surface-raised", TEXT],
  ["--ink-muted", "--surface-sunken", TEXT],
  ["--accent", "--surface", TEXT],
  ["--accent", "--surface-raised", TEXT],
  ["--accent-ink", "--accent", TEXT],
  ["--accent-subtle-ink", "--accent-subtle", TEXT],
  ["--chrome-ink", "--chrome", TEXT],
  ["--danger", "--surface", TEXT],
  ["--danger-subtle-ink", "--danger-subtle", TEXT],
  ["--border-strong", "--surface", NON_TEXT],
  ["--border-strong", "--surface-raised", NON_TEXT],
  ["--accent", "--surface", NON_TEXT],
  ["--accent", "--surface-raised", NON_TEXT],
  ["--accent", "--surface-sunken", NON_TEXT],
];

describe("design tokens", () => {
  it("defines the same names in light and dark", () => {
    expect(Object.keys(tokens.darkAttribute).toSorted()).toEqual(
      Object.keys(tokens.light).toSorted(),
    );
  });

  it("keeps the media-query dark block identical to the attribute block", () => {
    expect(tokens.darkMedia).toEqual(tokens.darkAttribute);
  });

  it.each([
    ["light", tokens.light],
    ["dark", tokens.darkAttribute],
  ] as const)("every pairing passes WCAG 2.2 AA in %s", (_mode, map) => {
    for (const [fg, bg, min] of pairs) {
      const ratio = contrast(map[fg] as string, map[bg] as string);
      expect(ratio, `${fg} on ${bg}`).toBeGreaterThanOrEqual(min);
    }
  });

  it("uses plain hex colours only", () => {
    for (const map of [tokens.light, tokens.darkAttribute]) {
      for (const value of Object.values(map)) {
        expect(value).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });

  it("has one accent token", () => {
    expect(Object.keys(tokens.light).filter((k) => k === "--accent")).toEqual([
      "--accent",
    ]);
  });
});
