// The site's public address, read the way people actually type it. `NEXT_PUBLIC_SITE_URL=localhost:3000` or a bare
// `tally.example` is an easy thing to write in an .env file, and handing either to `new URL()` throws "Invalid URL" on
// every page that builds its canonical link. So: add the scheme if it's missing, keep only the origin, and fall back to
// localhost, with the reason, rather than crash.

export const DEFAULT_SITE_URL = "http://localhost:3000";

export type SiteAddress = {
  /** An origin with no trailing slash, always safe to give to `new URL(path, url)`. */
  url: string;
  /** Why the configured value couldn't be used, or null. An unset value isn't a problem here; the build says so itself. */
  problem: string | null;
};

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i;
/** localhost, 127.0.0.1, [::1], *.localhost and *.test, with or without a port: addresses that are only ever reached over http in development. */
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|[^/:@\s]+\.localhost|[^/:@\s]+\.test)(:\d+)?([/?#]|$)/i;

function parse(value: string): string | null {
  const withScheme = HAS_SCHEME.test(value) ? value : `${LOCAL.test(value) ? "http" : "https"}://${value}`;
  try {
    const url = new URL(withScheme);
    if ((url.protocol !== "http:" && url.protocol !== "https:") || !url.hostname) return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** An https address from an environment variable, or "" if it is unset or isn't one (a link that opens a form must not be able to be `javascript:`). */
export function secureUrl(value: string | undefined): string {
  const raw = value?.trim();
  if (!raw) return "";
  try {
    const url = new URL(raw);
    return url.protocol === "https:" && url.hostname ? url.toString() : "";
  } catch {
    return "";
  }
}

/**
 * `configured` is NEXT_PUBLIC_SITE_URL. `vercelHost` is VERCEL_PROJECT_PRODUCTION_URL, a bare host name that Vercel sets
 * on its own, used only when nothing was configured.
 */
export function resolveSiteAddress(configured: string | undefined, vercelHost?: string): SiteAddress {
  const value = configured?.trim();
  if (value) {
    const url = parse(value);
    return url ? { url, problem: null } : { url: DEFAULT_SITE_URL, problem: `“${value}” isn’t a web address, so ${DEFAULT_SITE_URL} is being used.` };
  }

  const host = vercelHost?.trim();
  const fromVercel = host ? parse(host) : null;
  return { url: fromVercel ?? DEFAULT_SITE_URL, problem: null };
}
