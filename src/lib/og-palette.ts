// The colours the social cards and icons need, read out of tokens.css and converted to hex (an image renderer
// can't read OKLCH or custom properties). Reading the real file means the cards follow the site's palette
// instead of carrying a second copy of it.

import { oklchToRgb, rgbToHex } from "./color";

const NAMES = ["paper", "paper-4", "rule", "muted", "ink-2", "ink", "accent"] as const;

export type OgColor = (typeof NAMES)[number];
/** "#rrggbb" for each colour. */
export type OgPalette = Record<OgColor, string>;

export function ogPalette(css: string): OgPalette {
  const out = {} as OgPalette;
  for (const name of NAMES) {
    const match = new RegExp(`--color-${name}:\\s*oklch\\(([\\d.]+)%\\s+([\\d.]+)\\s+([\\d.]+)`).exec(css);
    if (!match) throw new Error(`tokens.css has no opaque oklch() value for --color-${name}`);
    out[name] = `#${rgbToHex(oklchToRgb({ l: Number(match[1]) / 100, c: Number(match[2]), h: Number(match[3]) }))}`;
  }
  return out;
}
