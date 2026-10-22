"use client";

import { useEffect, useMemo, useState } from "react";
import type { CurrentAct } from "@/lib/act-record";
import { fetchKd, fetchRank } from "@/lib/henrik-client";
import type { PreviewStatus } from "@/lib/preview";
import type { KdSummary, RankData } from "@/lib/rank-types";
import { fetchCurrentAct } from "@/lib/seasons";
import { parseRiotId, type Platform, type Region } from "@/lib/riot";
import { fetchTierIcons } from "@/lib/tier-icons";
import { SAMPLE_ACT, SAMPLE_KD, sampleRank, type SampleVariant } from "./sample";

export type DataStatus = PreviewStatus;

type Options = {
  riotId: string;
  region: Region;
  platform: Platform;
  /** The streamer's own HenrikDev key. Never logged, never sent anywhere but HenrikDev. */
  apiKey: string;
  /** Seconds between lookups. */
  refresh: number;
  /** Use invented numbers instead of a lookup. */
  sample: false | SampleVariant;
  /** Wait this long after the inputs change before the first lookup (typing). */
  debounceMs?: number;
  /** The Full layout shows a K/D from the last ranked games: one more request every few minutes, only when asked for. */
  kd?: boolean;
  /** The Full layout names the Act and counts this Act's record: it needs to know which Act is running. */
  act?: boolean;
};

const MAX_BACKOFF_SECONDS = 300;
/** The K/D is over the last ten games, which change slowly, and every lookup counts against the streamer's own key: ask again every three minutes. */
const KD_EVERY_MS = 3 * 60_000;

function backoff(errors: number, refresh: number, retryAfter?: number): number {
  const base = Math.max(30, refresh, retryAfter ?? 0);
  return Math.min(MAX_BACKOFF_SECONDS, base * 2 ** Math.min(errors - 1, 3));
}

/**
 * Polls HenrikDev with the streamer's key. On failure it keeps showing the last
 * good numbers — the audience never sees an error — and backs off. Diagnostics
 * go to `status` for the editor to show the streamer.
 */
export function useRankData({ riotId, region, platform, apiKey, refresh, sample, debounceMs = 0, kd: wantKd = false, act: wantAct = false }: Options) {
  const target = useMemo(() => parseRiotId(riotId), [riotId]);
  const key = apiKey.trim();
  // The lookup identity. It includes the key so changing the key looks again; it is never rendered or logged.
  const identity = !sample && target && key ? `${region}|${platform}|${target.name}|${target.tag}|${key}` : "";

  const [data, setData] = useState<RankData | null>(null);
  const [status, setStatus] = useState<DataStatus>({ state: sample ? "sample" : "idle" });
  const [now, setNow] = useState(() => Date.now());
  const [kd, setKd] = useState<KdSummary | null>(null);
  const [act, setAct] = useState<CurrentAct | null>(null);

  // Which Act is running comes from a public list, not the streamer's key.
  useEffect(() => {
    if (!wantAct || sample) return;
    let alive = true;
    void fetchCurrentAct().then((found) => alive && setAct(found));
    return () => {
      alive = false;
    };
  }, [wantAct, sample]);

  // Keep "now" fresh so auto-sessions expire and "today" rolls over at midnight.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const sampleData = useMemo(() => (sample ? sampleRank(Date.now(), sample) : null), [sample]);

  useEffect(() => {
    setData(null);
    setKd(null);

    if (sample) {
      setStatus({ state: "sample" });
      return;
    }
    if (!identity || !target) {
      setStatus({ state: "idle" });
      return;
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let errors = 0;
    let lastOkAt = 0;
    let lastKdAt = 0;

    /** The K/D rides along with a good lookup, at most every KD_EVERY_MS. A failure keeps the last number and tries again at the next lookup. */
    async function loadKd(rank: RankData) {
      if (!target || !wantKd || Date.now() - lastKdAt < KD_EVERY_MS) return;
      lastKdAt = Date.now();
      try {
        const out = await fetchKd(
          { region, platform, name: target.name, tag: target.tag, key },
          { name: rank.account.name, tag: rank.account.tag, puuid: rank.account.puuid },
          controller?.signal,
        );
        if (cancelled) return;
        if (out.ok) setKd(out.kd);
        else lastKdAt = Date.now() - KD_EVERY_MS + 60_000; // not this time: try again in a minute
      } catch {
        lastKdAt = Date.now() - KD_EVERY_MS + 60_000;
      }
    }

    const schedule = (seconds: number) => {
      if (!cancelled) timer = setTimeout(run, seconds * 1000);
    };

    async function run() {
      if (cancelled || !target) return;
      // A hidden source doesn't need fresh numbers; look again shortly.
      if (document.hidden) return schedule(10);

      controller = new AbortController();
      try {
        const result = await fetchRank({ region, platform, name: target.name, tag: target.tag, key }, controller.signal);
        if (cancelled) return;

        if (result.ok) {
          errors = 0;
          lastOkAt = Date.now();
          setData(result);
          setNow(Date.now());
          setStatus({ state: "live", updatedAt: result.fetchedAt, partial: Boolean(result.partial) });
          void loadKd(result);
          schedule(refresh);
        } else {
          errors += 1;
          setStatus({ state: "error", code: result.code, message: result.message, retryAfter: result.retryAfter });
          schedule(backoff(errors, refresh, result.retryAfter));
        }
      } catch (err) {
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        errors += 1;
        setStatus({ state: "error", code: "network", message: "Couldn't reach the data service. Check your connection." });
        schedule(backoff(errors, refresh));
      }
    }

    const onVisible = () => {
      if (document.hidden || cancelled) return;
      if (Date.now() - lastOkAt > refresh * 1000) {
        if (timer) clearTimeout(timer);
        void run();
      }
    };
    document.addEventListener("visibilitychange", onVisible);

    setStatus({ state: "loading" });
    timer = setTimeout(run, debounceMs);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `identity` covers region, platform, name, tag and key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, sample, refresh, debounceMs, wantKd]);

  return { data: sample ? sampleData : data, status, now, kd: sample ? SAMPLE_KD : kd, act: sample ? SAMPLE_ACT : act };
}

let iconsPromise: Promise<Record<string, string>> | null = null;

async function loadIcons(): Promise<Record<string, string>> {
  try {
    return await fetchTierIcons();
  } catch {
    iconsPromise = null; // try again on the next mount
    return {};
  }
}

/** Official rank badge art, keyed by tier id. Empty until loaded — the widget has a drawn fallback. */
export function useTierIcons(): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    (iconsPromise ??= loadIcons()).then((map) => {
      if (alive) setIcons(map);
    });
    return () => {
      alive = false;
    };
  }, []);
  return icons;
}
