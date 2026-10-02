import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER, PHASE_PRODUCTION_BUILD } from "next/constants";

// Mirrors bmc.widget.enabled in src/config/site.ts. (The config can't import from src.)
const bmcWidget = process.env.NEXT_PUBLIC_BMC_WIDGET?.trim().toLowerCase() !== "off";

const policy = (directives: Record<string, string[]>) =>
  Object.entries(directives)
    .map(([name, values]) => [name, ...values].join(" "))
    .join("; ");

// Every host the site talks to, and nothing else. HenrikDev and valorant-api.com are called straight from the
// browser (that is how a streamer's own key stays out of this site's server); valorant-api.com's media host
// serves the rank badges and agent icons. The pages are static, so scripts can't carry a nonce, and the
// documented alternative for that is 'unsafe-inline'. What the policy does add is a short list of places a
// script on the page is allowed to send anything, which is the part that matters for a page that holds a key.
const APIS = ["https://api.henrikdev.xyz", "https://valorant-api.com"];
const IMAGES = ["'self'", "data:", "blob:", "https://media.valorant-api.com"];

const SITE_POLICY = policy({
  "default-src": ["'self'"],
  // Buy Me a Coffee's button is the only third-party script, and it puts its own panel in an iframe.
  "script-src": ["'self'", "'unsafe-inline'", ...(bmcWidget ? ["https://cdnjs.buymeacoffee.com"] : [])],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": [...IMAGES, ...(bmcWidget ? ["https://cdn.buymeacoffee.com"] : [])],
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", ...APIS],
  // The editor previews the real widget page in an iframe on this origin, and the BMC button opens its own panel.
  // That panel starts at www.buymeacoffee.com and is redirected to the bare domain, and each hop is checked.
  "frame-src": ["'self'", ...(bmcWidget ? ["https://buymeacoffee.com", "https://*.buymeacoffee.com"] : [])],
  // Only this origin may frame a page (that preview is the one legitimate case).
  "frame-ancestors": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "object-src": ["'none'"],
});

// The page OBS loads: no third-party script, nothing to frame, nothing to submit.
const WIDGET_POLICY = policy({
  "default-src": ["'self'"],
  "script-src": ["'self'", "'unsafe-inline'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": IMAGES,
  "font-src": ["'self'", "data:"],
  "connect-src": ["'self'", ...APIS],
  "frame-src": ["'none'"],
  "frame-ancestors": ["'self'"],
  "base-uri": ["'none'"],
  "form-action": ["'none'"],
  "object-src": ["'none'"],
});

const COMMON = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  // Only honoured over HTTPS, so it does nothing on http://localhost.
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

export default (phase: string): NextConfig => {
  const dev = phase === PHASE_DEVELOPMENT_SERVER;

  // The config is loaded by several processes during a build; the flag keeps the warning to one.
  if (
    phase === PHASE_PRODUCTION_BUILD &&
    !process.env.NEXT_PUBLIC_SITE_URL &&
    !process.env.VERCEL_PROJECT_PRODUCTION_URL &&
    !process.env.TALLY_SITE_URL_WARNED
  ) {
    process.env.TALLY_SITE_URL_WARNED = "1";
    console.warn(
      "\n⚠  NEXT_PUBLIC_SITE_URL isn't set, so canonical links, the sitemap and social cards will point at http://localhost:3000.\n" +
        "   Set it to your public address (for example https://tally.example) before deploying.\n",
    );
  }

  // A scheme-less value such as "localhost:3000" is fine (the site adds it). One that isn't an address at all falls back to
  // localhost, which is worth saying out loud, in development and in a build.
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && !process.env.TALLY_SITE_URL_BAD_WARNED && !URL.canParse(/^[a-z][a-z0-9+.-]*:\/\//i.test(configured) ? configured : `https://${configured}`)) {
    process.env.TALLY_SITE_URL_BAD_WARNED = "1";
    console.warn(
      `\n⚠  NEXT_PUBLIC_SITE_URL is “${configured}”, which isn't a web address, so http://localhost:3000 is being used instead.\n` +
        "   Use something like https://tally.example (or localhost:3000 while developing).\n",
    );
  }

  return {
    reactStrictMode: true,
    poweredByHeader: false,
    async headers() {
      return [
        {
          // Everything except the widget pages.
          source: "/((?!w/).*)",
          headers: [
            ...COMMON,
            { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
            // The development server needs eval and a websocket for hot reload, which this policy would block.
            ...(dev ? [] : [{ key: "Content-Security-Policy", value: SITE_POLICY }]),
          ],
        },
        {
          // Widget pages are for OBS, not search engines.
          source: "/w/:path*",
          headers: [
            ...COMMON,
            { key: "X-Robots-Tag", value: "noindex, nofollow" },
            { key: "Referrer-Policy", value: "no-referrer" },
            ...(dev ? [] : [{ key: "Content-Security-Policy", value: WIDGET_POLICY }]),
          ],
        },
      ];
    },
  };
};
