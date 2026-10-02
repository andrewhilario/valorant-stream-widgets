import { describe, expect, it } from "vitest";
import { contrast } from "@/lib/color";
import { PRESETS, noteFor, resolveTheme, swatchFor, type PresetId } from "./themes";

const IDS = Object.keys(PRESETS) as PresetId[];

describe("theme swatches (the gallery's miniatures)", () => {
  it.each(IDS)("%s carries every colour the miniature draws, and the traits that shape it", (id) => {
    const { vars, data } = swatchFor(id);
    for (const name of ["--w-surface", "--w-border", "--w-ink", "--w-muted", "--w-track", "--w-accent", "--w-tier", "--w-gain"]) {
      expect(vars[name], name).toMatch(/^rgb\(/);
    }
    expect(data).toEqual({
      corners: PRESETS[id].bundle.corners,
      marks: String(PRESETS[id].bundle.marks),
      progress: PRESETS[id].bundle.progress,
      light: String(PRESETS[id].light),
    });
  });

  it.each(IDS)("%s is drawn fully opaque, whatever opacity the widget defaults to", (id) => {
    expect(swatchFor(id).vars["--w-surface"]).not.toContain("/");
  });

  it("gives every theme its own look, so the cards can be told apart", () => {
    const surfaces = IDS.map((id) => swatchFor(id).vars["--w-surface"]);
    expect(new Set(surfaces).size).toBe(IDS.length);
  });

  it("draws light themes light and dark themes dark", () => {
    for (const id of IDS) expect(PRESETS[id].surface.l > 0.5, id).toBe(PRESETS[id].light);
  });

  it.each(IDS)("%s keeps its text bars readable on its own panel", (id) => {
    const theme = resolveTheme({ preset: id, accent: "", opacity: 100, signals: "standard" });
    const ink = theme.vars["--w-ink"].match(/\d+/g)!.slice(0, 3).map(Number) as [number, number, number];
    expect(contrast(ink, theme.surface)).toBeGreaterThanOrEqual(4.5);
  });
});

describe("theme notes", () => {
  it("say light or dark, and how the corners are cut, in the corners control's own words", () => {
    expect(noteFor("tactical")).toBe("Dark · Chamfer");
    expect(noteFor("clean")).toBe("Dark · Round");
    expect(noteFor("paper")).toBe("Light · Sharp");
  });
});

describe("resolveTheme", () => {
  it("adds the translucent glows the reactions use, and leaves the panel's own colours alone", () => {
    const theme = resolveTheme({ preset: "tactical", accent: "", opacity: 90, signals: "standard" });
    expect(theme.vars["--w-gain-glow"]).toMatch(/\/ 0\.34\)$/);
    expect(theme.vars["--w-loss-glow"]).toMatch(/\/ 0\.3\)$/);
    expect(theme.vars["--w-surface"]).toMatch(/\/ 0\.9\)$/);
  });

  it("follows the colour-blind-safe pair into the glows", () => {
    const standard = resolveTheme({ preset: "tactical", accent: "", opacity: 90, signals: "standard" });
    const safe = resolveTheme({ preset: "tactical", accent: "", opacity: 90, signals: "safe" });
    expect(safe.vars["--w-gain-glow"]).not.toBe(standard.vars["--w-gain-glow"]);
    expect(safe.vars["--w-loss-glow"]).not.toBe(standard.vars["--w-loss-glow"]);
  });

  it("still keeps a chosen accent visible against the panel", () => {
    const theme = resolveTheme({ preset: "paper", accent: "ffffff", opacity: 100, signals: "standard" });
    expect(contrast(theme.accent, theme.surface)).toBeGreaterThanOrEqual(3);
  });
});
