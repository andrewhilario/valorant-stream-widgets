import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { contrast, oklchToRgb, type Rgb } from "./color";

// Reads the real tokens.css, so the checks follow the file, not a copy of it.
const css = readFileSync(fileURLToPath(new URL("../../tokens.css", import.meta.url)), "utf8");

function parse(name: string): { rgb: Rgb; l: number; c: number } {
  const match = new RegExp(`--${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)`).exec(css);
  if (!match) throw new Error(`token --${name} not found or not an opaque oklch() value`);
  const [l, c, h] = [Number(match[1]) / 100, Number(match[2]), Number(match[3])];
  return { rgb: oklchToRgb({ l, c, h }), l, c };
}

const rgb = (name: string) => parse(name).rgb;
const ratio = (fg: string, bg: string) => contrast(rgb(fg), rgb(bg));

const SURFACES = ["color-paper", "color-paper-2", "color-paper-3", "color-paper-4"];

describe("site tokens: text", () => {
  it.each(SURFACES)("ink clears 7:1 on %s", (surface) => {
    expect(ratio("color-ink", surface)).toBeGreaterThanOrEqual(7);
  });

  it.each(["color-paper", "color-paper-2", "color-paper-3"])("ink-2 (body copy) clears 7:1 on %s", (surface) => {
    expect(ratio("color-ink-2", surface)).toBeGreaterThanOrEqual(7);
  });

  it.each(SURFACES)("muted (helper text, placeholders) clears 4.5:1 on %s", (surface) => {
    expect(ratio("color-muted", surface)).toBeGreaterThanOrEqual(4.5);
  });

  it.each(["color-paper", "color-paper-2", "color-paper-3"])("error text clears 4.5:1 on %s", (surface) => {
    expect(ratio("color-error", surface)).toBeGreaterThanOrEqual(4.5);
  });

  it("amber step numerals clear 4.5:1 on the page", () => {
    expect(ratio("color-accent", "color-paper")).toBeGreaterThanOrEqual(4.5);
  });
});

describe("site tokens: the primary button", () => {
  it.each(["color-accent", "color-accent-hover", "color-accent-press"])("label (accent-ink) clears 4.5:1 on %s", (fill) => {
    expect(ratio("color-accent-ink", fill)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("site tokens: controls and focus", () => {
  it.each(["color-paper", "color-paper-2", "color-paper-3"])("control edges clear 3:1 on %s", (surface) => {
    expect(ratio("color-edge", surface)).toBeGreaterThanOrEqual(3);
  });

  it.each(SURFACES)("the focus ring clears 3:1 on %s", (surface) => {
    expect(ratio("color-focus", surface)).toBeGreaterThanOrEqual(3);
  });

  it("the ring on the amber button (drawn in ink, in the gap around it) clears 3:1 on the page", () => {
    expect(ratio("color-ink", "color-paper")).toBeGreaterThanOrEqual(3);
  });

  it.each(["color-paper", "color-paper-2"])("status dots and icons (neutral, live) clear 3:1 on %s", (surface) => {
    expect(ratio("color-neutral", surface)).toBeGreaterThanOrEqual(3);
    expect(ratio("color-live", surface)).toBeGreaterThanOrEqual(3);
  });
});

// The calculators' range bar: an amber band on a track, and an ink tick that pokes out above and below it.
describe("site tokens: the range bar", () => {
  it("the amber band clears 3:1 against its track", () => {
    expect(ratio("color-accent", "color-paper-4")).toBeGreaterThanOrEqual(3);
  });

  it("the ink tick clears 3:1 against the panel it sticks out onto", () => {
    expect(ratio("color-ink", "color-paper-2")).toBeGreaterThanOrEqual(3);
  });

  it("the track's edge clears 3:1 against the panel", () => {
    expect(ratio("color-edge", "color-paper-2")).toBeGreaterThanOrEqual(3);
  });
});

describe("site tokens: the palette rules", () => {
  const colours = [...css.matchAll(/--(color-[a-z0-9-]+):\s*oklch\(/g)].map((m) => m[1]).filter((n) => n !== "color-scrim");

  it("has colours to check", () => {
    expect(colours.length).toBeGreaterThan(15);
  });

  it.each(colours)("%s is tinted (no zero-chroma grey) and never pure black or white", (name) => {
    const { c, l } = parse(name);
    expect(c).toBeGreaterThanOrEqual(0.005);
    expect(l).toBeGreaterThan(0);
    expect(l).toBeLessThan(1);
  });

  it("follows the dark recipe: paper 12–18% lightness, ink 92–96%", () => {
    expect(parse("color-paper").l).toBeGreaterThanOrEqual(0.12);
    expect(parse("color-paper").l).toBeLessThanOrEqual(0.18);
    expect(parse("color-ink").l).toBeGreaterThanOrEqual(0.92);
    expect(parse("color-ink").l).toBeLessThanOrEqual(0.96);
  });

  it("raises each surface lighter than the last", () => {
    const ls = SURFACES.map((s) => parse(s).l);
    expect([...ls].sort((a, b) => a - b)).toEqual(ls);
  });

  it("keeps the accent to one hue family (amber, 70–95°)", () => {
    const match = /--color-accent:\s*oklch\([\d.]+%\s+[\d.]+\s+([\d.]+)/.exec(css);
    const hue = Number(match?.[1]);
    expect(hue).toBeGreaterThanOrEqual(70);
    expect(hue).toBeLessThanOrEqual(95);
  });
});
