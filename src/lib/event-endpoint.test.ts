import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { BINDING, handleEvent, type EventSink } from "./event-endpoint";
import { encodeEvent } from "./events";
import { DATASET } from "./stats";

const ORIGIN = "https://valwidgets.live";

function post(body: string, headers: Record<string, string> = { origin: ORIGIN }) {
  return new Request(`${ORIGIN}/api/e`, { method: "POST", body, headers });
}

const sink = () => ({ writeDataPoint: vi.fn() }) satisfies EventSink;

describe("the event endpoint", () => {
  it("counts a valid event from this site and answers 204 with nothing in it", async () => {
    const s = sink();
    const response = await handleEvent(post(encodeEvent("visit", "overlay", "reddit")), s);
    expect(response.status).toBe(204);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-counted")).toBe("yes");
    expect(await response.text()).toBe("");
    expect(s.writeDataPoint).toHaveBeenCalledTimes(1);
    expect(s.writeDataPoint).toHaveBeenCalledWith({ indexes: ["visit"], blobs: ["visit", "overlay", "reddit"], doubles: [1] });
  });

  it("writes nothing but the event and its labels", async () => {
    const s = sink();
    const request = new Request(`${ORIGIN}/api/e?id=ainz%23und3d#k=HDEV-secret`, {
      method: "POST",
      body: encodeEvent("link_copied", "valorant-rank"),
      headers: { origin: ORIGIN, "user-agent": "Mozilla/5.0", referer: `${ORIGIN}/?id=ainz`, "x-forwarded-for": "203.0.113.9", cookie: "a=b" },
    });
    await handleEvent(request, s);
    const written = JSON.stringify(s.writeDataPoint.mock.calls);
    expect(written).toBe(JSON.stringify([[{ indexes: ["link_copied"], blobs: ["link_copied", "valorant-rank", ""], doubles: [1] }]]));
    for (const leak of ["ainz", "HDEV", "203.0.113.9", "Mozilla", "a=b"]) expect(written).not.toContain(leak);
  });

  it("checks the event and drops it where there is no Cloudflare binding", async () => {
    const dropped = await handleEvent(post(encodeEvent("theme_picked", "paper")), null);
    expect(dropped.status).toBe(204);
    expect(dropped.headers.get("x-counted")).toBe("no"); // so a deploy check can tell "wired up" from "dropped"
    const refused = await handleEvent(post('{"e":"theme_picked","a":"neon"}'), null);
    expect(refused.status).toBe(400);
    expect(refused.headers.get("x-counted")).toBeNull();
  });

  it("answers 204 even if the counter itself fails", async () => {
    const broken = {
      writeDataPoint: () => {
        throw new Error("down");
      },
    };
    const response = await handleEvent(post(encodeEvent("visit", "rank", "direct")), broken);
    expect(response.status).toBe(204);
    expect(response.headers.get("x-counted")).toBe("no");
  });

  it("refuses anything that isn't exactly one allowed event, and stores nothing", async () => {
    const s = sink();
    for (const body of ["", "hello", '{"e":"visit"}', '{"e":"visit","a":"overlay","b":"direct","id":"ainz#und3d"}', '{"e":"purchase","a":"x"}']) {
      expect((await handleEvent(post(body), s)).status).toBe(400);
    }
    expect(s.writeDataPoint).not.toHaveBeenCalled();
  });

  it("refuses a post that doesn't come from this site's own pages", async () => {
    const s = sink();
    const body = encodeEvent("visit", "overlay", "direct");
    expect((await handleEvent(post(body, {}), s)).status).toBe(403);
    expect((await handleEvent(post(body, { origin: "https://evil.example" }), s)).status).toBe(403);
    expect((await handleEvent(post(body, { origin: "not an origin" }), s)).status).toBe(403);
    expect(s.writeDataPoint).not.toHaveBeenCalled();
  });

  it("answers any other method with 405", async () => {
    const response = await handleEvent(new Request(`${ORIGIN}/api/e`, { method: "GET", headers: { origin: ORIGIN } }), sink());
    expect(response.status).toBe(405);
  });

  it("refuses a body that is far bigger than any event", async () => {
    const s = sink();
    expect((await handleEvent(post(encodeEvent("visit", "overlay", "direct") + " ".repeat(1000)), s)).status).toBe(413);
    expect(s.writeDataPoint).not.toHaveBeenCalled();
  });
});

describe("the Cloudflare configuration", () => {
  const config = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  const parsed = JSON.parse(config.replace(/^\s*\/\/.*$/gm, "")) as { analytics_engine_datasets?: Array<{ binding: string; dataset: string }> };

  // The binding is left out until Analytics Engine has been enabled for the account (see wrangler.jsonc); when it is there, it
  // has to be the one the endpoint writes to and the stats report reads from.
  it("binds the counter the endpoint writes to, to the dataset the stats report reads, whenever it is bound at all", () => {
    if (parsed.analytics_engine_datasets !== undefined) {
      expect(parsed.analytics_engine_datasets).toEqual([{ binding: BINDING, dataset: DATASET }]);
    }
  });

  it("keeps the line that turns counting on, ready to paste back", () => {
    expect(config).toContain(`"analytics_engine_datasets": [{ "binding": "${BINDING}", "dataset": "${DATASET}" }]`);
  });
});
