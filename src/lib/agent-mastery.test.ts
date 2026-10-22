import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAgentMastery, normalizeAgentMasteryDetail, playedAgents } from "./agent-mastery";
import { fetchAgentMastery, fetchAgentMasteryFor, type Lookup } from "./henrik-client";
import { ShapeError } from "./henrik-normalize";

// Shaped like AgentMasteryV1* in https://api.henrikdev.xyz/openapi.json (read 2026-10-22). It is NOT a real response: the schema has no example, and
// which track is the Act Level and which the Lifetime Level is not documented, so the ids and names below are made up.
const JETT = "add6443a-41bd-e414-f6ad-e58d267f4e95";
const ISO = "0e38b510-41a8-5780-5e8f-568b2a4f2d6c";
const account = { name: "Night Owl", tag: "und3d", puuid: "0b3a1c5e-0000-4000-8000-000000000001" };
const ref = (id: string, name: string | null = null) => ({ id, name });

const all = {
  status: 200,
  data: {
    account,
    agents: [
      {
        agent: ref(JETT.toUpperCase(), "Jett"),
        flourish: { short_level: 3, long_level: 1 },
        customization: { background: ref("bg-1"), border: null, clip: null, hype: null },
        modules: null,
        tracks: [
          { id: "track-act", name: "Act", level: 7 },
          { id: "track-life", name: "Lifetime", level: 12 },
          { id: "track-x", name: null, level: null },
        ],
      },
      {
        agent: ref(ISO, null),
        flourish: {},
        customization: {},
        tracks: [{ id: "track-act", level: 0 }],
      },
      { agent: { name: "No id" }, tracks: [] }, // unusable: left out
      "junk",
    ],
  },
};

describe("normalizeAgentMastery", () => {
  it("keeps every usable agent, with its tracks and flourish levels, and lower-cases the agent id", () => {
    const result = normalizeAgentMastery(all);
    expect(result.account).toEqual(account);
    expect(result.agents).toHaveLength(2);
    expect(result.agents[0]).toEqual({
      agentId: JETT,
      agentName: "Jett",
      tracks: [
        { id: "track-act", name: "Act", level: 7 },
        { id: "track-life", name: "Lifetime", level: 12 },
        { id: "track-x", name: null, level: null },
      ],
      flourish: { short: 3, long: 1 },
      modules: null,
    });
  });

  it("passes unknown names and omitted levels on as null instead of guessing", () => {
    const [, iso] = normalizeAgentMastery(all).agents;
    expect(iso).toMatchObject({ agentId: ISO, agentName: null, flourish: { short: null, long: null }, modules: null });
    expect(iso.tracks).toEqual([{ id: "track-act", name: null, level: 0 }]);
  });

  it("drops tracks with no id and levels that are not numbers", () => {
    const messy = { data: { account, agents: [{ agent: ref(JETT), tracks: [{ level: 4 }, { id: "a", level: "9" }, null, { id: "b", level: -1 }] }] } };
    expect(normalizeAgentMastery(messy).agents[0].tracks).toEqual([{ id: "a", name: null, level: null }, { id: "b", name: null, level: -1 }]);
  });

  it.each([
    ["not an object", "nope"],
    ["no data", { status: 200 }],
    ["no list of agents", { data: { account } }],
    ["no account", { data: { agents: [] } }],
    ["an account with no puuid", { data: { account: { name: "a", tag: "b" }, agents: [] } }],
  ])("refuses a response with %s", (_label, json) => {
    expect(() => normalizeAgentMastery(json)).toThrow(ShapeError);
  });

  it("accepts an account with no agents at all", () => {
    expect(normalizeAgentMastery({ data: { account, agents: [] } }).agents).toEqual([]);
  });
});

describe("normalizeAgentMasteryDetail", () => {
  const detail = {
    status: 200,
    data: {
      account,
      mastery: {
        agent: ref(JETT, "Jett"),
        flourish: { short_level: 2, long_level: null },
        customization: {},
        tracks: [{ id: "track-act", name: "Act", level: 5 }],
        modules: [
          { id: "m1", name: "Kills", stat: ref("stat-kills", "Kills"), value: 1234 },
          { stat: ref("stat-time"), value: 98.5 },
          { id: "bad", stat: ref("stat-bad"), value: "12" }, // not a number: dropped
          { id: "nostat", value: 3 }, // no stat: dropped
        ],
      },
    },
  };

  it("reads one agent with its stat modules", () => {
    const result = normalizeAgentMasteryDetail(detail);
    expect(result.account.puuid).toBe(account.puuid);
    expect(result.agent.flourish).toEqual({ short: 2, long: null });
    expect(result.agent.modules).toEqual([
      { id: "m1", name: "Kills", statId: "stat-kills", statName: "Kills", value: 1234 },
      { id: null, name: null, statId: "stat-time", statName: null, value: 98.5 },
    ]);
  });

  it("refuses a response without the agent", () => {
    expect(() => normalizeAgentMasteryDetail({ data: { account } })).toThrow(ShapeError);
    expect(() => normalizeAgentMasteryDetail({ data: { account, mastery: { agent: {} } } })).toThrow(ShapeError);
  });
});

describe("playedAgents", () => {
  it("lists the agents with a level above 0, highest first, ties by name", () => {
    const agents = normalizeAgentMastery({
      data: {
        account,
        agents: [
          { agent: ref("a", "Sage"), tracks: [{ id: "t", level: 4 }] },
          { agent: ref("b", "Jett"), tracks: [{ id: "t", level: 4 }, { id: "u", level: 9 }] },
          { agent: ref("c", "Iso"), tracks: [{ id: "t", level: 0 }, { id: "u", level: null }] },
          { agent: ref("d", "Neon"), tracks: [] },
          { agent: ref("e", "Cypher"), tracks: [{ id: "t", level: 4 }] },
        ],
      },
    }).agents;
    expect(playedAgents(agents).map((a) => a.agentName)).toEqual(["Jett", "Cypher", "Sage"]);
  });
});

// ── the lookups ────────────────────────────────────────────────────────────────────────────────────────────────────────

const KEY = "HDEV-00000000-1111-2222-3333-444444444444";
const lookup: Lookup = { region: "ap", platform: "pc", name: "Night Owl", tag: "und3d", key: KEY };
const reply = (status: number, body: unknown, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });

beforeEach(() => vi.unstubAllGlobals());
afterEach(() => vi.unstubAllGlobals());

describe("fetchAgentMastery", () => {
  it("asks nothing without a usable key", async () => {
    const fn = vi.fn();
    vi.stubGlobal("fetch", fn);
    expect(await fetchAgentMastery({ ...lookup, key: "" })).toMatchObject({ ok: false, code: "no_key" });
    expect(await fetchAgentMastery({ ...lookup, key: "nope" })).toMatchObject({ ok: false, code: "bad_key" });
    expect(fn).not.toHaveBeenCalled();
  });

  it("sends the key in the Authorization header to the agent-mastery address, never in the URL", async () => {
    const fn = vi.fn(async () => reply(200, all));
    vi.stubGlobal("fetch", fn);
    const result = await fetchAgentMastery(lookup);
    const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.henrikdev.xyz/valorant/v1/agent-mastery/ap/pc/Night%20Owl/und3d");
    expect((init.headers as Record<string, string>).Authorization).toBe(KEY);
    expect(url).not.toContain(KEY);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.agents).toHaveLength(2);
  });

  it.each([
    [401, "bad_key"],
    [404, "not_found"],
    [400, "bad_request"],
    [500, "upstream"],
  ])("maps HTTP %i to %s (the endpoint is a beta: a 500 is its \"unable to fetch or parse\")", async (status, code) => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(status, { errors: [] })));
    expect(await fetchAgentMastery(lookup)).toMatchObject({ ok: false, code });
  });

  it("passes the rate limit's reset time on", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(429, {}, { "ratelimit-reset": "17" })));
    expect(await fetchAgentMastery(lookup)).toMatchObject({ ok: false, code: "rate_limited", retryAfter: 17 });
  });

  it("calls an unexpected shape what it is", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(200, { data: { account } })));
    expect(await fetchAgentMastery(lookup)).toMatchObject({ ok: false, code: "upstream_shape" });
  });

  it("lets a network failure through, so callers can tell offline apart", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    await expect(fetchAgentMastery(lookup)).rejects.toThrow(TypeError);
  });
});

describe("fetchAgentMasteryFor", () => {
  it("asks for one agent by its id (lower case), and only for a real id", async () => {
    const fn = vi.fn(async () => reply(200, { data: { account, mastery: { agent: ref(JETT, "Jett"), tracks: [{ id: "t", level: 5 }] } } }));
    vi.stubGlobal("fetch", fn);
    const result = await fetchAgentMasteryFor(lookup, JETT.toUpperCase());
    expect((fn.mock.calls[0] as unknown as [string])[0]).toBe(`https://api.henrikdev.xyz/valorant/v1/agent-mastery/ap/pc/Night%20Owl/und3d/${JETT}`);
    expect(result).toMatchObject({ ok: true, agent: { agentId: JETT } });
    expect(await fetchAgentMasteryFor(lookup, "../../x")).toMatchObject({ ok: false, code: "bad_request" });
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("says the agent was not found, or the id unknown, in the same plain words as for the account", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => reply(404, {})));
    expect(await fetchAgentMasteryFor(lookup, JETT)).toMatchObject({ ok: false, code: "not_found" });
    vi.stubGlobal("fetch", vi.fn(async () => reply(400, {})));
    expect(await fetchAgentMasteryFor(lookup, JETT)).toMatchObject({ ok: false, code: "bad_request" });
  });
});
