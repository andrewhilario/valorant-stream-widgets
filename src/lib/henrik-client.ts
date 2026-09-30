// Runs in the browser: OBS's Browser Source, or the editor's preview. The
// streamer's own HenrikDev key goes straight from there to HenrikDev, so it
// never passes through this site's server, and every streamer has their own
// rate limit instead of sharing one. HenrikDev allows browser requests
// (access-control-allow-origin: * and the Authorization header).

import { normalizeHistory, normalizeMmr, ShapeError } from "./henrik-normalize";
import { normalizeMatches } from "./matches";
import type { RankData, RankError, RankErrorCode, RankResponse } from "./rank-types";
import type { Platform, Region } from "./riot";
import { buildSnapshot, type Snapshot } from "./snapshot";

const BASE = "https://api.henrikdev.xyz";
const TIMEOUT_MS = 10_000;

export type Lookup = { region: Region; platform: Platform; name: string; tag: string; key: string };

/** Loose on purpose: a real key starts with HDEV- and has no spaces. HenrikDev decides the rest. */
export function looksLikeKey(value: string): boolean {
  return /^HDEV-[0-9A-Za-z-]{16,}$/.test(value.trim());
}

const MESSAGES: Record<RankErrorCode, string> = {
  bad_request: "That lookup isn't valid. Check the Riot ID and region.",
  not_found: "Couldn't find that account. Check the name, tag and region.",
  rate_limited: "Your key has reached its rate limit. The widget keeps its last numbers and tries again shortly.",
  no_key: "Add your HenrikDev key to look up your rank.",
  bad_key: "HenrikDev rejected that key. Check it, or create a new one in the dashboard.",
  upstream: "The data service didn't answer. The widget keeps its last numbers and tries again shortly.",
  upstream_shape: "The data service returned something unexpected.",
};

export const fail = (code: RankErrorCode, retryAfter?: number): RankError => ({
  ok: false,
  code,
  message: MESSAGES[code],
  ...(retryAfter ? { retryAfter } : {}),
});

type Raw = { status: number; json: unknown; retryAfter?: number };

async function get(path: string, key: string, outer?: AbortSignal): Promise<Raw> {
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), TIMEOUT_MS);
  const forward = () => timeout.abort();
  outer?.addEventListener("abort", forward);

  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { Authorization: key, Accept: "application/json" },
      signal: timeout.signal,
      cache: "no-store",
    });

    // HenrikDev exposes its rate-limit headers to browsers; seconds until the window resets.
    const reset = res.headers.get("ratelimit-reset") ?? res.headers.get("x-ratelimit-reset");
    const retryAfter = reset && /^\d+$/.test(reset) ? Number(reset) : undefined;

    let json: unknown = null;
    try {
      json = await res.json();
    } catch {
      // Non-JSON body: the status alone decides.
    }
    return { status: res.status, json, retryAfter };
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", forward);
  }
}

function codeFor(status: number): RankErrorCode {
  if (status === 401 || status === 403) return "bad_key";
  if (status === 404) return "not_found";
  if (status === 400) return "bad_request";
  if (status === 429) return "rate_limited";
  return "upstream";
}

/**
 * One rank lookup: current rank and recent history, two requests.
 * Resolves with a typed error for anything the service said; rejects only when the
 * network itself failed (or the caller aborted), so callers can tell "offline" apart.
 */
export async function fetchRank(lookup: Lookup, signal?: AbortSignal): Promise<RankResponse> {
  const key = lookup.key.trim();
  if (!key) return fail("no_key");
  if (!looksLikeKey(key)) return fail("bad_key");

  const { region, platform, name, tag } = lookup;
  const who = `${region}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;

  try {
    const [mmr, history] = await Promise.all([
      get(`/valorant/v3/mmr/${who}`, key, signal),
      get(`/valorant/v2/mmr-history/${who}`, key, signal),
    ]);

    if (mmr.status !== 200) return fail(codeFor(mmr.status), mmr.retryAfter);

    const core = normalizeMmr(mmr.json, { name, tag });

    let partial = false;
    let entries: RankData["history"] = [];
    if (history.status === 200) {
      try {
        entries = normalizeHistory(history.json);
      } catch {
        partial = true;
      }
    } else {
      partial = true;
    }

    return { ok: true, fetchedAt: Date.now(), ...(partial ? { partial } : {}), ...core, history: entries };
  } catch (err) {
    if (signal?.aborted) throw err;
    if (err instanceof ShapeError) return fail("upstream_shape");
    // Our own timeout fired: the service was too slow. A TypeError means no network.
    if (err instanceof DOMException && err.name === "AbortError") return fail("upstream");
    throw err;
  }
}

export type SnapshotResponse = { ok: true; snapshot: Snapshot } | RankError;

/** How many recent ranked matches to read for the per-agent numbers. */
const MATCH_COUNT = 10;

/**
 * The calculators' "use my games" lookup: rank, RR history and the last few ranked matches,
 * three requests in parallel. Only the rank request decides success. If the matches request
 * fails for any reason the snapshot still comes back, marked as having no per-agent data.
 */
export async function fetchSnapshot(lookup: Lookup, signal?: AbortSignal): Promise<SnapshotResponse> {
  const key = lookup.key.trim();
  if (!key) return fail("no_key");
  if (!looksLikeKey(key)) return fail("bad_key");

  const { region, platform, name, tag } = lookup;
  const who = `${region}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;

  const matchesRequest = get(`/valorant/v4/matches/${who}?mode=competitive&size=${MATCH_COUNT}`, key, signal).catch(
    (err: unknown) => {
      if (signal?.aborted) throw err;
      return null;
    },
  );

  const [rank, raw] = await Promise.all([fetchRank(lookup, signal), matchesRequest]);
  if (!rank.ok) return rank;

  const matches = raw && raw.status === 200 ? normalizeMatches(raw.json, rank.account) : null;
  return { ok: true, snapshot: buildSnapshot(rank, matches) };
}
