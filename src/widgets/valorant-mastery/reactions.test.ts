import { describe, expect, it } from "vitest";
import type { MasteryData } from "./mastery-types";
import { detectMasteryReaction, simulateMasteryGain } from "./reactions";
import { sampleMastery } from "./sample";
import { calculateMatchMp, computeMasteryState } from "./useMasteryData";

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);

describe("calculateMatchMp", () => {
  it("calculates exact base points for time played", () => {
    // 30 minutes = 1800 seconds * (4/3) = 2400 MP for a loss
    const lost = calculateMatchMp(30 * 60 * 1000, false);
    expect(lost).toBe(2400);

    // 30 minutes * (4/3) * 1.3 = 3120 MP for a win
    const won = calculateMatchMp(30 * 60 * 1000, true);
    expect(won).toBe(3120);
  });

  it("applies performance bonus percentage", () => {
    // 30 minutes won with 10% bonus = 3120 * 1.1 = 3432 MP
    const wonWithBonus = calculateMatchMp(30 * 60 * 1000, true, 10);
    expect(wonWithBonus).toBe(3432);
  });

  it("handles zero or negative duration gracefully", () => {
    expect(calculateMatchMp(0, true)).toBe(0);
    expect(calculateMatchMp(-5000, true)).toBe(0);
  });
});

describe("computeMasteryState", () => {
  it("computes starting MP and target correctly", () => {
    const state = computeMasteryState(
      {
        agentId: "test-id",
        agentName: "Reyna",
        currentLevel: 5,
        mpIntoLevel: 1000,
        targetLevel: 10,
        bonusPct: 0,
      },
      [],
    );

    expect(state.currentLevel).toBe(5);
    expect(state.mpIntoCurrentLevel).toBe(1000);
    expect(state.sessionMp).toBe(0);
    expect(state.matchesRemaining).toBeGreaterThan(0);
    expect(state.targetReached).toBe(false);
  });

  it("advances level when session matches earn sufficient MP", () => {
    // Level 0 -> Level 1 requires 2,000 MP
    const match1 = {
      id: "m1",
      at: NOW,
      won: true,
      durationMinutes: 30,
      mpEarned: 3120, // enough to reach Level 1 (2,000 MP) and 1,120 into Level 2
    };

    const state = computeMasteryState(
      {
        agentId: "test-id",
        agentName: "Jett",
        currentLevel: 0,
        mpIntoLevel: 0,
        targetLevel: 4,
        bonusPct: 0,
      },
      [match1],
    );

    expect(state.currentLevel).toBe(1);
    expect(state.mpIntoCurrentLevel).toBe(1120);
    expect(state.sessionMp).toBe(3120);
    expect(state.levelsGained).toBe(1);
  });
});

describe("detectMasteryReaction", () => {
  it("returns null if prev or next is null", () => {
    const s = sampleMastery(NOW, "mid");
    expect(detectMasteryReaction(null, s)).toBeNull();
    expect(detectMasteryReaction(s, null)).toBeNull();
  });

  it("returns null when match count is unchanged", () => {
    const s1 = sampleMastery(NOW, "mid");
    const s2 = { ...s1 };
    expect(detectMasteryReaction(s1, s2)).toBeNull();
  });

  it("detects mp_gain when sessionMp increases without level up", () => {
    const s1 = sampleMastery(NOW, "early");
    const s2 = {
      ...s1,
      sessionMp: s1.sessionMp + 2000,
      matches: [...s1.matches, { id: "m2", at: NOW, won: true, durationMinutes: 20, mpEarned: 2000 }],
    };
    expect(detectMasteryReaction(s1, s2)).toBe("mp_gain");
  });

  it("detects level_up when currentLevel increases", () => {
    const s1 = sampleMastery(NOW, "mid");
    const s2 = {
      ...s1,
      currentLevel: s1.currentLevel + 1,
      matches: [...s1.matches, { id: "m3", at: NOW, won: true, durationMinutes: 35, mpEarned: 5000 }],
    };
    expect(detectMasteryReaction(s1, s2)).toBe("level_up");
  });

  it("detects target_reached when target is crossed", () => {
    const s1 = sampleMastery(NOW, "mid");
    const s2: MasteryData = {
      ...s1,
      currentLevel: s1.start.targetLevel,
      targetReached: true,
      matches: [...s1.matches, { id: "m4", at: NOW, won: true, durationMinutes: 35, mpEarned: 5000 }],
    };
    expect(detectMasteryReaction(s1, s2)).toBe("target_reached");
  });
});

describe("simulateMasteryGain", () => {
  it("simulates match gain and increments match list", () => {
    const base = sampleMastery(NOW, "mid");
    const simulated = simulateMasteryGain(base, "mp_gain");

    expect(simulated.matches.length).toBe(base.matches.length + 1);
    expect(simulated.sessionMp).toBeGreaterThan(base.sessionMp);
  });

  it("simulates level_up properly", () => {
    const base = sampleMastery(NOW, "early");
    const simulated = simulateMasteryGain(base, "level_up");

    expect(simulated.currentLevel).toBeGreaterThan(base.currentLevel);
  });
});
