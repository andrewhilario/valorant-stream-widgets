import { describe, expect, it } from "vitest";
import { PRESETS, resolveTheme, type PresetId } from "@/widgets/valorant-rank/themes";
import { contrast, ensureContrast, hexToRgb, oklchToRgb, over, rgbToOklch, type Rgb } from "./color";

describe("oklchToRgb", () => {
  it("maps white and black", () => {
    expect(oklchToRgb({ l: 1, c: 0, h: 0 })).toEqual([255, 255, 255]);
    expect(oklchToRgb({ l: 0, c: 0, h: 0 })).toEqual([0, 0, 0]);
  });

  it("maps the OKLCH red primary to sRGB red", () => {
    const [r, g, b] = oklchToRgb({ l: 0.628, c: 0.2577, h: 29.23 });
    expect(r).toBeGreaterThan(250);
    expect(g).toBeLessThan(8);
    expect(b).toBeLessThan(8);
  });

  it("round-trips through rgbToOklch", () => {
    const start: Rgb = [240, 177, 53];
    const back = oklchToRgb(rgbToOklch(start));
    back.forEach((channel, i) => expect(Math.abs(channel - start[i])).toBeLessThanOrEqual(1));
  });
});

describe("contrast", () => {
  it("is 21:1 for black on white and 1:1 for a colour on itself", () => {
    expect(contrast([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 0);
    expect(contrast([10, 20, 30], [10, 20, 30])).toBeCloseTo(1, 5);
  });
});

describe("ensureContrast", () => {
  const paper = hexToRgb("f7f4ec")!;

  it("leaves a colour alone when it already clears the bar", () => {
    const dark: Rgb = [20, 20, 30];
    expect(ensureContrast(dark, paper, 3)).toEqual(dark);
  });

  it("darkens a pale accent on a light panel until it clears 3:1", () => {
    const yellow = hexToRgb("ffd23f")!;
    expect(contrast(yellow, paper)).toBeLessThan(3);
    expect(contrast(ensureContrast(yellow, paper, 3), paper)).toBeGreaterThanOrEqual(3);
  });

  it("lightens a dark accent on a dark panel", () => {
    const navy = hexToRgb("1a2a6c")!;
    const panel = oklchToRgb(PRESETS.tactical.surface);
    expect(contrast(ensureContrast(navy, panel, 3), panel)).toBeGreaterThanOrEqual(3);
  });
});

describe("widget presets keep their text readable", () => {
  const ids = Object.keys(PRESETS) as PresetId[];

  for (const id of ids) {
    const preset = PRESETS[id];
    const surface = oklchToRgb(preset.surface);
    // Worst case behind a translucent panel: white behind a dark one, black behind a light one.
    const worst: Rgb = preset.light ? [0, 0, 0] : [255, 255, 255];
    const seen = over(surface, preset.bundle.opacity / 100, worst);

    it(`${id}: ink clears 7:1 on the panel`, () => {
      expect(contrast(oklchToRgb(preset.ink), surface)).toBeGreaterThanOrEqual(7);
    });

    it(`${id}: muted, gain and loss clear 4.5:1 on the panel, both colour pairs`, () => {
      for (const colour of [preset.muted, preset.gain, preset.loss, preset.gainSafe, preset.lossSafe]) {
        expect(contrast(oklchToRgb(colour), surface)).toBeGreaterThanOrEqual(4.5);
      }
    });

    it(`${id}: still clears 4.5:1 at its default opacity over the worst backdrop`, () => {
      for (const colour of [preset.ink, preset.muted, preset.gain, preset.loss]) {
        expect(contrast(oklchToRgb(colour), seen)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});

describe("resolveTheme", () => {
  it("produces plain rgb() custom properties, no oklch() or color-mix()", () => {
    const { vars } = resolveTheme({ preset: "tactical", accent: "", opacity: 90, signals: "standard" });
    for (const value of Object.values(vars)) {
      expect(value).toMatch(/^rgb\(/);
      expect(value).not.toMatch(/oklch|color-mix/);
    }
  });

  it("applies panel opacity as alpha on the surface only", () => {
    const { vars } = resolveTheme({ preset: "tactical", accent: "", opacity: 50, signals: "standard" });
    expect(vars["--w-surface"]).toMatch(/\/ 0\.5\)$/);
    expect(vars["--w-ink"]).not.toContain("/");
  });

  it("keeps a chosen accent visible on a light panel", () => {
    const light = resolveTheme({ preset: "paper", accent: "ffd23f", opacity: 100, signals: "standard" });
    expect(contrast(light.accent, light.surface)).toBeGreaterThanOrEqual(3);
  });
});
