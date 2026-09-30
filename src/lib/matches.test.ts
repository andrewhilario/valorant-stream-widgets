import { describe, expect, it } from "vitest";
import { normalizeMatches } from "./matches";

const JETT = { id: "jett-id", name: "Jett" };
const SAGE = { id: "sage-id", name: "Sage" };

type Overrides = {
  id?: string | null;
  lengthMs?: number | null;
  startedAt?: string | null;
  completed?: boolean;
  me?: Record<string, unknown>;
  teams?: unknown;
};

// Shaped after the v4 matches schema in docs.henrikdev.xyz.
function match(o: Overrides = {}) {
  return {
    metadata: {
      ...(o.id === null ? {} : { match_id: o.id ?? "m1" }),
      ...(o.lengthMs === null ? {} : { game_length_in_ms: o.lengthMs ?? 1_800_000 }),
      ...(o.startedAt === null ? {} : { started_at: o.startedAt ?? "2026-09-30T04:00:00.000Z" }),
      is_completed: o.completed ?? true,
    },
    players: [
      { puuid: "other", name: "Someone", tag: "0001", team_id: "Blue", agent: SAGE },
      { puuid: "me", name: "Night Owl", tag: "und3d", team_id: "Red", agent: JETT, ...o.me },
    ],
    teams: o.teams ?? [
      { team_id: "Red", won: true },
      { team_id: "Blue", won: false },
    ],
  };
}

const me = { name: "Night Owl", tag: "und3d", puuid: "me" };

describe("normalizeMatches", () => {
  it("reads agent, length, start time and result for the player", () => {
    const [m] = normalizeMatches({ data: [match()] }, me);
    expect(m).toEqual({
      id: "m1",
      startedAt: Date.parse("2026-09-30T04:00:00.000Z"),
      lengthMs: 1_800_000,
      agent: JETT,
      won: true,
    });
  });

  it("finds the player by puuid first, even if the name changed", () => {
    const renamed = match({ me: { name: "Brand New", tag: "9999" } });
    expect(normalizeMatches({ data: [renamed] }, me)).toHaveLength(1);
  });

  it("falls back to the Riot ID, ignoring case, when there is no puuid", () => {
    const out = normalizeMatches({ data: [match()] }, { name: "night OWL", tag: "UND3D", puuid: null });
    expect(out).toHaveLength(1);
    expect(out[0].agent.name).toBe("Jett");
  });

  it("reads a loss from the player's own team, not the first team listed", () => {
    const lost = match({
      teams: [
        { team_id: "Blue", won: true },
        { team_id: "Red", won: false },
      ],
    });
    expect(normalizeMatches({ data: [lost] }, me)[0].won).toBe(false);
  });

  it("leaves the result null when the teams block is missing or unreadable", () => {
    expect(normalizeMatches({ data: [{ ...match(), teams: null }] }, me)[0].won).toBeNull();
    expect(normalizeMatches({ data: [match({ teams: [{ team_id: "Red" }] })] }, me)[0].won).toBeNull();
  });

  it("keeps a match with no usable start time, with startedAt null", () => {
    expect(normalizeMatches({ data: [match({ startedAt: "garbage" })] }, me)[0].startedAt).toBeNull();
    expect(normalizeMatches({ data: [match({ startedAt: null })] }, me)[0].startedAt).toBeNull();
  });

  it("skips matches that are unfinished, lack an id or a length, or don't include the player", () => {
    const data = [
      match({ id: "ok" }),
      match({ id: "live", completed: false }),
      match({ id: null }),
      match({ lengthMs: null }),
      match({ lengthMs: 0 }),
      match({ id: "no-agent", me: { agent: null } }),
      match({ id: "nameless-agent", me: { agent: { id: "x" } } }),
      { ...match({ id: "stranger" }), players: [{ puuid: "z", name: "Nobody", tag: "1234", team_id: "Red", agent: JETT }] },
      null,
      "junk",
      { metadata: null, players: [] },
    ];
    expect(normalizeMatches({ data }, me).map((m) => m.id)).toEqual(["ok"]);
  });

  it.each([null, undefined, "nope", 7, {}, { data: null }, { data: {} }])("returns nothing for %j", (payload) => {
    expect(normalizeMatches(payload, me)).toEqual([]);
  });
});
