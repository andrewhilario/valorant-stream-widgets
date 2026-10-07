"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchAgents, type Agent } from "@/lib/agents";
import { looksLikeKey } from "@/lib/henrik-client";
import { cumulativeMp, mpForLevel, mpPerMatch } from "@/lib/mastery";
import { normalizeMatches, type Me } from "@/lib/matches";
import type { PreviewStatus } from "@/lib/preview";
import { parseRiotId, type Platform, type Region } from "@/lib/riot";
import type { MasteryData, MasteryMatch, MasteryStart } from "./mastery-types";
import { addMatches, countedList, loadSession, saveSession, sessionKey, type Session } from "./session";
import { sampleMastery, type MasterySampleVariant } from "./sample";

export type MasteryDataStatus = PreviewStatus;

type Options = {
  riotId: string;
  region: Region;
  platform: Platform;
  apiKey: string;
  agentId: string;
  agentName: string;
  currentLevel: number;
  mpIntoLevel: number;
  targetLevel: number;
  bonusPct: number;
  refresh: number;
  sample: false | MasterySampleVariant;
  debounceMs?: number;
};

const BASE = "https://api.henrikdev.xyz";
const TIMEOUT_MS = 10_000;
const MAX_BACKOFF_SECONDS = 300;

function backoff(errors: number, refresh: number, retryAfter?: number): number {
  const base = Math.max(30, refresh, retryAfter ?? 0);
  return Math.min(MAX_BACKOFF_SECONDS, base * 2 ** Math.min(errors - 1, 3));
}

/** Calculate Mastery Points earned in one match according to Patch 13.06 rules. */
export function calculateMatchMp(lengthMs: number, won: boolean | null, bonusPct = 0): number {
  const seconds = Math.max(0, lengthMs / 1000);
  const baseMp = seconds * (4 / 3); // 80 MP per minute
  const winMultiplier = won === true ? 1.3 : 1.0;
  const bonus = 1 + Math.max(0, bonusPct) / 100;
  return Math.round(baseMp * winMultiplier * bonus);
}

/**
 * Builds a MasteryData object from a starting state and a list of detected matches.
 */
export function computeMasteryState(start: MasteryStart, matches: MasteryMatch[]): MasteryData {
  const safeCurrent = Math.max(0, Math.min(29, Math.floor(start.currentLevel)));
  const maxMpForCurrent = mpForLevel(safeCurrent + 1);
  const safeMpInto = Math.max(0, Math.min(maxMpForCurrent - 1, Math.floor(start.mpIntoLevel)));
  const startingMp = cumulativeMp(safeCurrent) + safeMpInto;

  const sessionMp = matches.reduce((sum, m) => sum + m.mpEarned, 0);
  const totalMp = startingMp + sessionMp;

  let level = 0;
  while (level < 30 && cumulativeMp(level + 1) <= totalMp) {
    level++;
  }

  const mpIntoCurrentLevel = totalMp - cumulativeMp(level);
  const mpForNextLevel = mpForLevel(level + 1);
  const targetLevel = Math.max(level + 1, Math.floor(start.targetLevel));
  const remainingMp = Math.max(0, cumulativeMp(targetLevel) - totalMp);

  // Standard match forecast (33 min typical match length, 50% win rate)
  const avgMp = mpPerMatch(33, 50, start.bonusPct).average;
  const matchesRemaining = remainingMp > 0 ? Math.ceil(remainingMp / avgMp) : 0;
  const hoursRemaining = remainingMp > 0 ? (matchesRemaining * 33) / 60 : 0;

  return {
    start: {
      ...start,
      currentLevel: safeCurrent,
      mpIntoLevel: safeMpInto,
      targetLevel,
    },
    startingMp,
    sessionMp,
    totalMp,
    currentLevel: level,
    mpIntoCurrentLevel,
    mpForNextLevel,
    matches,
    levelsGained: Math.max(0, level - safeCurrent),
    targetReached: level >= targetLevel,
    matchesRemaining,
    hoursRemaining,
  };
}

/** The counted matches as the widget shows them: MP worked out from each one's length and result, with the bonus you set. */
export function toMasteryMatches(session: Session, bonusPct: number): MasteryMatch[] {
  return countedList(session).map((m) => ({
    id: m.id,
    at: m.endedAt,
    won: m.won,
    durationMinutes: Math.round((m.lengthMs / 60000) * 10) / 10,
    mpEarned: calculateMatchMp(m.lengthMs, m.won, bonusPct),
  }));
}

function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null; // blocked or unavailable: the count then lives as long as the page does
  }
}

export function useMasteryData({
  riotId,
  region,
  platform,
  apiKey,
  agentId,
  agentName,
  currentLevel,
  mpIntoLevel,
  targetLevel,
  bonusPct,
  refresh,
  sample,
  debounceMs = 0,
}: Options) {
  const target = useMemo(() => parseRiotId(riotId), [riotId]);
  const key = apiKey.trim();
  const identity = !sample && target && looksLikeKey(key) ? `${region}|${platform}|${target.name}|${target.tag}|${key}` : "";

  const [matches, setMatches] = useState<MasteryMatch[]>([]);
  const [status, setStatus] = useState<MasteryDataStatus>({ state: sample ? "sample" : "idle" });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const startConfig = useMemo<MasteryStart>(
    () => ({
      agentId,
      agentName: agentName || "Agent",
      currentLevel: Number(currentLevel) || 0,
      mpIntoLevel: Number(mpIntoLevel) || 0,
      targetLevel: Number(targetLevel) || 10,
      bonusPct: Number(bonusPct) || 0,
    }),
    [agentId, agentName, currentLevel, mpIntoLevel, targetLevel, bonusPct],
  );

  const sampleData = useMemo(() => (sample ? sampleMastery(Date.now(), sample) : null), [sample]);

  useEffect(() => {
    if (sample) {
      setStatus({ state: "sample" });
      return;
    }

    if (!identity || !target) {
      setMatches([]);
      setStatus({ state: "idle" });
      return;
    }

    // What has been counted so far for this starting point (see session.ts), kept in this browser's storage: a reload keeps the
    // total, a match dropping out of HenrikDev's list of ten doesn't take its MP with it, and games played before the overlay
    // was opened are not counted again. The API key is never part of the storage key.
    const store = safeStorage();
    const storeKey = sessionKey({ riotId: `${target.name}#${target.tag}`, region, platform, agentId, agentName, currentLevel, mpIntoLevel });
    let session: Session = loadSession(store, storeKey, Date.now());
    setMatches(toMasteryMatches(session, bonusPct));

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | undefined;
    let errors = 0;
    let lastOkAt = 0;

    const schedule = (seconds: number) => {
      if (!cancelled) timer = setTimeout(run, seconds * 1000);
    };

    async function run() {
      if (cancelled || !target) return;
      if (document.hidden) return schedule(10);

      controller = new AbortController();
      const outerTimeout = setTimeout(() => controller?.abort(), TIMEOUT_MS);

      try {
        const who = `${region}/${platform}/${encodeURIComponent(target.name)}/${encodeURIComponent(target.tag)}`;
        const res = await fetch(`${BASE}/valorant/v4/matches/${who}?size=10`, {
          headers: { Authorization: key, Accept: "application/json" },
          signal: controller.signal,
          cache: "no-store",
        });

        clearTimeout(outerTimeout);
        if (cancelled) return;

        if (res.ok) {
          const json = await res.json();
          const me: Me = { name: target.name, tag: target.tag };
          const next = addMatches(session, normalizeMatches(json, me), { agentId, agentName });
          if (next.added > 0) {
            session = next.session;
            saveSession(store, storeKey, session);
            setMatches(toMasteryMatches(session, bonusPct));
          }

          errors = 0;
          lastOkAt = Date.now();
          setNow(Date.now());
          setStatus({ state: "live", updatedAt: Date.now(), partial: false });
          schedule(refresh);
        } else {
          errors += 1;
          const retryAfterHeader = res.headers.get("ratelimit-reset");
          const retryAfter = retryAfterHeader && /^\d+$/.test(retryAfterHeader) ? Number(retryAfterHeader) : undefined;
          setStatus({
            state: "error",
            code: res.status === 429 ? "rate_limited" : res.status === 401 ? "bad_key" : "upstream",
            message: "Data lookup paused; keeping current progress.",
            retryAfter,
          });
          schedule(backoff(errors, refresh, retryAfter));
        }
      } catch (err) {
        clearTimeout(outerTimeout);
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        errors += 1;
        setStatus({
          state: "error",
          code: "network",
          message: "Couldn't reach match service. Retrying shortly.",
        });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [identity, sample, refresh, debounceMs, agentId, agentName, bonusPct, currentLevel, mpIntoLevel]);

  const liveData = useMemo(() => computeMasteryState(startConfig, matches), [startConfig, matches]);

  return {
    data: sample ? sampleData : liveData,
    status,
    now,
  };
}

let agentMapPromise: Promise<Record<string, Agent>> | null = null;

async function loadAgentMap(): Promise<Record<string, Agent>> {
  try {
    const list = await fetchAgents();
    const map: Record<string, Agent> = {};
    for (const a of list) {
      map[a.id] = a;
      map[a.name.toLowerCase()] = a;
    }
    return map;
  } catch {
    agentMapPromise = null;
    return {};
  }
}

/** Cache and return agent portraits keyed by uuid and lowercase name. */
export function useAgentMap(): Record<string, Agent> {
  const [agents, setAgents] = useState<Record<string, Agent>>({});
  useEffect(() => {
    let alive = true;
    (agentMapPromise ??= loadAgentMap()).then((map) => {
      if (alive) setAgents(map);
    });
    return () => {
      alive = false;
    };
  }, []);
  return agents;
}
