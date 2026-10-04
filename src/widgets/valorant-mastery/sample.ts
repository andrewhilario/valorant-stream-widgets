// Invented numbers for trying the mastery overlay without an account.
// Parallels valorant-rank/sample.ts.

import { cumulativeMp, mpForLevel, mpPerMatch } from "@/lib/mastery";
import type { MasteryData, MasteryMatch } from "./mastery-types";

export type MasterySampleVariant = "early" | "mid" | "late";

const MINUTE = 60_000;

/** Sample matches for the session. */
function sampleMatches(now: number, count: number): MasteryMatch[] {
  const matches: MasteryMatch[] = [];
  for (let i = 0; i < count; i++) {
    const won = i % 3 !== 2; // 2 wins, 1 loss pattern
    const dur = 32 + Math.round(Math.sin(i) * 4); // 28-36 min
    const mp = Math.round(dur * 60 * (4 / 3) * (won ? 1.3 : 1.0));
    matches.push({
      id: `sample-${i}`,
      at: now - (count - i) * 40 * MINUTE,
      won,
      durationMinutes: dur,
      mpEarned: mp,
    });
  }
  return matches;
}

/**
 * Invented mastery data. The variant decides how far along the track:
 * - "early": Act Level 3, targeting 7 (Portrait Accent)
 * - "mid": Act Level 6, targeting 10 (max main track + Portrait Accent)
 * - "late": Act Level 9, targeting 10 (almost there)
 */
export function sampleMastery(now: number, variant: MasterySampleVariant = "mid"): MasteryData {
  const levels: Record<MasterySampleVariant, { current: number; target: number; matches: number }> = {
    early: { current: 3, target: 7, matches: 2 },
    mid: { current: 6, target: 10, matches: 4 },
    late: { current: 9, target: 10, matches: 6 },
  };

  const { current, target, matches: matchCount } = levels[variant];
  const mpInto = Math.round(mpForLevel(current + 1) * 0.4); // 40% into the level
  const startingMp = cumulativeMp(current) + mpInto;

  const matches = sampleMatches(now, matchCount);
  const sessionMp = matches.reduce((sum, m) => sum + m.mpEarned, 0);
  const totalMp = startingMp + sessionMp;

  // Derive current level from total MP
  let level = 0;
  while (level < 30 && cumulativeMp(level + 1) <= totalMp) level++;
  const mpIntoCurrent = totalMp - cumulativeMp(level);
  const mpNext = mpForLevel(level + 1);

  // Estimate remaining
  const remainingMp = cumulativeMp(target) - totalMp;
  const avgMpPerMatch = mpPerMatch(33, 55).average; // 33 min, 55% WR
  const matchesRemaining = remainingMp > 0 ? Math.ceil(remainingMp / avgMpPerMatch) : 0;
  const hoursRemaining = remainingMp > 0 ? (matchesRemaining * 33) / 60 : 0;

  return {
    start: {
      agentId: "add6443a-41bd-e414-f6ad-e58d267f4e95", // Jett
      agentName: "Jett",
      currentLevel: current,
      mpIntoLevel: mpInto,
      targetLevel: target,
      bonusPct: 0,
    },
    startingMp,
    sessionMp,
    totalMp,
    currentLevel: level,
    mpIntoCurrentLevel: mpIntoCurrent,
    mpForNextLevel: mpNext,
    matches,
    levelsGained: level - current,
    targetReached: level >= target,
    matchesRemaining: remainingMp > 0 ? matchesRemaining : 0,
    hoursRemaining: remainingMp > 0 ? hoursRemaining : 0,
  };
}
