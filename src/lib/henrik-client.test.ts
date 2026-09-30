import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fail, fetchRank, fetchSnapshot, looksLikeKey, type Lookup } from "./henrik-client";

const KEY = "HDEV-00000000-1111-2222-3333-444444444444";
const lookup: Lookup = { region: "ap", platform: "pc", name: "Night Owl", tag: "und3d", key: KEY };

const mmrBody = {
  status: 200,
  data: {
    account: { name: "Night Owl", tag: "und3d" },
    current: { tier: { id: 19, name: "Diamond 2" }, rr: 67, elo: 1667, last_change: 18 },
    peak: null,
  },
};

const historyBody = {
  status: 200,
  data: {
    history: [
      { date: "2026-09-30T05:10:00.000Z", last_change: 18, match_id: "m1", rr: 67, tier: { id: 19 }, was_derank_protected: false },
    ],
  },
};

type Reply = { status?: number; body?: unknown; headers?: Record<string, string> };

function reply({ status = 200, body = {}, headers = {} }: Reply): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

/** Routes by URL, so the two parallel requests can be answered independently. */
function stubFetch(routes: { mmr: Reply | Error; history: Reply | Error }) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    const r = url.includes("/mmr-history/") ? routes.history : routes.mmr;
    if (r instanceof Error) throw r;
    return reply(r);
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("looksLikeKey", () => {
  it("wants HDEV- and no spaces, and leaves the rest to HenrikDev", () => {
    expect(looksLikeKey(KEY)).toBe(true);
    expect(looksLikeKey(`  ${KEY}  `)).toBe(true);
    expect(looksLikeKey("")).toBe(false);
    expect(looksLikeKey("hunter2")).toBe(false);
    expect(looksLikeKey("HDEV-short")).toBe(false);
    expect(looksLikeKey("HDEV-0000 0000-1111-2222-3333-4444")).toBe(false);
  });
});

describe("fetchRank", () => {
  it("asks for nothing when there is no key, or the key is malformed", async () => {
    const fetchMock = stubFetch({ mmr: { body: mmrBody }, history: { body: historyBody } });
    expect(await fetchRank({ ...lookup, key: "" })).toMatchObject({ ok: false, code: "no_key" });
    expect(await fetchRank({ ...lookup, key: "nope" })).toMatchObject({ ok: false, code: "bad_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the key straight to HenrikDev in the Authorization header, and to nobody else", async () => {
    const fetchMock = stubFetch({ mmr: { body: mmrBody }, history: { body: historyBody } });
    await fetchRank(lookup);

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls).toHaveLength(2);
    for (const [url, init] of calls) {
      expect(url.startsWith("https://api.henrikdev.xyz/valorant/")).toBe(true);
      expect((init.headers as Record<string, string>).Authorization).toBe(KEY);
      expect(url).not.toContain(KEY); // the key is a header, never part of a URL
    }
    expect(calls[0][0]).toContain("/valorant/v3/mmr/ap/pc/Night%20Owl/und3d");
    expect(calls[1][0]).toContain("/valorant/v2/mmr-history/ap/pc/Night%20Owl/und3d");
  });

  it("returns rank and history on success", async () => {
    stubFetch({ mmr: { body: mmrBody }, history: { body: historyBody } });
    const result = await fetchRank(lookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.current.tier).toBe("Diamond 2");
    expect(result.history).toHaveLength(1);
    expect(result.partial).toBeUndefined();
  });

  it("still returns current rank when history fails, and says so", async () => {
    stubFetch({ mmr: { body: mmrBody }, history: { status: 500, body: {} } });
    const result = await fetchRank(lookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.partial).toBe(true);
    expect(result.history).toEqual([]);
  });

  it.each([
    [401, "bad_key"],
    [403, "bad_key"],
    [404, "not_found"],
    [400, "bad_request"],
    [500, "upstream"],
    [503, "upstream"],
  ])("maps HTTP %i to %s", async (status, code) => {
    stubFetch({ mmr: { status, body: {} }, history: { body: historyBody } });
    expect(await fetchRank(lookup)).toMatchObject({ ok: false, code });
  });

  it("reads the rate-limit reset so the caller can back off properly", async () => {
    stubFetch({
      mmr: { status: 429, body: {}, headers: { "ratelimit-reset": "17" } },
      history: { status: 429, body: {} },
    });
    expect(await fetchRank(lookup)).toMatchObject({ ok: false, code: "rate_limited", retryAfter: 17 });
  });

  it("reports an unexpected payload as a shape error, not a crash", async () => {
    stubFetch({ mmr: { body: { status: 200, data: {} } }, history: { body: historyBody } });
    expect(await fetchRank(lookup)).toMatchObject({ ok: false, code: "upstream_shape" });
  });

  it("rejects when the network itself fails, so callers can say 'offline'", async () => {
    stubFetch({ mmr: new TypeError("Failed to fetch"), history: new TypeError("Failed to fetch") });
    await expect(fetchRank(lookup)).rejects.toBeInstanceOf(TypeError);
  });

  it("rejects when the caller aborts, so cleanup stays silent", async () => {
    const controller = new AbortController();
    controller.abort();
    stubFetch({
      mmr: new DOMException("aborted", "AbortError"),
      history: new DOMException("aborted", "AbortError"),
    });
    await expect(fetchRank(lookup, controller.signal)).rejects.toBeInstanceOf(DOMException);
  });
});

// Shaped after the v4 matches schema in docs.henrikdev.xyz: metadata, ten players, two teams.
function matchBody(id: string, agent: { id: string; name: string }, won: boolean, minutes = 32) {
  return {
    metadata: { match_id: id, game_length_in_ms: minutes * 60_000, started_at: "2026-09-30T04:00:00.000Z", is_completed: true },
    players: [
      { puuid: "me", name: "Night Owl", tag: "und3d", team_id: "Red", agent },
      { puuid: "them", name: "Someone", tag: "0001", team_id: "Blue", agent: { id: "x", name: "Sage" } },
    ],
    teams: [
      { team_id: "Red", won },
      { team_id: "Blue", won: !won },
    ],
  };
}

const JETT = { id: "jett-id", name: "Jett" };

/** Routes the three snapshot requests by URL. */
function stubSnapshotFetch(routes: { mmr?: Reply; history?: Reply; matches?: Reply | Error }) {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("/v4/matches/")) {
      const r = routes.matches ?? { body: { status: 200, data: [] } };
      if (r instanceof Error) throw r;
      return reply(r);
    }
    if (url.includes("/mmr-history/")) return reply(routes.history ?? { body: historyBody });
    return reply(routes.mmr ?? { body: mmrBody });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

describe("fetchSnapshot", () => {
  it("asks for nothing when there is no key, or the key is malformed", async () => {
    const fetchMock = stubSnapshotFetch({});
    expect(await fetchSnapshot({ ...lookup, key: "" })).toMatchObject({ ok: false, code: "no_key" });
    expect(await fetchSnapshot({ ...lookup, key: "nope" })).toMatchObject({ ok: false, code: "bad_key" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("makes three requests to HenrikDev with the key in a header, never in a URL", async () => {
    const fetchMock = stubSnapshotFetch({});
    await fetchSnapshot(lookup);

    const calls = fetchMock.mock.calls as unknown as Array<[string, RequestInit]>;
    expect(calls).toHaveLength(3);
    for (const [url, init] of calls) {
      expect(url.startsWith("https://api.henrikdev.xyz/valorant/")).toBe(true);
      expect((init.headers as Record<string, string>).Authorization).toBe(KEY);
      expect(url).not.toContain(KEY);
    }
    const urls = calls.map(([url]) => url);
    expect(urls).toContain("https://api.henrikdev.xyz/valorant/v4/matches/ap/pc/Night%20Owl/und3d?mode=competitive&size=10");
  });

  it("builds per-agent numbers from the matches, finding the player by Riot ID when the puuid is missing", async () => {
    stubSnapshotFetch({
      matches: {
        body: { status: 200, data: [matchBody("m1", JETT, true, 30), matchBody("m0", JETT, false, 40)] },
      },
    });
    const result = await fetchSnapshot(lookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.snapshot.agentsAvailable).toBe(true);
    expect(result.snapshot.agents).toHaveLength(1);
    expect(result.snapshot.agents[0]).toMatchObject({ name: "Jett", games: 2, wins: 1, losses: 1, winRate: 50, avgMinutes: 35 });
    // m1 is in the RR history (+18); m0 is not, so only one RR sample exists.
    expect(result.snapshot.agents[0].avgRrWin).toBe(18);
    expect(result.snapshot.agents[0].avgRrLoss).toBeNull();
  });

  it("still returns the rank numbers when the matches request fails, and says there is no agent data", async () => {
    stubSnapshotFetch({ matches: { status: 500, body: {} } });
    const result = await fetchSnapshot(lookup);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.agentsAvailable).toBe(false);
    expect(result.snapshot.agents).toEqual([]);
    expect(result.snapshot.rank.tier).toBe("Diamond 2");
  });

  it("treats a network failure on the matches request the same way", async () => {
    stubSnapshotFetch({ matches: new TypeError("Failed to fetch") });
    const result = await fetchSnapshot(lookup);
    expect(result).toMatchObject({ ok: true, snapshot: { agentsAvailable: false } });
  });

  it("fails on the rank request, not the matches request", async () => {
    stubSnapshotFetch({ mmr: { status: 404, body: {} } });
    expect(await fetchSnapshot(lookup)).toMatchObject({ ok: false, code: "not_found" });
    stubSnapshotFetch({ mmr: { status: 401, body: {} }, matches: { status: 401, body: {} } });
    expect(await fetchSnapshot(lookup)).toMatchObject({ ok: false, code: "bad_key" });
  });

  it("rejects when the caller aborts", async () => {
    const controller = new AbortController();
    controller.abort();
    stubSnapshotFetch({ matches: new DOMException("aborted", "AbortError") });
    const pending = fetchSnapshot(lookup, controller.signal);
    await expect(pending).rejects.toBeDefined();
  });
});

describe("fail", () => {
  it("writes errors as instructions and carries retry hints", () => {
    expect(fail("bad_key").message).toMatch(/rejected that key/i);
    expect(fail("rate_limited", 30)).toMatchObject({ retryAfter: 30 });
    expect(fail("not_found")).not.toHaveProperty("retryAfter");
  });
});
