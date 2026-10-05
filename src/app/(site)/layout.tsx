import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk } from "next/font/google";
import { BmcWidget } from "@/components/site/BmcWidget";
import { CommandPalette } from "@/components/site/CommandPalette";
import { PaletteProvider } from "@/components/site/PaletteProvider";
import { Visit } from "@/components/site/Visit";
import { site } from "@/config/site";
import "./globals.css";

const display = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--ff-display" });
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  variable: "--ff-body",
});
// One weight, because it is one file on every page. It stays preloaded: the editor's link field is in this face, and
// without the preload it swaps in after first paint and shifts the row (measured: layout shift 0 → 0.04).
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400"], display: "swap", variable: "--ff-mono" });

// Site-wide defaults. Every page sets its own title, description and canonical in its own `metadata`.
export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  applicationName: site.name,
  robots: { index: true, follow: true },
  verification: {
    google: "haR8bjjkeOdupwUr1Z8hhpPS28yHYqjBj3GHhfBfh78",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Matches --color-paper in tokens.css (a meta tag can't read a custom property).
  themeColor: "#0a0f15",
};

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <PaletteProvider>
          {children}
          <CommandPalette />
        </PaletteProvider>
        <BmcWidget />
        <Visit />
      </body>
    </html>
  );
}
