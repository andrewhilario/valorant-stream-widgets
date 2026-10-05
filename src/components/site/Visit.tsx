"use client";

import { useEffect } from "react";
import { track } from "@/lib/analytics";
import { pageOf, referrerOf } from "@/lib/visit";

const SEEN = "tally:visit:v1";

/**
 * Counts a visit once per browser tab session: which page it started on, and where it came from in coarse groups
 * (Reddit, TikTok, a search engine, direct). Renders nothing. Never mounted on the widget pages OBS loads.
 */
export function Visit() {
  useEffect(() => {
    try {
      if (window.sessionStorage.getItem(SEEN)) return;
      window.sessionStorage.setItem(SEEN, "1");
    } catch {
      // Storage can be blocked; then every full page load counts as a visit.
    }
    track("visit", pageOf(window.location.pathname), referrerOf(document.referrer, window.location.host));
  }, []);

  return null;
}
