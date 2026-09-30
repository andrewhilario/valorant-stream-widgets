// Turns HenrikDev's responses into our own RankData shape. Kept free of I/O so
// it can be unit-tested against the documented payloads. Written to the v3 MMR
// and v2 MMR-history schemas from docs.henrikdev.xyz.

import type { RankData } from "./rank-types";
import type { HistoryEntry } from "./session";
import { tierName } from "./tiers";

export class ShapeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ShapeError";
  }
}

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

/** ISO string, epoch seconds or epoch milliseconds → ms since the epoch. */
export function parseWhen(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value < 1e12 ? value * 1000 : value;
  if (typeof value === "string") {
    if (/^\d+$/.test(value)) return parseWhen(Number(value));
    const t = Date.parse(value);
    return Number.isNaN(t) ? null : t;
  }
  return null;
}

type Core = Pick<RankData, "account" | "current" | "peak">;

export function normalizeMmr(json: unknown, fallback: { name: string; tag: string }): Core {
  if (!isObj(json) || !isObj(json.data)) throw new ShapeError("MMR response has no data object");
  const data = json.data;

  const current = data.current;
  if (!isObj(current) || !isObj(current.tier)) throw new ShapeError("MMR response has no current tier");

  const tierId = num(current.tier.id);
  const rr = num(current.rr);
  if (tierId === null || rr === null) throw new ShapeError("MMR current tier or RR is not a number");

  const board = isObj(current.leaderboard_placement) ? num(current.leaderboard_placement.rank) : null;

  let peak: Core["peak"] = null;
  if (isObj(data.peak) && isObj(data.peak.tier)) {
    const peakId = num(data.peak.tier.id);
    if (peakId !== null) {
      peak = {
        tierId: peakId,
        tier: str(data.peak.tier.name) ?? tierName(peakId),
        season: isObj(data.peak.season) ? str(data.peak.season.short) : null,
      };
    }
  }

  const account = isObj(data.account) ? data.account : {};

  return {
    account: { name: str(account.name) ?? fallback.name, tag: str(account.tag) ?? fallback.tag, puuid: str(account.puuid) },
    current: {
      tierId,
      tier: str(current.tier.name) ?? tierName(tierId),
      rr,
      elo: num(current.elo) ?? 0,
      lastChange: num(current.last_change) ?? 0,
      gamesNeeded: num(current.games_needed_for_rating) ?? 0,
      shields: num(current.rank_protection_shields) ?? 0,
      leaderboardRank: board,
    },
    peak,
  };
}

/** Bad entries are skipped rather than failing the whole lookup. */
export function normalizeHistory(json: unknown): HistoryEntry[] {
  if (!isObj(json) || !isObj(json.data) || !Array.isArray(json.data.history)) {
    throw new ShapeError("MMR history response has no history array");
  }

  const out: HistoryEntry[] = [];
  for (const raw of json.data.history) {
    if (!isObj(raw)) continue;
    const at = parseWhen(raw.date);
    const change = num(raw.last_change);
    const id = str(raw.match_id);
    if (at === null || change === null || id === null) continue;
    out.push({
      id,
      at,
      change,
      rr: num(raw.rr) ?? 0,
      tierId: isObj(raw.tier) ? (num(raw.tier.id) ?? 0) : 0,
      protected: raw.was_derank_protected === true,
    });
  }
  return out;
}
