// How a player is doing this Act: the wins and games HenrikDev reports per season (the `seasonal` list of the v3 MMR lookup), matched to the
// Act that is running now (seasons.ts). Pure, so it is tested without the network.

import type { SeasonResult } from "./rank-types";

/** The Act that is running: the season id (the same uuid HenrikDev uses), the words for a header, and a guess at HenrikDev's short name for it. */
export type CurrentAct = { id: string; label: string; short: string | null };

export type ActRecord = { wins: number; losses: number; games: number; /** 0 to 100, or null before a game. */ winRate: number | null };

/**
 * The record in the current Act, or null when it can't be told (no seasons in the data, or the Act is not known). An Act the player has
 * no entry for yet is a record of 0 and 0. Matched by season id; failing that, by HenrikDev's short name when it matches the guess.
 */
export function actRecord(seasons: SeasonResult[] | undefined, act: CurrentAct | null): ActRecord | null {
  if (!seasons || !act) return null;
  const id = act.id.toLowerCase();
  const short = act.short?.toLowerCase() ?? null;
  const found = seasons.find((s) => s.id === id) ?? (short ? seasons.find((s) => s.short === short) : undefined);
  const games = found?.games ?? 0;
  const wins = found?.wins ?? 0;
  return { wins, losses: Math.max(0, games - wins), games, winRate: games > 0 ? (wins / games) * 100 : null };
}
