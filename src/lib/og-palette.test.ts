import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast, hexToRgb } from "./color";
import { ogPalette } from "./og-palette";

const css = readFileSync(fileURLToPath(new URL("../../tokens.css", import.meta.url)), "utf8");
const palette = ogPalette(css);
const rgb = (hex: string) => hexToRgb(hex)!;

describe("ogPalette", () => {
  it("turns every token into a six-digit hex colour", () => {
    for (const value of Object.values(palette)) expect(value).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("follows tokens.css rather than a copy: the paper is the dark navy and the accent is amber", () => {
    const [pr, pg, pb] = rgb(palette.paper);
    expect(pr + pg + pb).toBeLessThan(150);
    expect(pb).toBeGreaterThan(pr);
    const [ar, ag, ab] = rgb(palette.accent);
    expect(ar).toBeGreaterThan(200);
    expect(ag).toBeGreaterThan(130);
    expect(ab).toBeLessThan(120);
  });

  // The social card puts these on the paper colour, so they have to stay readable at thumbnail size.
  it("keeps the card's text legible on its background", () => {
    expect(contrast(rgb(palette.ink), rgb(palette.paper))).toBeGreaterThanOrEqual(7);
    expect(contrast(rgb(palette["ink-2"]), rgb(palette.paper))).toBeGreaterThanOrEqual(7);
    expect(contrast(rgb(palette.muted), rgb(palette.paper))).toBeGreaterThanOrEqual(4.5);
  });

  it("keeps the range bar's amber band visible against its track", () => {
    expect(contrast(rgb(palette.accent), rgb(palette["paper-4"]))).toBeGreaterThanOrEqual(3);
  });

  it("fails loudly if a token goes missing", () => {
    expect(() => ogPalette(":root { --color-paper: oklch(16% 0.01 255); }")).toThrow(/--color-paper-4/);
  });
});
