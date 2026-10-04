// Data types for the Agent Mastery overlay widget. Parallels rank-types.ts.

import type { MatchSummary } from "@/lib/matches";

/** The streamer's stated starting point, read from the link. */
export type MasteryStart = {
  agentId: string;
  agentName: string;
  currentLevel: number;
  mpIntoLevel: number;
  targetLevel: number;
  /** Performance Score bonus estimate, 0–50. */
  bonusPct: number;
};

/** One match that earned MP for the tracked agent. */
export type MasteryMatch = {
  id: string;
  /** ms since epoch. */
  at: number;
  won: boolean;
  durationMinutes: number;
  /** Base + win bonus + performance bonus. */
  mpEarned: number;
};

/** The live state the widget renders. */
export type MasteryData = {
  start: MasteryStart;
  /** MP the streamer said they started with (cumulative to currentLevel + mpIntoLevel). */
  startingMp: number;
  /** Total MP earned this session from detected matches. */
  sessionMp: number;
  /** Current cumulative MP = startingMp + sessionMp. */
  totalMp: number;
  /** Derived current Act Level from totalMp. */
  currentLevel: number;
  /** MP into the current level. */
  mpIntoCurrentLevel: number;
  /** MP needed for the next level from current position. */
  mpForNextLevel: number;
  /** Matches detected this session for the tracked agent. */
  matches: MasteryMatch[];
  /** Levels gained this session. */
  levelsGained: number;
  /** Whether the target has been reached. */
  targetReached: boolean;
  /** Estimated matches remaining to target. */
  matchesRemaining: number | null;
  /** Estimated hours remaining to target. */
  hoursRemaining: number | null;
};

export type MasteryReactionKind = "mp_gain" | "level_up" | "target_reached";

export type MasteryReaction = { kind: MasteryReactionKind; n: number };
