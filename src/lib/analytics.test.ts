import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { optedOut } from "./analytics";

/** A fresh copy of the module, so `trackOnce`'s memory doesn't leak from one test into the next. */
async function load() {
  vi.resetModules();
  return import("./analytics");
}

type Stand = { doNotTrack?: string | null; globalPrivacyControl?: boolean; sendBeacon?: (url: string, data?: string) => boolean };

function browser(navigator: Stand = {}) {
  const sendBeacon = vi.fn(() => true);
  const fetch = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })));
  vi.stubGlobal("window", {});
  vi.stubGlobal("navigator", { sendBeacon, ...navigator });
  vi.stubGlobal("fetch", fetch);
  return { sendBeacon, fetch };
}

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("track", () => {
  it("sends the event to this site's own endpoint, and nothing else", async () => {
    const { sendBeacon, fetch } = browser();
    const { track } = await load();
    track("visit", "overlay", "reddit");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    expect(sendBeacon).toHaveBeenCalledWith("/api/e", '{"e":"visit","a":"overlay","b":"reddit"}');
    expect(fetch).not.toHaveBeenCalled();
  });

  it("falls back to a keep-alive POST when the beacon can't be queued", async () => {
    const { fetch } = browser({ sendBeacon: () => false });
    const { track } = await load();
    track("link_copied", "valorant-rank");
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/e");
    expect(init).toMatchObject({ method: "POST", body: '{"e":"link_copied","a":"valorant-rank"}', keepalive: true, credentials: "omit" });
  });

  it.each([
    ["Do Not Track", { doNotTrack: "1" }],
    ["Global Privacy Control", { globalPrivacyControl: true }],
  ])("sends nothing at all when the browser says %s", async (_name, setting) => {
    const { sendBeacon, fetch } = browser(setting);
    const { track } = await load();
    track("visit", "overlay", "direct");
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends nothing for labels the list doesn't allow, and says so while developing", async () => {
    const { sendBeacon, fetch } = browser();
    const { track } = await load();
    track("visit", "overlay", "facebook");
    track("theme_picked", "neon");
    track("link_copied", "ainz#und3d");
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledTimes(3);
  });

  it("never lets a failure out", async () => {
    browser({
      sendBeacon: () => {
        throw new Error("blocked");
      },
    });
    const { track } = await load();
    expect(() => track("visit", "overlay", "direct")).not.toThrow();
  });

  it("does nothing outside a browser", async () => {
    const { sendBeacon, fetch } = browser();
    vi.stubGlobal("window", undefined);
    const { track } = await load();
    track("visit", "overlay", "direct");
    expect(sendBeacon).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("trackOnce", () => {
  it("sends the same event and labels once per page load, and a different one as well", async () => {
    const { sendBeacon } = browser();
    const { trackOnce } = await load();
    trackOnce("overlay_load", "valorant-rank", "live");
    trackOnce("overlay_load", "valorant-rank", "live");
    expect(sendBeacon).toHaveBeenCalledTimes(1);
    trackOnce("overlay_load", "valorant-rank", "demo");
    expect(sendBeacon).toHaveBeenCalledTimes(2);
  });
});

describe("optedOut", () => {
  it("is true for Do Not Track and Global Privacy Control, and only for them", () => {
    expect(optedOut({ doNotTrack: "1" })).toBe(true);
    expect(optedOut({ doNotTrack: "yes" })).toBe(true);
    expect(optedOut({ globalPrivacyControl: true })).toBe(true);
    expect(optedOut({ doNotTrack: "0" })).toBe(false);
    expect(optedOut({ doNotTrack: null })).toBe(false);
    expect(optedOut({})).toBe(false);
  });
});
