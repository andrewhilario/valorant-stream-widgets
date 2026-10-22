import type { HistoryEntry } from "./session";

/** How a player did in one season (an Act): the wins and games HenrikDev reports for it. */
export type SeasonResult = { id: string; short: string | null; wins: number; games: number };

/** The kills and deaths in the last few ranked games, as one K/D (deaths 0 counts as the kills); null before any game with both numbers. */
export type KdSummary = { value: number | null; games: number };

/** One successful lookup, independent of the upstream schema. */
export type RankData = {
  ok: true;
  /** When this was fetched, ms since the epoch. */
  fetchedAt: number;
  /** History could not be loaded; current rank is still good. */
  partial?: boolean;
  account: { name: string; tag: string; puuid: string | null };
  current: {
    tierId: number;
    tier: string;
    rr: number;
    elo: number;
    lastChange: number;
    gamesNeeded: number;
    shields: number;
    leaderboardRank: number | null;
  };
  peak: { tierId: number; tier: string; season: string | null } | null;
  history: HistoryEntry[];
  /** The wins and games in each season the lookup lists, for the Full layout's Act record. Absent in data made before it was read. */
  seasons?: SeasonResult[];
};

export type RankErrorCode =
  | "bad_request"
  | "not_found"
  | "rate_limited"
  /** No key supplied. */
  | "no_key"
  /** HenrikDev rejected the key. */
  | "bad_key"
  | "upstream"
  | "upstream_shape";

export type RankError = {
  ok: false;
  code: RankErrorCode;
  message: string;
  /** Seconds to wait before asking again, when the service said. */
  retryAfter?: number;
};

export type RankResponse = RankData | RankError;
