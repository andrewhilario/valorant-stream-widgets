import { describe, expect, it } from "vitest";
import {
  creditRange,
  cumulativeMp,
  forecastMastery,
  levelRows,
  matchesNeeded,
  milestoneCost,
  milestonesBetween,
  mpForLevel,
  mpPerMatch,
  normaliseMastery,
  REWARD_MILESTONES,
  type MasteryInput,
} from "./mastery";

describe("the level table (Riot's Agent Mastery page, Patch 13.06)", () => {
  it("costs each level as published", () => {
    expect([1, 2, 3, 10, 11, 12, 13, 14, 15, 30].map(mpForLevel)).toEqual([
      2_000, 8_500, 9_300, 22_500, 35_000, 78_000, 205_000, 418_000, 715_000, 715_000,
    ]);
    expect(mpForLevel(0)).toBe(0);
  });

  it("adds up to the published cumulative totals", () => {
    expect(cumulativeMp(0)).toBe(0);
    expect(cumulativeMp(1)).toBe(2_000);
    expect(cumulativeMp(2)).toBe(10_500);
    expect(cumulativeMp(10)).toBe(132_400); // the main track, as the wiki totals it
    expect(cumulativeMp(11)).toBe(167_400);
    expect(cumulativeMp(14)).toBe(868_400);
    expect(cumulativeMp(15)).toBe(1_583_400);
    expect(cumulativeMp(30)).toBe(12_308_400);
  });

  it("has a table row for each of levels 1–14 whose cumulative column follows from the costs", () => {
    const rows = levelRows();
    expect(rows).toHaveLength(14);
    let running = 0;
    for (const row of rows) {
      running += row.mp;
      expect(row.cumulative).toBe(running);
    }
    expect(rows[9]).toEqual({ level: 10, mp: 22_500, cumulative: 132_400 });
  });
});

describe("MP per match: seconds × 4/3, × 1.3 for a win", () => {
  it("makes a 35 minute match worth 2,800 MP, or 3,640 if won", () => {
    const mp = mpPerMatch(35, 50);
    expect(mp.loss).toBeCloseTo(2_800, 6);
    expect(mp.win).toBeCloseTo(3_640, 6);
    expect(mp.average).toBeCloseTo(3_220, 6);
  });

  it("earns 80 MP a minute before the win bonus", () => {
    expect(mpPerMatch(1, 0).average).toBeCloseTo(80, 6);
  });

  it("weights by win rate", () => {
    expect(mpPerMatch(10, 0).average).toBeCloseTo(800, 6);
    expect(mpPerMatch(10, 100).average).toBeCloseTo(1_040, 6);
  });

  it("adds a Performance Score bonus only when you give one", () => {
    expect(mpPerMatch(35, 50, 0).average).toBeCloseTo(3_220, 6);
    expect(mpPerMatch(35, 50, 10).average).toBeCloseTo(3_542, 6);
    expect(mpPerMatch(35, 50, -20).average).toBeCloseTo(3_220, 6); // no negative bonus
  });
});

const base: MasteryInput = {
  currentLevel: 0,
  mpIntoLevel: 0,
  targetLevel: 10,
  minutes: 35,
  winRate: 50,
  bonusPct: 0,
  hoursPerDay: 2,
};

describe("forecastMastery", () => {
  it("takes 42 matches and 24.5 hours for the main track from scratch at 35 minutes and 50% wins", () => {
    const result = forecastMastery(base);
    expect(result).toMatchObject({ ok: true, remainingMp: 132_400, matches: 42, levelsGained: 10 });
    if (!result.ok) return;
    expect(result.hours).toBeCloseTo(24.5, 6);
    expect(result.days).toBeCloseTo(12.25, 6);
  });

  it("counts progress already made", () => {
    const result = forecastMastery({ ...base, currentLevel: 4, mpIntoLevel: 5_000 });
    expect(result).toMatchObject({ ok: true, remainingMp: 132_400 - 30_300 - 5_000, levelsGained: 6 });
    if (result.ok) expect(result.matches).toBe(Math.ceil(97_100 / 3_220));
  });

  it("skips the calendar estimate when no daily hours are given", () => {
    const result = forecastMastery({ ...base, hoursPerDay: 0 });
    expect(result.ok && result.days).toBeNull();
  });

  it("needs a match length", () => {
    expect(forecastMastery({ ...base, minutes: 0 })).toEqual({ ok: false, reason: "no-match-time" });
  });

  it("needs fewer matches when they're longer, won more, or bonused", () => {
    const matches = (over: Partial<MasteryInput>) => {
      const r = forecastMastery({ ...base, ...over });
      return r.ok ? r.matches : Infinity;
    };
    expect(matches({ minutes: 45 })).toBeLessThan(matches({}));
    expect(matches({ winRate: 70 })).toBeLessThan(matches({}));
    expect(matches({ bonusPct: 15 })).toBeLessThan(matches({}));
  });
});

describe("matchesNeeded", () => {
  it("is what forecastMastery uses, so the headline and any per-mode figure can't disagree", () => {
    const f = forecastMastery(base);
    expect(f.ok && f.matches).toBe(matchesNeeded(132_400, 35, 50, 0));
  });

  it("needs more matches the shorter they are, for the same Mastery Points", () => {
    const at = (minutes: number) => matchesNeeded(100_000, minutes, 50);
    expect(at(10)).toBeGreaterThan(at(12.5));
    expect(at(12.5)).toBeGreaterThan(at(35));
    // Twice the length, half the matches (to within a whole match).
    expect(Math.abs(at(10) - 2 * at(20))).toBeLessThanOrEqual(1);
  });

  it("is exact when the division is exact", () => {
    // 12.5 minutes is 1,000 MP before the win bonus, so 1,150 on average at 50% wins: 115,000 MP is exactly 100.
    expect(matchesNeeded(115_000, 12.5, 50)).toBe(100);
  });

  it("follows the win rate and the Performance Score bonus", () => {
    expect(matchesNeeded(100_000, 35, 70)).toBeLessThan(matchesNeeded(100_000, 35, 30));
    expect(matchesNeeded(100_000, 35, 50, 20)).toBeLessThan(matchesNeeded(100_000, 35, 50, 0));
  });
});

describe("normaliseMastery", () => {
  it("keeps the target above the current level and everything in range", () => {
    expect(normaliseMastery({ ...base, currentLevel: 12, targetLevel: 5 })).toMatchObject({ currentLevel: 12, targetLevel: 13 });
    expect(normaliseMastery({ ...base, currentLevel: 99, targetLevel: 99 })).toMatchObject({ currentLevel: 29, targetLevel: 30 });
    expect(normaliseMastery({ ...base, currentLevel: -3 })).toMatchObject({ currentLevel: 0 });
  });

  it("caps progress below the cost of the next level", () => {
    expect(normaliseMastery({ ...base, currentLevel: 0, mpIntoLevel: 50_000 }).mpIntoLevel).toBe(1_999);
    expect(normaliseMastery({ ...base, mpIntoLevel: -5 }).mpIntoLevel).toBe(0);
  });
});

describe("reward milestones", () => {
  it("lists what a climb passes, excluding the level you start on", () => {
    expect(milestonesBetween(0, 12).map((m) => m.level)).toEqual([5, 10]);
    expect(milestonesBetween(10, 15).map((m) => m.level)).toEqual([15]);
    expect(milestonesBetween(29, 30).map((m) => m.level)).toEqual([30]);
    expect(milestonesBetween(30, 35)).toEqual([]);
  });

  it("has a milestone every five levels from 5 to 30", () => {
    expect(REWARD_MILESTONES.map((m) => m.level)).toEqual([5, 10, 15, 20, 25, 30]);
  });

  // The wiki lists each reward with its own Kingdom Credits cost. The ranges shown on the page come from those.
  it("works the credit range out from the individual costs", () => {
    expect(REWARD_MILESTONES.map(creditRange)).toEqual([
      "2,500–5,000",
      "2,500–6,000",
      "2,500–8,000",
      "2,500–6,000",
      "2,500–7,500",
      "2,500–7,500",
    ]);
  });

  it("totals what it costs to claim everything at a milestone", () => {
    expect(REWARD_MILESTONES.map(milestoneCost)).toEqual([18_500, 18_000, 19_500, 21_500, 20_000, 25_000]);
  });

  it("lists the rewards the wiki names for each milestone", () => {
    const names = (level: number) => REWARD_MILESTONES.find((m) => m.level === level)!.rewards.map((r) => r.name);
    expect(names(5)).toEqual(["Spray", "Player title", "Player card", "KD stat", "Quote"]);
    expect(names(15)).toEqual(["Sidearm weapon skin", "Quote", "Spray", "First Bloods stat"]);
    expect(names(30)).toContain("Level IV frame");
    expect(REWARD_MILESTONES.every((m) => m.rewards.length >= 4)).toBe(true);
  });

  it("shows a single figure when every reward costs the same", () => {
    expect(creditRange({ level: 1, rewards: [{ name: "A", credits: 3_000 }, { name: "B", credits: 3_000 }] })).toBe("3,000");
  });
});
