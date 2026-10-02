// How the overlay reacts when a game ends, worked out from two lookups in a row. It is a pure function so the same rule runs
// in OBS (where games really end) and in the editor (where "Try a game" makes one up with simulateGame).

import type { RankData } from "@/lib/rank-types";
import type { HistoryEntry } from "@/lib/session";
import { RADIANT, tierName } from "@/lib/tiers";

export type ReactionKind = "win" | "loss" | "up" | "down";

/** `n` counts up, so the same kind twice in a row still plays again. */
export type Reaction = { kind: ReactionKind; n: number };

export const REACTION_KINDS: ReactionKind[] = ["win", "loss", "up", "down"];

export const REACTION_LABELS: Record<ReactionKind, string> = {
  win: "Win",
  loss: "Loss",
  up: "Rank up",
  down: "Rank down",
};

/** How long each one plays, in ms; the widget takes its marker off afterwards. Keep these in step with widget.css. */
export const REACTION_MS: Record<ReactionKind, number> = { win: 1500, loss: 1200, up: 2200, down: 1500 };

/** Iron 1 is the first ranked tier; below it is Unrated. */
const FIRST_RANKED = 3;
/** Immortal 1 and up: RR keeps counting, with no 100-point ceiling. */
const FIRST_OPEN = 24;
/** Iron 1 to Ascendant 3 climb in steps of this many RR. */
const STEP = 100;

/**
 * A game only counts as news if it ended this recently. An older one turning up in the history is the history catching
 * up, not a result worth celebrating.
 */
export const RECENT_MS = 15 * 60_000;

const who = (data: RankData) => `${data.account.name}#${data.account.tag}`.toLowerCase();

/**
 * What, if anything, changed between two lookups of the same account. A new rank is the bigger moment, so it wins over
 * the game that caused it. Different accounts, a history that was missing, and games that aren't new all return null.
 */
export function detectReaction(prev: RankData | null, next: RankData | null): ReactionKind | null {
  if (!prev || !next || who(prev) !== who(next)) return null;

  const before = prev.current.tierId;
  const after = next.current.tierId;
  if (before >= FIRST_RANKED && after >= FIRST_RANKED && after !== before) return after > before ? "up" : "down";
  // The last placement game: Unrated becomes a rank.
  if (before < FIRST_RANKED && prev.current.gamesNeeded > 0 && after >= FIRST_RANKED) return "up";

  // A history that failed to load, then loads, would make every old game look new.
  if (prev.partial || next.partial) return null;

  const known = new Set(prev.history.map((game) => game.id));
  let latest: HistoryEntry | null = null;
  for (const game of next.history) {
    if (known.has(game.id)) continue;
    if (latest === null || game.at > latest.at) latest = game;
  }
  if (latest === null || latest.change === 0) return null;
  if (latest.at < next.fetchedAt - RECENT_MS) return null;
  return latest.change > 0 ? "win" : "loss";
}

const CHANGE: Record<ReactionKind, number> = { win: 19, loss: -16, up: 24, down: -21 };

/**
 * The same account one game later, for trying the reactions without playing. "Rank up" and "Rank down" force the move
 * across a tier whatever the RR, so they always show what they say. Not a model of Valorant's matchmaking: RR stays
 * continuous across a boundary, where real demotions land lower. Unrated has nothing to move, so it comes back as is.
 */
export function simulateGame(data: RankData, kind: ReactionKind, at = Date.now()): RankData {
  const { tierId, rr } = data.current;
  if (tierId < FIRST_RANKED) return data;

  const change = CHANGE[kind];
  const open = tierId >= FIRST_OPEN;
  let tier = tierId;
  let points = rr;

  if (kind === "up" && tier < RADIANT) {
    tier += 1;
    points = open ? rr + change : 18;
  } else if (kind === "down" && tier > FIRST_RANKED) {
    tier -= 1;
    points = open ? Math.max(0, rr + change) : 84;
  } else {
    points = rr + change;
    if (open) {
      points = Math.max(0, points);
    } else if (points >= STEP) {
      tier += 1;
      points -= STEP;
    } else if (points < 0) {
      if (tier > FIRST_RANKED) {
        tier -= 1;
        points += STEP;
      } else {
        points = 0;
      }
    }
  }

  const game: HistoryEntry = { id: `test-${at}`, at, change, rr: points, tierId: tier, protected: false };
  const peak = data.peak && tier > data.peak.tierId ? { ...data.peak, tierId: tier, tier: tierName(tier) } : data.peak;

  return {
    ...data,
    fetchedAt: at,
    current: {
      ...data.current,
      tierId: tier,
      tier: tierName(tier),
      rr: points,
      elo: (tier - FIRST_RANKED) * STEP + points,
      lastChange: change,
    },
    peak,
    history: [game, ...data.history],
  };
}
