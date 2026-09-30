import { describe, expect, it } from "vitest";
import {
  breakEvenWinRate,
  forecastRank,
  perGame,
  requiredWinRate,
  rrToGo,
  whatIf,
  type RankPlan,
} from "./rank-calc";

const plan: RankPlan = { currentTier: 19, currentRr: 40, targetTier: 21, winRate: 55, rrWin: 20, rrLoss: 18 };

describe("the gap", () => {
  it("is 100 RR per tier step minus the RR you already have", () => {
    expect(rrToGo(plan)).toBe(160);
    expect(rrToGo({ currentTier: 19, currentRr: 0, targetTier: 20 })).toBe(100);
    expect(rrToGo({ currentTier: 23, currentRr: 99, targetTier: 24 })).toBe(1);
  });
});

describe("RR per game", () => {
  it("is win rate × gain − loss rate × loss, with the matching spread", () => {
    const { mean, sd } = perGame(plan);
    expect(mean).toBeCloseTo(0.55 * 20 - 0.45 * 18, 10); // 2.9
    expect(sd).toBeCloseTo(Math.sqrt(0.55 * 0.45) * 38, 10);
  });

  it("breaks even at loss ÷ (gain + loss)", () => {
    expect(breakEvenWinRate(20, 18)).toBeCloseTo(47.368, 2);
    expect(perGame({ winRate: breakEvenWinRate(20, 18), rrWin: 20, rrLoss: 18 }).mean).toBeCloseTo(0, 10);
  });
});

describe("forecastRank", () => {
  it("expects gap ÷ mean games, with the fast end before it and the slow end after", () => {
    const result = forecastRank(plan);
    expect(result.kind).toBe("ok");
    if (result.kind !== "ok") return;
    expect(result.expected).toBe(Math.ceil(160 / 2.9)); // 56
    expect(result.fast).toBeLessThan(result.expected);
    expect(result.slow).toBeGreaterThan(result.expected);
  });

  it("shrinks the wait as the win rate rises", () => {
    const games = [50, 55, 60, 65].map((winRate) => {
      const r = forecastRank({ ...plan, winRate });
      return r.kind === "ok" ? r.expected : Infinity;
    });
    expect([...games].sort((a, b) => b - a)).toEqual(games);
  });

  it("says you're losing RR when the win rate is under break-even", () => {
    const result = forecastRank({ ...plan, winRate: 45 });
    expect(result.kind).toBe("losing");
    if (result.kind === "losing") expect(result.breakEven).toBeCloseTo(47.368, 2);
  });

  it("treats exactly break-even as going nowhere", () => {
    expect(forecastRank({ ...plan, winRate: 50, rrWin: 20, rrLoss: 20 }).kind).toBe("losing");
  });

  it("has no spread when you win every game", () => {
    const result = forecastRank({ ...plan, winRate: 100 });
    expect(result).toMatchObject({ kind: "ok", expected: 8, fast: 8, slow: 8 }); // 160 / 20
  });

  it("rejects targets it doesn't handle, and bad amounts", () => {
    expect(forecastRank({ ...plan, targetTier: 19 })).toEqual({ kind: "invalid", reason: "target" });
    expect(forecastRank({ ...plan, targetTier: 25 })).toEqual({ kind: "invalid", reason: "target" });
    expect(forecastRank({ ...plan, currentTier: 2 })).toEqual({ kind: "invalid", reason: "target" });
    expect(forecastRank({ ...plan, rrWin: 0 })).toEqual({ kind: "invalid", reason: "amounts" });
    expect(forecastRank({ ...plan, rrLoss: -3 })).toEqual({ kind: "invalid", reason: "amounts" });
  });

  it("copes with a tiny gap", () => {
    const result = forecastRank({ currentTier: 23, currentRr: 99, targetTier: 24, winRate: 50, rrWin: 20, rrLoss: 15 });
    expect(result.kind).toBe("ok");
    if (result.kind === "ok") expect(result.expected).toBeGreaterThanOrEqual(1);
  });

  // The range is an inverse-Gaussian approximation of a random walk. Check it against the real walk.
  it("matches a simulation of the actual walk", () => {
    const rng = mulberry32(20260930);
    const gap = 160;
    const steps: number[] = [];
    for (let run = 0; run < 20_000; run++) {
      let total = 0;
      let n = 0;
      while (total < gap && n < 5_000) {
        total += rng() < 0.55 ? 20 : -18;
        n++;
      }
      steps.push(n);
    }
    steps.sort((a, b) => a - b);
    const simulated = { fast: steps[Math.floor(steps.length * 0.1)], slow: steps[Math.floor(steps.length * 0.9)] };

    const result = forecastRank(plan);
    if (result.kind !== "ok") throw new Error("expected an ok forecast");
    expect(Math.abs(result.fast - simulated.fast)).toBeLessThanOrEqual(Math.max(4, simulated.fast * 0.2));
    expect(Math.abs(result.slow - simulated.slow)).toBeLessThanOrEqual(Math.max(8, simulated.slow * 0.15));
  });
});

describe("requiredWinRate", () => {
  it("is the win rate that covers the gap in the games you have", () => {
    const w = requiredWinRate(160, 40, 20, 18);
    expect(w).not.toBeNull();
    // At that win rate the mean per game is gap / games.
    expect(perGame({ winRate: w!, rrWin: 20, rrLoss: 18 }).mean).toBeCloseTo(4, 6);
  });

  it("is null when even winning every game isn't enough", () => {
    expect(requiredWinRate(160, 5, 20, 18)).toBeNull();
  });

  it("is null with no games or no gap", () => {
    expect(requiredWinRate(160, 0, 20, 18)).toBeNull();
    expect(requiredWinRate(0, 10, 20, 18)).toBeNull();
  });
});

describe("whatIf", () => {
  it("lists games for each win rate, null where you'd be losing RR", () => {
    const table = whatIf(plan, [45, 50, 55, 60]);
    expect(table.map((r) => r.winRate)).toEqual([45, 50, 55, 60]);
    expect(table[0].games).toBeNull();
    expect(table[2].games).toBe(56);
    expect(table[3].games!).toBeLessThan(table[2].games!);
  });
});

/** A small seeded generator, so the simulation is the same every run. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
