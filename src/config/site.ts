// One place for the product's name and outbound links.

export const site = {
  name: "Tally",
  tagline: "Free Valorant stream tools",
  description:
    "A free Valorant rank overlay for OBS and TikTok LIVE. Live rank, RR and session stats as a Browser Source. Pick a look, copy one link, no account.",
  /**
   * The public URL, used for canonical links, the sitemap and social cards.
   * Set NEXT_PUBLIC_SITE_URL once you have a domain. On Vercel the production
   * URL is picked up automatically, so previews still get sensible links.
   */
  url:
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000"),
} as const;

/** Buy Me a Coffee. The page link, plus the floating widget's settings. */
export const bmc = {
  handle: "ainzzuu",
  url: process.env.NEXT_PUBLIC_BMC_URL?.trim() || "https://buymeacoffee.com/ainzzuu",
  widget: {
    // NEXT_PUBLIC_BMC_WIDGET=off removes the floating button. See the README: it is third-party
    // JavaScript on a page that holds an API key, which you may not want on a fork.
    enabled: process.env.NEXT_PUBLIC_BMC_WIDGET?.trim().toLowerCase() !== "off",
    description: "Support me on Buy me a coffee!",
    message: "Thank you for your support!",
    // The button colour is yours to pick. It is a third-party control, so it sits outside the site's tokens.
    color: "#BD5FFF",
    position: "Right",
    xMargin: 18,
    yMargin: 18,
    /** On phones the editor's bottom bar is there, so the button sits higher. */
    yMarginPhone: 88,
  },
} as const;

export const supportUrl = bmc.url;
