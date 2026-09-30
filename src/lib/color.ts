// Colour maths. Design tokens are authored in OKLCH, but OBS's embedded
// Chromium can be old enough to ignore oklch() and color-mix(). The widget
// therefore converts its tokens to plain rgb() at runtime and hands them to
// the stylesheet as custom properties.

export type Oklch = { l: number; c: number; h: number };
export type Rgb = [number, number, number];

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

const toSrgb = (linear: number) => {
  const v = clamp01(linear);
  return v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
};

const toLinear = (srgb: number) => (srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4));

/** OKLCH (l 0–1, c ≈ 0–0.37, h degrees) → sRGB 0–255, clipped to gamut. */
export function oklchToRgb({ l, c, h }: Oklch): Rgb {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const L = l_ ** 3;
  const M = m_ ** 3;
  const S = s_ ** 3;

  const r = 4.0767416621 * L - 3.3077115913 * M + 0.2309699292 * S;
  const g = -1.2684380046 * L + 2.6097574011 * M - 0.3413193965 * S;
  const bl = -0.0041960863 * L - 0.7034186147 * M + 1.707614701 * S;

  return [Math.round(toSrgb(r) * 255), Math.round(toSrgb(g) * 255), Math.round(toSrgb(bl) * 255)];
}

/** "rgb(12 34 56 / 0.9)" — space syntax, supported since Chromium 65. */
export function cssRgb(color: Oklch | Rgb, alpha = 1): string {
  const [r, g, b] = Array.isArray(color) ? color : oklchToRgb(color);
  return alpha >= 1 ? `rgb(${r} ${g} ${b})` : `rgb(${r} ${g} ${b} / ${Math.round(alpha * 1000) / 1000})`;
}

export function hexToRgb(hex: string): Rgb | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgbToHex([r, g, b]: Rgb): string {
  return [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** WCAG 2.1 relative luminance. */
export function luminance([r, g, b]: Rgb): number {
  return 0.2126 * toLinear(r / 255) + 0.7152 * toLinear(g / 255) + 0.0722 * toLinear(b / 255);
}

/** WCAG 2.1 contrast ratio, 1–21. */
export function contrast(a: Rgb, b: Rgb): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Blend a translucent foreground over a backdrop (both 0–255). */
export function over(fg: Rgb, alpha: number, bg: Rgb): Rgb {
  return [0, 1, 2].map((i) => Math.round(fg[i] * alpha + bg[i] * (1 - alpha))) as Rgb;
}

/** sRGB 0–255 → OKLCH. */
export function rgbToOklch([r, g, b]: Rgb): Oklch {
  const lr = toLinear(r / 255);
  const lg = toLinear(g / 255);
  const lb = toLinear(b / 255);

  const l = Math.cbrt(0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb);
  const m = Math.cbrt(0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb);
  const s = Math.cbrt(0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb);

  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;

  const c = Math.hypot(a, bb);
  const h = c < 1e-4 ? 0 : ((Math.atan2(bb, a) * 180) / Math.PI + 360) % 360;
  return { l: L, c, h };
}

/**
 * Nudge a colour's lightness until it reaches `min` contrast against `against`.
 * Keeps hue and (as far as the gamut allows) chroma, so a streamer's chosen
 * accent stays recognisably theirs but never disappears into the panel.
 */
export function ensureContrast(color: Rgb, against: Rgb, min: number): Rgb {
  if (contrast(color, against) >= min) return color;
  const lch = rgbToOklch(color);
  const darker = luminance(against) > 0.4;
  let current = color;
  for (let i = 0; i < 60; i++) {
    lch.l = Math.min(1, Math.max(0, lch.l + (darker ? -0.015 : 0.015)));
    current = oklchToRgb(lch);
    if (contrast(current, against) >= min) return current;
  }
  return current;
}
