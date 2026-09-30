import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { ogPalette } from "@/lib/og-palette";

// A manifest wants plain colours, so the page colour comes out of tokens.css as hex, like the social cards.
export default function manifest(): MetadataRoute.Manifest {
  const paper = ogPalette(readFileSync(join(process.cwd(), "tokens.css"), "utf8")).paper;
  return {
    name: `${site.name}: ${site.tagline}`,
    short_name: site.name,
    description: site.description,
    start_url: "/",
    display: "browser",
    background_color: paper,
    theme_color: paper,
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
