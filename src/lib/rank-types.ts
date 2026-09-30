import type { HistoryEntry } from "./session";

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
