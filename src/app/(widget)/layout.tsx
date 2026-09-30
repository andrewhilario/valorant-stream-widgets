import type { Metadata, Viewport } from "next";
import { Barlow_Semi_Condensed, IBM_Plex_Mono, IBM_Plex_Sans, Space_Grotesk, Teko } from "next/font/google";

// The widget's type sets. None is preloaded: the page only paints the one the
// link asks for, and the browser only fetches files that get used.
const teko = Teko({ subsets: ["latin"], weight: ["500", "600"], display: "swap", variable: "--ff-teko", preload: false });
const barlow = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--ff-barlow",
  preload: false,
});
const space = Space_Grotesk({ subsets: ["latin"], display: "swap", variable: "--ff-space", preload: false });
const plex = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  display: "swap",
  variable: "--ff-plex",
  preload: false,
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["500", "600"],
  display: "swap",
  variable: "--ff-plexmono",
  preload: false,
});

export const metadata: Metadata = {
  title: "Widget",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function WidgetLayout({ children }: { children: React.ReactNode }) {
  const fonts = [teko, barlow, space, plex, plexMono].map((f) => f.variable).join(" ");
  return (
    <html lang="en" className={fonts}>
      <body>{children}</body>
    </html>
  );
}
