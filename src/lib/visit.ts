// What a visit says about itself, in coarse groups: which page it started on and where it came from. Kept apart from
// analytics.ts so the OBS widget page, which only needs to count that it opened, doesn't carry the page list.

import { pageList, type PageMeta } from "@/config/pages";
import type { REFERRERS } from "./events";

type Referrer = (typeof REFERRERS)[number];

/** Which page of the site a path is, by the ids in config/pages.ts. Anything else is "other". */
export function pageOf(pathname: string): PageMeta["id"] | "other" {
  const clean = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return pageList.find((page) => page.path === clean)?.id ?? "other";
}

// The engine's own name, then only a country or generic ending (google.com, google.com.ph, yahoo.co.jp), so
// "google.evil.example" isn't taken for a search.
const SEARCH = /(^|\.)(google|bing|duckduckgo|yahoo|ecosia|yandex|baidu|startpage|qwant)\.(co(m)?\.)?[a-z]{2,3}$/;

/** Where a visit came from, in the coarse groups of events.ts. Only the group is kept; the address never leaves the browser. */
export function referrerOf(referrer: string, ownHost: string): Referrer {
  if (!referrer) return "direct";

  let host: string;
  try {
    host = new URL(referrer).hostname.toLowerCase();
  } catch {
    return "direct";
  }

  const own = ownHost.toLowerCase().replace(/:\d+$/, "");
  const bare = (name: string) => name.replace(/^www\./, "");
  if (bare(host) === bare(own)) return "direct";

  const under = (domain: string) => host === domain || host.endsWith(`.${domain}`);
  if (under("reddit.com") || under("redd.it")) return "reddit";
  if (under("tiktok.com")) return "tiktok";
  if (SEARCH.test(host) || host === "search.brave.com") return "search";
  return "other";
}
