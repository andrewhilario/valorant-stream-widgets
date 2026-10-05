// One place for the product's name and outbound links.

import { resolveSiteAddress, secureUrl } from "@/lib/site-url";

const address = resolveSiteAddress(process.env.NEXT_PUBLIC_SITE_URL, process.env.VERCEL_PROJECT_PRODUCTION_URL);

export const site = {
  name: "Tally",
  tagline: "Free Valorant stream tools",
  description:
    "A free Valorant rank overlay for OBS and TikTok LIVE. Live rank, RR and session stats as a Browser Source. Pick a look, copy one link, no account.",
  /**
   * The public address, used for canonical links, the sitemap and social cards: an origin with no trailing slash.
   * Set NEXT_PUBLIC_SITE_URL once you have a domain (the https:// may be left off). On Vercel the production
   * host is picked up automatically, so previews still get sensible links. A value that isn't an address
   * falls back to localhost instead of crashing the pages; see lib/site-url.ts.
   */
  url: address.url,
} as const;

/**
 * Riot's required wording for a product that uses Valorant data, from its Developer Portal policy:
 * "[Your product] isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games."
 */
export const riotDisclaimer = `${site.name} isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games.`;

/**
 * Pro is only an idea for now. While NEXT_PUBLIC_PRO_INTEREST_URL is set (to an https form that asks what people would
 * pay for), the site shows a quiet "Pro (coming soon)" link to it and counts the clicks. Unset, there is no link.
 */
export const pro = {
  interestUrl: secureUrl(process.env.NEXT_PUBLIC_PRO_INTEREST_URL),
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
