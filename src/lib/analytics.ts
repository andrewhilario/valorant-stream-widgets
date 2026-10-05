// Anonymous counting, from the browser. What can be counted is in events.ts.
//
// Nothing is stored in the browser and nothing identifies anyone: no cookie, no ID, no address, no Riot ID or key. A count
// is sent to this site's own endpoint (/api/e), never to another host. If the browser sends Do Not Track or Global
// Privacy Control, nothing is sent at all. Counting must never get in the way of a page, so every failure is swallowed.
// This file is on the OBS widget page too, so it stays small: what a visit looks like is in visit.ts.

import { encodeEvent, labelsValid, type EventName } from "./events";

const ENDPOINT = "/api/e";

/** The parts of `navigator` that matter here, so tests can stand in for them. */
type Browser = { doNotTrack?: string | null; globalPrivacyControl?: boolean; sendBeacon?: (url: string, data?: string) => boolean };

/** The visitor's own setting: Do Not Track or Global Privacy Control means nothing is sent. */
export function optedOut(browser: Pick<Browser, "doNotTrack" | "globalPrivacyControl">): boolean {
  return browser.doNotTrack === "1" || browser.doNotTrack === "yes" || browser.globalPrivacyControl === true;
}

function deliver(body: string): void {
  if (navigator.sendBeacon?.(ENDPOINT, body)) return;
  void fetch(ENDPOINT, { method: "POST", body, keepalive: true, credentials: "omit" }).catch(() => undefined);
}

/** Counts one event. Quietly does nothing outside a browser, for a visitor who opted out, or for labels the list doesn't allow. */
export function track(event: EventName, first: string, second = ""): void {
  try {
    if (typeof window === "undefined" || typeof navigator === "undefined") return;
    if (!labelsValid(event, first, second)) {
      if (process.env.NODE_ENV !== "production") console.warn(`Not counted: ${event} doesn't allow "${first}" / "${second}".`);
      return;
    }
    if (optedOut(navigator as Browser)) return;
    deliver(encodeEvent(event, first, second));
  } catch {
    // A counter must never break the page it is counting.
  }
}

const sent = new Set<string>();

/** Like `track`, but at most once per page load for the same event and labels (React may run an effect twice in development). */
export function trackOnce(event: EventName, first: string, second = ""): void {
  const key = `${event}|${first}|${second}`;
  if (sent.has(key)) return;
  sent.add(key);
  track(event, first, second);
}
