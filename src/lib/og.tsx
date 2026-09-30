// The 1200 × 630 card shown when a page is shared. One layout for every page: brand, the page's headline and a
// line under it, and a small range bar in the corner (the same motif as the calculators' result). It is drawn
// once at build time, not per request.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/config/site";
import { ogPalette } from "./og-palette";

export const OG_SIZE = { width: 1200, height: 630 } as const;

const FONT_DIR = "node_modules/@fontsource/space-grotesk/files";

let loaded: ReturnType<typeof load> | null = null;

async function load() {
  const root = process.cwd();
  const [css, bold, medium] = await Promise.all([
    readFile(join(root, "tokens.css"), "utf8"),
    readFile(join(root, FONT_DIR, "space-grotesk-latin-700-normal.woff")),
    readFile(join(root, FONT_DIR, "space-grotesk-latin-500-normal.woff")),
  ]);
  return { color: ogPalette(css), bold, medium };
}

export async function socialCard({ headline, sub }: { headline: string; sub: string }) {
  const { color, bold, medium } = await (loaded ??= load());

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: color.paper,
          color: color.ink,
          fontFamily: "Space Grotesk",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ width: 22, height: 22, borderRadius: 11, background: color.accent, marginRight: 16 }} />
          <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: -0.7 }}>{site.name}</div>
          <div style={{ fontSize: 28, fontWeight: 500, color: color.muted, marginLeft: 20 }}>{site.tagline}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 86, fontWeight: 700, lineHeight: 1.04, letterSpacing: -2.4, maxWidth: 1040 }}>{headline}</div>
          <div style={{ display: "flex", fontSize: 38, fontWeight: 500, color: color["ink-2"], marginTop: 28 }}>{sub}</div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderTop: `2px solid ${color.rule}`,
            paddingTop: 28,
          }}
        >
          {/* Not "affiliated": the renderer leaves a wide gap after a word with the "ffi" ligature in this font. */}
          <div style={{ display: "flex", fontSize: 26, fontWeight: 500, color: color.muted }}>Independent. Not endorsed by Riot Games.</div>
          <div style={{ display: "flex", position: "relative", width: 360, height: 16, borderRadius: 8, background: color["paper-4"] }}>
            <div style={{ position: "absolute", left: 50, top: 0, width: 220, height: 16, borderRadius: 8, background: color.accent }} />
            <div style={{ position: "absolute", left: 158, top: -6, width: 4, height: 28, borderRadius: 2, background: color.ink }} />
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Space Grotesk", data: bold, weight: 700, style: "normal" },
        { name: "Space Grotesk", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}

/** The 180 × 180 home-screen icon: the favicon's amber dot on the page colour. */
export async function appleIcon() {
  const { color } = await (loaded ??= load());
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: color.paper }}>
        <div style={{ width: 68, height: 68, borderRadius: 34, background: color.accent }} />
      </div>
    ),
    { width: 180, height: 180 },
  );
}
