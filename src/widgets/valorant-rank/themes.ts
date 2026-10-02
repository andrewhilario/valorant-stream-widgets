// Widget colour data. Authored in OKLCH (the source of truth) and converted to
// rgb() at runtime, so the widget stylesheet only ever reads var(--w-*) and
// works in old OBS browser builds.

import { cssRgb, ensureContrast, hexToRgb, oklchToRgb, type Oklch, type Rgb } from "@/lib/color";
import type { ChoiceSwatch } from "@/lib/schema";
import type { TierFamily } from "@/lib/tiers";

export type PresetId = "tactical" | "clean" | "paper";
export type Corners = "sharp" | "chamfer" | "round";
export type FontSet = "tactical" | "grotesk" | "mono";
export type ProgressColor = "rank" | "accent";
export type Signals = "standard" | "safe";

export type Preset = {
  label: string;
  light: boolean;
  surface: Oklch;
  border: Oklch;
  ink: Oklch;
  muted: Oklch;
  track: Oklch;
  accent: Oklch;
  gain: Oklch;
  loss: Oklch;
  /** Colour-blind-safe pair: blue and orange stay apart where green and red do not. */
  gainSafe: Oklch;
  lossSafe: Oklch;
  /** Applied to the matching controls when the preset is chosen. */
  bundle: { corners: Corners; font: FontSet; marks: boolean; progress: ProgressColor; opacity: number };
};

export const PRESETS: Record<PresetId, Preset> = {
  tactical: {
    label: "Tactical",
    light: false,
    surface: { l: 0.21, c: 0.03, h: 258 },
    border: { l: 0.36, c: 0.03, h: 258 },
    ink: { l: 0.96, c: 0.008, h: 258 },
    muted: { l: 0.74, c: 0.025, h: 258 },
    track: { l: 0.3, c: 0.028, h: 258 },
    accent: { l: 0.66, c: 0.215, h: 22 },
    gain: { l: 0.86, c: 0.19, h: 162 },
    loss: { l: 0.72, c: 0.19, h: 22 },
    gainSafe: { l: 0.8, c: 0.12, h: 235 },
    lossSafe: { l: 0.78, c: 0.15, h: 60 },
    bundle: { corners: "chamfer", font: "tactical", marks: true, progress: "rank", opacity: 90 },
  },
  clean: {
    label: "Clean",
    light: false,
    surface: { l: 0.19, c: 0.012, h: 255 },
    border: { l: 0.32, c: 0.014, h: 255 },
    ink: { l: 0.96, c: 0.006, h: 255 },
    muted: { l: 0.74, c: 0.014, h: 255 },
    track: { l: 0.28, c: 0.014, h: 255 },
    accent: { l: 0.78, c: 0.14, h: 235 },
    gain: { l: 0.86, c: 0.19, h: 162 },
    loss: { l: 0.72, c: 0.19, h: 22 },
    gainSafe: { l: 0.8, c: 0.12, h: 235 },
    lossSafe: { l: 0.78, c: 0.15, h: 60 },
    bundle: { corners: "round", font: "grotesk", marks: false, progress: "accent", opacity: 92 },
  },
  paper: {
    label: "Paper",
    light: true,
    surface: { l: 0.97, c: 0.008, h: 85 },
    border: { l: 0.84, c: 0.02, h: 85 },
    ink: { l: 0.22, c: 0.02, h: 258 },
    muted: { l: 0.46, c: 0.02, h: 258 },
    track: { l: 0.9, c: 0.012, h: 85 },
    accent: { l: 0.56, c: 0.2, h: 27 },
    gain: { l: 0.5, c: 0.15, h: 160 },
    loss: { l: 0.52, c: 0.2, h: 27 },
    gainSafe: { l: 0.48, c: 0.15, h: 250 },
    lossSafe: { l: 0.54, c: 0.15, h: 50 },
    bundle: { corners: "sharp", font: "grotesk", marks: true, progress: "rank", opacity: 96 },
  },
};

/** Progress-bar colour per rank family, tuned for dark panels. Light panels get a darker step. */
export const TIER_COLORS: Record<TierFamily, Oklch> = {
  unrated: { l: 0.7, c: 0.01, h: 255 },
  iron: { l: 0.72, c: 0.012, h: 255 },
  bronze: { l: 0.7, c: 0.1, h: 55 },
  silver: { l: 0.84, c: 0.02, h: 240 },
  gold: { l: 0.84, c: 0.145, h: 92 },
  platinum: { l: 0.78, c: 0.1, h: 195 },
  diamond: { l: 0.74, c: 0.15, h: 305 },
  ascendant: { l: 0.8, c: 0.17, h: 155 },
  immortal: { l: 0.68, c: 0.2, h: 15 },
  radiant: { l: 0.9, c: 0.12, h: 95 },
};

export const ACCENT_SWATCHES: Array<{ value: string; label: string }> = [
  { value: "ff4655", label: "Red" },
  { value: "ff8a3d", label: "Orange" },
  { value: "ffd23f", label: "Yellow" },
  { value: "3ddc97", label: "Mint" },
  { value: "2fd0c8", label: "Teal" },
  { value: "4da3ff", label: "Blue" },
  { value: "8b7bff", label: "Violet" },
  { value: "ff6fb1", label: "Pink" },
  { value: "e8edf5", label: "White" },
];

export type ThemeInput = {
  preset: PresetId;
  /** 6-digit hex without "#", or "" to use the preset's own accent. */
  accent: string;
  /** 0–100 */
  opacity: number;
  signals: Signals;
};

export type ResolvedTheme = {
  vars: Record<string, string>;
  surface: Rgb;
  accent: Rgb;
  light: boolean;
};

/** Everything the stylesheet needs, as custom properties. */
export function resolveTheme({ preset, accent, opacity, signals }: ThemeInput): ResolvedTheme {
  const p = PRESETS[preset];
  const surface = oklchToRgb(p.surface);
  const gain = oklchToRgb(signals === "safe" ? p.gainSafe : p.gain);
  const loss = oklchToRgb(signals === "safe" ? p.lossSafe : p.loss);

  // A streamer's accent is used for fills and marks, never for text. Keep it
  // visible against the panel without changing its character.
  const chosen = accent ? hexToRgb(accent) : null;
  const accentRgb = ensureContrast(chosen ?? oklchToRgb(p.accent), surface, 3);

  return {
    surface,
    accent: accentRgb,
    light: p.light,
    vars: {
      "--w-surface": cssRgb(surface, Math.min(1, Math.max(0, opacity / 100))),
      "--w-border": cssRgb(p.border),
      "--w-ink": cssRgb(p.ink),
      "--w-muted": cssRgb(p.muted),
      "--w-track": cssRgb(p.track),
      "--w-accent": cssRgb(accentRgb),
      "--w-gain": cssRgb(gain),
      "--w-loss": cssRgb(loss),
      "--w-gain-bg": cssRgb(gain, 0.16),
      "--w-loss-bg": cssRgb(loss, 0.16),
      // The soft light a win or a loss throws across the panel (see the reactions in widget.css).
      "--w-gain-glow": cssRgb(gain, 0.34),
      "--w-loss-glow": cssRgb(loss, 0.3),
    },
  };
}

/** Rank-family colour, guaranteed visible on the panel. */
export function tierColor(family: TierFamily, surface: Rgb): string {
  return cssRgb(ensureContrast(oklchToRgb(TIER_COLORS[family]), surface, 3));
}

const CORNER_WORDS: Record<Corners, string> = { sharp: "Sharp", chamfer: "Chamfer", round: "Round" };

/** The line under a theme's name in the gallery: light or dark, and how its corners are cut. */
export function noteFor(id: PresetId): string {
  const p = PRESETS[id];
  return `${p.light ? "Light" : "Dark"} · ${CORNER_WORDS[p.bundle.corners]}`;
}

/**
 * What the theme gallery draws for a preset: its own colours, fully opaque, on a Diamond rank, plus the traits that change
 * the shape of it. The gallery's stylesheet reads these the way widget.css does, so a card is the widget in miniature.
 */
export function swatchFor(id: PresetId): ChoiceSwatch {
  const p = PRESETS[id];
  const theme = resolveTheme({ preset: id, accent: "", opacity: 100, signals: "standard" });
  return {
    vars: { ...theme.vars, "--w-tier": tierColor("diamond", theme.surface) },
    data: { corners: p.bundle.corners, marks: String(p.bundle.marks), progress: p.bundle.progress, light: String(p.light) },
  };
}
