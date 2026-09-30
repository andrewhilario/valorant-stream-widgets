import { describe, expect, it } from "vitest";
import { CURRENT_TIERS, evaluateRank, RANK_EXAMPLE, targetTiers, withCurrentTier, type RankForm } from "./rank-tool";

const form = (over: Partial<RankForm> = {}): RankForm => ({ ...RANK_EXAMPLE, ...over });

describe("tier lists", () => {
  it("starts from Iron 1 through Ascendant 3", () => {
    expect(CURRENT_TIERS).toHaveLength(21);
    expect(CURRENT_TIERS[0]).toBe(3);
    expect(CURRENT_TIERS.at(-1)).toBe(23);
  });

  it("only offers targets above the current tier, up to Immortal 1", () => {
    expect(targetTiers(19)).toEqual([20, 21, 22, 23, 24]);
    expect(targetTiers(23)).toEqual([24]);
    expect(targetTiers(3)[0]).toBe(4);
    expect(targetTiers(3).at(-1)).toBe(24);
  });

  it("moves the target up when the current rank reaches it", () => {
    expect(withCurrentTier(form({ target: 21 }), 22)).toMatchObject({ tier: 22, target: 23 });
    expect(withCurrentTier(form({ target: 21 }), 21)).toMatchObject({ tier: 21, target: 22 });
    expect(withCurrentTier(form({ target: 21 }), 18)).toMatchObject({ tier: 18, target: 21 });
  });
});

describe("evaluateRank: the example", () => {
  const view = evaluateRank(RANK_EXAMPLE);

  it("works out the gap, the average and the expected games", () => {
    if (view.kind !== "ok") throw new Error(`expected ok, got ${view.kind}`);
    // Diamond 2 at 67 RR to Ascendant 1: two steps of 100, less the 67 already there.
    expect(view.gap).toBe(133);
    // 54% × 19 − 46% × 17 = 2.44 RR per game; 133 ÷ 2.44 = 54.5, rounded up.
    expect(view.meanPerGame).toBeCloseTo(2.44, 6);
    expect(view.expected).toBe(55);
    expect(view.breakEven).toBeCloseTo((17 / 36) * 100, 6);
  });

  it("puts the likely range around the expected figure", () => {
    if (view.kind !== "ok") throw new Error("expected ok");
    expect(view.fast).toBeGreaterThanOrEqual(1);
    expect(view.fast).toBeLessThan(view.expected);
    expect(view.slow).toBeGreaterThan(view.expected);
  });

  it("lists what a few points of win rate change, with the typed rate marked", () => {
    if (view.kind !== "ok") throw new Error("expected ok");
    expect(view.sweep.map((r) => r.winRate)).toEqual([48, 51, 54, 57, 60]);
    expect(view.sweep.filter((r) => r.current).map((r) => r.winRate)).toEqual([54]);
    expect(view.sweep.find((r) => r.current)?.games).toBe(view.expected);

    // More wins never means more games.
    const games = view.sweep.map((r) => r.games ?? Infinity);
    expect([...games].sort((a, b) => b - a)).toEqual(games);
  });

  it("says what win rate would finish in 25, 50 and 100 games", () => {
    if (view.kind !== "ok") throw new Error("expected ok");
    expect(view.goals.map((g) => g.games)).toEqual([25, 50, 100]);
    // 133 RR in 50 games is 2.66 RR a game: w × 19 − (1 − w) × 17 = 2.66 → w = 19.66 ÷ 36.
    expect(view.goals[1].winRate).toBeCloseTo((19.66 / 36) * 100, 6);
    // Faster needs more wins.
    expect(view.goals[0].winRate!).toBeGreaterThan(view.goals[1].winRate!);
    expect(view.goals[1].winRate!).toBeGreaterThan(view.goals[2].winRate!);
  });
});

describe("evaluateRank: other states", () => {
  it("says the climb never finishes when the win rate is below break-even", () => {
    const view = evaluateRank(form({ winRate: "40" }));
    expect(view.kind).toBe("losing");
    if (view.kind !== "losing") return;
    expect(view.meanPerGame).toBeLessThan(0);
    expect(view.breakEven).toBeCloseTo((17 / 36) * 100, 6);
    // Every row below break-even is "never"; every row above it has a number.
    for (const row of view.sweep) {
      if (row.winRate < view.breakEven) expect(row.games).toBeNull();
    }
  });

  it("shows the win rates that would finish, not just more rates that don't", () => {
    const view = evaluateRank(form({ winRate: "40" }));
    if (view.kind !== "losing") throw new Error("expected losing");
    // Yours is marked, and there are rows above break-even with a real number of games.
    expect(view.sweep.filter((r) => r.current).map((r) => r.winRate)).toEqual([40]);
    const finishing = view.sweep.filter((r) => r.games !== null);
    expect(finishing.length).toBeGreaterThanOrEqual(3);
    expect(finishing.every((r) => r.winRate > view.breakEven)).toBe(true);
    // Sorted from low to high, and more wins means fewer games.
    expect(view.sweep.map((r) => r.winRate)).toEqual([...view.sweep.map((r) => r.winRate)].sort((a, b) => a - b));
    const games = finishing.map((r) => r.games!);
    expect([...games].sort((a, b) => b - a)).toEqual(games);
  });

  it("treats exactly break-even as a climb that never finishes, too", () => {
    expect(evaluateRank(form({ winRate: "50", rrWin: "20", rrLoss: "20" })).kind).toBe("losing");
  });

  it("keeps the sweep inside 0–100%", () => {
    const high = evaluateRank(form({ winRate: "98" }));
    expect(high.kind === "invalid" ? [] : high.sweep.map((r) => r.winRate)).toEqual([92, 95, 98]);
    // 2% loses RR, so the rows are yours plus the rates just above break-even (47.2%), none past 100.
    const low = evaluateRank(form({ winRate: "2" }));
    expect(low.kind === "invalid" ? [] : low.sweep.map((r) => r.winRate)).toEqual([2, 50, 52, 55, 58]);
    const extreme = evaluateRank(form({ winRate: "5", rrWin: "1", rrLoss: "99" }));
    expect(extreme.kind === "invalid" ? [] : extreme.sweep.every((r) => r.winRate >= 0 && r.winRate <= 100)).toBe(true);
  });

  it("marks the typed win rate even when it has decimals", () => {
    const view = evaluateRank(form({ winRate: "54.55" }));
    if (view.kind === "invalid") throw new Error("expected a result");
    expect(view.sweep.some((r) => r.current && r.winRate === 54.55)).toBe(true);
  });

  it("reports goals that even winning every game can't reach as null", () => {
    const view = evaluateRank(form({ tier: 3, target: 24, rr: "0", winRate: "60" }));
    if (view.kind !== "ok") throw new Error("expected ok");
    // 2,100 RR in 25 games is 84 a game, and a win is worth 19.
    expect(view.goals[0].winRate).toBeNull();
    expect(view.goals[2].winRate).toBeNull();
  });

  it("accepts RR per game with decimals and thousands-style typing", () => {
    expect(evaluateRank(form({ rrWin: "18.5", rrLoss: "16,5" })).kind).toBe("ok");
  });

  it.each([
    ["rr", { rr: "" }],
    ["rr", { rr: "100" }],
    ["rr", { rr: "6.5" }],
    ["rr", { rr: "abc" }],
    ["winRate", { winRate: "101" }],
    ["winRate", { winRate: "-3" }],
    ["rrWin", { rrWin: "0" }],
    ["rrLoss", { rrLoss: "-17" }],
    ["rrLoss", { rrLoss: "" }],
  ] as Array<[keyof RankForm, Partial<RankForm>]>)("flags %s as invalid for %j and gives no result", (field, over) => {
    const view = evaluateRank(form(over));
    expect(view.kind).toBe("invalid");
    if (view.kind === "invalid") expect(view.errors[field as "rr"]).toEqual(expect.any(String));
  });

  it("reports every bad field at once, not just the first", () => {
    const view = evaluateRank(form({ rr: "x", winRate: "x", rrWin: "x", rrLoss: "x" }));
    expect(view.kind).toBe("invalid");
    if (view.kind === "invalid") expect(Object.keys(view.errors).sort()).toEqual(["rr", "rrLoss", "rrWin", "winRate"]);
  });
});
