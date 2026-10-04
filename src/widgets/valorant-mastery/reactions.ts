// How the mastery overlay reacts when a match is detected. Parallels
// valorant-rank/reactions.ts but for Mastery Point gains and level-ups.

import { cumulativeMp, mpForLevel } from "@/lib/mastery";
import type { MasteryData, MasteryReactionKind } from "./mastery-types";

export const MASTERY_REACTION_KINDS: MasteryReactionKind[] = ["mp_gain", "level_up", "target_reached"];

export const MASTERY_REACTION_LABELS: Record<MasteryReactionKind, string> = {
  mp_gain: "MP gained",
  level_up: "Level up",
  target_reached: "Target reached",
};

/** How long each reaction plays, in ms. Keep in step with widget.css. */
export const MASTERY_REACTION_MS: Record<MasteryReactionKind, number> = {
  mp_gain: 1500,
  level_up: 2200,
  target_reached: 2800,
};

/**
 * What changed between two states of the mastery data. A level-up wins over a
 * plain MP gain, and reaching the target wins over everything.
 */
export function detectMasteryReaction(
  prev: MasteryData | null,
  next: MasteryData | null,
): MasteryReactionKind | null {
  if (!prev || !next) return null;
  // Same number of matches means nothing new happened.
  if (prev.matches.length === next.matches.length) return null;

  if (!prev.targetReached && next.targetReached) return "target_reached";
  if (next.currentLevel > prev.currentLevel) return "level_up";
  if (next.sessionMp > prev.sessionMp) return "mp_gain";
  return null;
}

/**
 * Simulate an MP gain for the editor's "Try" buttons, without waiting for a
 * real match. Adds a fake match worth ~35 minutes of play.
 */
export function simulateMasteryGain(
  data: MasteryData,
  kind: MasteryReactionKind,
  at = Date.now(),
): MasteryData {
  // A 35-minute won match = 35 * 60 * (4/3) * 1.3 ≈ 3640 MP
  const fakeMp = kind === "level_up" ? data.mpForNextLevel - data.mpIntoCurrentLevel + 100 : 3640;

  const fakeMatch = {
    id: `test-${at}`,
    at,
    won: true,
    durationMinutes: 35,
    mpEarned: fakeMp,
  };

// Recompute totals as the Runtime would.
  const newSessionMp = data.sessionMp + fakeMp;
  const newTotalMp = data.startingMp + newSessionMp;

  let level = 0;
  while (level < 30 && cumulativeMp(level + 1) <= newTotalMp) level++;
  const mpInto = newTotalMp - cumulativeMp(level);
  const mpNext = mpForLevel(level + 1);

  return {
    ...data,
    sessionMp: newSessionMp,
    totalMp: newTotalMp,
    currentLevel: level,
    mpIntoCurrentLevel: mpInto,
    mpForNextLevel: mpNext,
    matches: [...data.matches, fakeMatch],
    levelsGained: level - data.start.currentLevel,
    targetReached: level >= data.start.targetLevel,
    matchesRemaining: level >= data.start.targetLevel ? 0 : data.matchesRemaining,
    hoursRemaining: level >= data.start.targetLevel ? 0 : data.hoursRemaining,
  };
}
