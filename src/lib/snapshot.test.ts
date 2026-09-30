import { describe, expect, it } from "vitest";
import { sampleRank } from "@/widgets/valorant-rank/sample";
import type { MatchSummary } from "./matches";
import { buildSnapshot } from "./snapshot";

const NOW = Date.parse("2026-09-30T12:00:00.000Z");

// sampleRank history, newest first: +21 -14 +18 +22 -19 +16 -12 +19 +13 -15 +12 (ids sample-0 … sample-10)
// 7 wins averaging 17.3 RR, 4 losses averaging 15 RR.
const rank = sampleRank(NOW, "diamond");

const JETT = { id: "jett", name: "Jett" };
const SAGE = { id: "sage", name: "Sage" };

function game(id: string, agent: { id: string; name: string }, minutes: number, won: boolean | null): MatchSummary {
  return { id, startedAt: null, lengthMs: minutes * 60_000, agent, won };
}

describe("buildSnapshot: overall", () => {
  it("works out win rate and average RR from the RR history", () => {
    const s = buildSnapshot(rank, null, NOW);
    expect(s.games).toBe(11);
    expect(s.winRate).toBeCloseTo((7 / 11) * 100, 6);
    expect(s.avgRrWin).toBe(17.3);
    expect(s.avgRrLoss).toBe(15);
    expect(s.rank).toEqual({ tierId: 19, tier: "Diamond 2", rr: 67 });
    expect(s.account).toEqual({ name: "Sample", tag: "0000" });
    expect(s.fetchedAt).toBe(NOW);
  });

  it("says there is no agent data, rather than showing an empty list, when matches could not load", () => {
    const s = buildSnapshot(rank, null, NOW);
    expect(s.agentsAvailable).toBe(false);
    expect(s.agents).toEqual([]);
    expect(s.avgMinutes).toBeNull();
  });

  it("copes with an account that has no history yet", () => {
    const s = buildSnapshot(sampleRank(NOW, "unrated"), [], NOW);
    expect(s.games).toBe(0);
    expect(s.winRate).toBeNull();
    expect(s.avgRrWin).toBeNull();
    expect(s.avgRrLoss).toBeNull();
    expect(s.agentsAvailable).toBe(true);
    expect(s.agents).toEqual([]);
  });

  it("counts a derank-protected 0 RR game as a loss, but a plain 0 as undecided", () => {
    const base = sampleRank(NOW, "diamond");
    const history = [
      { ...base.history[0], id: "p", change: 0, protected: true },
      { ...base.history[1], id: "z", change: 0, protected: false },
      { ...base.history[2], id: "w", change: 20, protected: false },
    ];
    const s = buildSnapshot({ ...base, history }, null, NOW);
    expect(s.winRate).toBe(50);
    expect(s.avgRrLoss).toBe(0);
    expect(s.avgRrWin).toBe(20);
  });
});

describe("buildSnapshot: per agent", () => {
  const matches = [
    game("sample-0", JETT, 30, true), // +21
    game("sample-1", JETT, 40, false), // -14
    game("sample-2", JETT, 35, true), // +18
    game("sample-3", SAGE, 28, true), // +22
    game("sample-4", SAGE, 32, false), // -19
  ];

  it("groups by agent, most played first, with win rate, average length and RR from the joined history", () => {
    const s = buildSnapshot(rank, matches, NOW);
    expect(s.agentsAvailable).toBe(true);
    expect(s.agents.map((a) => a.name)).toEqual(["Jett", "Sage"]);

    expect(s.agents[0]).toEqual({
      id: "jett",
      name: "Jett",
      games: 3,
      wins: 2,
      losses: 1,
      winRate: (2 / 3) * 100,
      avgMinutes: 35,
      avgRrWin: 19.5,
      avgRrLoss: 14,
    });
    expect(s.agents[1]).toMatchObject({ name: "Sage", games: 2, wins: 1, losses: 1, winRate: 50, avgMinutes: 30, avgRrWin: 22, avgRrLoss: 19 });
    expect(s.avgMinutes).toBe(33);
  });

  it("takes the result from the RR change when the match didn't say who won", () => {
    const s = buildSnapshot(rank, [game("sample-0", JETT, 30, null), game("sample-1", JETT, 30, null)], NOW);
    expect(s.agents[0]).toMatchObject({ wins: 1, losses: 1, winRate: 50 });
  });

  it("prefers the match's own result over the RR sign", () => {
    // sample-0 gained RR, but the match says the team lost (for example a forfeit-adjusted game).
    const s = buildSnapshot(rank, [game("sample-0", JETT, 30, false)], NOW);
    expect(s.agents[0]).toMatchObject({ wins: 0, losses: 1, winRate: 0 });
  });

  it("leaves RR averages null for matches that are not in the RR history", () => {
    const s = buildSnapshot(rank, [game("elsewhere", JETT, 31, true)], NOW);
    expect(s.agents[0]).toMatchObject({ games: 1, wins: 1, avgRrWin: null, avgRrLoss: null, avgMinutes: 31 });
  });

  it("has no win rate for an agent before a decided game", () => {
    const s = buildSnapshot(rank, [game("elsewhere", JETT, 31, null)], NOW);
    expect(s.agents[0]).toMatchObject({ games: 1, wins: 0, losses: 0, winRate: null });
  });

  it("breaks ties on games by name, so the order is stable", () => {
    const s = buildSnapshot(rank, [game("a", SAGE, 30, true), game("b", JETT, 30, true)], NOW);
    expect(s.agents.map((a) => a.name)).toEqual(["Jett", "Sage"]);
  });
});
