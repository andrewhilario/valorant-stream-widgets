import type { RankData } from "@/lib/rank-types";
import { tierName } from "@/lib/tiers";

export type SampleVariant = "diamond" | "immortal" | "radiant" | "unrated";

const MINUTE = 60_000;
const CHANGES = [21, -14, 18, 22, -19, 16, -12, 19, 13, -15, 12];

/**
 * Invented numbers for trying a look without an account. Always labelled
 * "Sample data" in the editor, and never part of a generated OBS link.
 */
export function sampleRank(now: number, variant: SampleVariant = "diamond"): RankData {
  const base = {
    ok: true as const,
    fetchedAt: now,
    account: { name: "Sample", tag: "0000", puuid: null },
  };

  if (variant === "unrated") {
    return {
      ...base,
      current: { tierId: 0, tier: "Unrated", rr: 0, elo: 0, lastChange: 0, gamesNeeded: 3, shields: 0, leaderboardRank: null },
      peak: null,
      history: [],
    };
  }

  const tierId = variant === "immortal" ? 25 : variant === "radiant" ? 27 : 19;
  const rr = variant === "immortal" ? 187 : variant === "radiant" ? 412 : 67;

  let running = rr;
  const history = CHANGES.map((change, i) => {
    const entry = {
      id: `sample-${i}`,
      at: now - (i + 1) * 25 * MINUTE,
      change,
      rr: running,
      tierId,
      protected: false,
    };
    running -= change;
    return entry;
  });

  return {
    ...base,
    current: {
      tierId,
      tier: tierName(tierId),
      rr,
      elo: (tierId - 3) * 100 + rr,
      lastChange: CHANGES[0],
      gamesNeeded: 0,
      shields: 0,
      leaderboardRank: variant === "diamond" ? null : variant === "immortal" ? 2043 : 412,
    },
    peak: { tierId: Math.min(27, tierId + 3), tier: tierName(Math.min(27, tierId + 3)), season: null },
    history,
  };
}
