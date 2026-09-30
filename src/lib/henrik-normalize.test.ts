import { describe, expect, it } from "vitest";
import { normalizeHistory, normalizeMmr, parseWhen, ShapeError } from "./henrik-normalize";

// Shaped after the v3 MMR and v2 MMR-history schemas in docs.henrikdev.xyz.
const mmr = {
  status: 200,
  data: {
    account: { name: "ainz", tag: "und3d", puuid: "p" },
    current: {
      tier: { id: 19, name: "Diamond 2" },
      rr: 67,
      elo: 1667,
      last_change: 18,
      games_needed_for_rating: 0,
      rank_protection_shields: 1,
      leaderboard_placement: null,
    },
    peak: { season: { id: "s", short: "e9a1" }, tier: { id: 22, name: "Ascendant 2" }, rr: 20, ranking_schema: "x" },
    seasonal: [],
  },
};

const history = {
  status: 200,
  data: {
    account: { name: "ainz", tag: "und3d", puuid: "p" },
    history: [
      {
        date: "2026-09-30T05:10:00.000Z",
        elo: 1667,
        last_change: 18,
        map: { id: "m", name: "Ascent" },
        match_id: "m1",
        refunded_rr: 0,
        rr: 67,
        season: { id: "s", short: "e9a1" },
        tier: { id: 19, name: "Diamond 2" },
        was_derank_protected: false,
      },
      {
        date: "2026-09-30T04:30:00.000Z",
        elo: 1649,
        last_change: 0,
        map: { id: "m", name: "Lotus" },
        match_id: "m0",
        refunded_rr: 0,
        rr: 49,
        season: { id: "s", short: "e9a1" },
        tier: { id: 19, name: "Diamond 2" },
        was_derank_protected: true,
      },
    ],
  },
};

const who = { name: "fallback", tag: "0000" };

describe("normalizeMmr", () => {
  it("reads current rank, peak and account", () => {
    const out = normalizeMmr(mmr, who);
    expect(out.account).toEqual({ name: "ainz", tag: "und3d", puuid: "p" });
    expect(out.current).toEqual({
      tierId: 19,
      tier: "Diamond 2",
      rr: 67,
      elo: 1667,
      lastChange: 18,
      gamesNeeded: 0,
      shields: 1,
      leaderboardRank: null,
    });
    expect(out.peak).toEqual({ tierId: 22, tier: "Ascendant 2", season: "e9a1" });
  });

  it("reads a leaderboard placement when there is one", () => {
    const board = structuredClone(mmr);
    (board.data.current as Record<string, unknown>).leaderboard_placement = { rank: 2043, updated_at: "x" };
    expect(normalizeMmr(board, who).current.leaderboardRank).toBe(2043);
  });

  it("copes with no peak, and with a missing account block", () => {
    const bare = structuredClone(mmr) as Record<string, unknown>;
    (bare.data as Record<string, unknown>).peak = null;
    delete (bare.data as Record<string, unknown>).account;
    const out = normalizeMmr(bare, who);
    expect(out.peak).toBeNull();
    expect(out.account).toEqual({ ...who, puuid: null });
  });

  it("falls back to our own tier names when the API omits one", () => {
    const nameless = structuredClone(mmr);
    delete (nameless.data.current.tier as Record<string, unknown>).name;
    expect(normalizeMmr(nameless, who).current.tier).toBe("Diamond 2");
  });

  it.each([
    ["not an object", "nope"],
    ["no data", { status: 200 }],
    ["no current", { data: {} }],
    ["no tier", { data: { current: { rr: 1 } } }],
    ["rr not a number", { data: { current: { tier: { id: 3 }, rr: "67" } } }],
  ])("throws a ShapeError when %s", (_label, payload) => {
    expect(() => normalizeMmr(payload, who)).toThrow(ShapeError);
  });
});

describe("normalizeHistory", () => {
  it("maps entries and the derank-protection flag", () => {
    const out = normalizeHistory(history);
    expect(out).toHaveLength(2);
    expect(out[0]).toEqual({
      id: "m1",
      at: Date.parse("2026-09-30T05:10:00.000Z"),
      change: 18,
      rr: 67,
      tierId: 19,
      protected: false,
    });
    expect(out[1]).toMatchObject({ change: 0, protected: true });
  });

  it("skips malformed entries instead of failing the lookup", () => {
    const messy = {
      data: {
        history: [
          null,
          { match_id: "x", last_change: 5 }, // no date
          { date: "garbage", match_id: "y", last_change: 5 },
          { date: "2026-09-30T05:10:00Z", last_change: 5 }, // no match id
          { date: "2026-09-30T05:10:00Z", match_id: "ok", last_change: 5 },
        ],
      },
    };
    expect(normalizeHistory(messy).map((e) => e.id)).toEqual(["ok"]);
  });

  it("throws a ShapeError when there is no history array", () => {
    expect(() => normalizeHistory({ data: {} })).toThrow(ShapeError);
    expect(() => normalizeHistory(null)).toThrow(ShapeError);
  });
});

describe("parseWhen", () => {
  it("accepts ISO strings, epoch seconds and epoch milliseconds", () => {
    const ms = Date.parse("2026-09-30T05:10:00.000Z");
    expect(parseWhen("2026-09-30T05:10:00.000Z")).toBe(ms);
    expect(parseWhen(ms / 1000)).toBe(ms);
    expect(parseWhen(ms)).toBe(ms);
    expect(parseWhen(String(ms / 1000))).toBe(ms);
    expect(parseWhen("not a date")).toBeNull();
    expect(parseWhen(undefined)).toBeNull();
  });
});
