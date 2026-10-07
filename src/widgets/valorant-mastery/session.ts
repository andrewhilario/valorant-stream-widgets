// Which matches the Mastery overlay adds to your numbers, and how it remembers them.
//
// You type your Act Level and the MP the game shows, then open the overlay. From then on it adds every match that FINISHES after
// that moment, on the agent you picked. It keeps what it has counted in the storage of the browser that runs it, so:
//   - a reload (OBS restarting the page) doesn't lose your total or add anything twice;
//   - HenrikDev only lists your last ten matches, and a match dropping off that list doesn't take its MP with it;
//   - games you played before opening the overlay are not counted again (the numbers you typed already include them).
// Typing different starting numbers (or choosing another agent or account) starts a new count.

import type { MatchSummary } from "@/lib/matches";

/** One match that was added: when it ended, how long it ran, whether you won. The MP is worked out from these when shown. */
export type CountedMatch = { id: string; endedAt: number; lengthMs: number; won: boolean };

export type Session = {
  /** When the overlay was first opened for this starting point (ms since the epoch). Only matches that end after it count. */
  openedAt: number;
  matches: Record<string, CountedMatch>;
};

/** What the starting point is made of. The API key is deliberately not here: it never goes near storage. */
export type StartPoint = {
  riotId: string;
  region: string;
  platform: string;
  agentId: string;
  agentName: string;
  currentLevel: number;
  mpIntoLevel: number;
};

export type Tracked = { agentId: string; agentName: string };

type Store = Pick<Storage, "getItem" | "setItem">;

const PREFIX = "tally:mastery:v1:";
/** More than a few dozen matches in one count would be a very long grind; the oldest are forgotten past this. */
const KEEP = 200;

/** A short, stable fingerprint of a string (not a secret and not cryptographic: it only names a storage entry). */
function fingerprint(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h << 5) + h + text.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

/** The storage entry for a starting point. Changing any part of it (level, MP, agent, account) means a new count. */
export function sessionKey(start: StartPoint): string {
  const agent = start.agentId.trim() || start.agentName.trim().toLowerCase();
  const parts = [start.riotId.trim().toLowerCase(), start.region, start.platform, agent, start.currentLevel, start.mpIntoLevel];
  return PREFIX + fingerprint(parts.join("|"));
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

/** Reads a saved count, or starts a new one at `now`. A missing, broken or unreadable store just means a new count. */
export function loadSession(store: Store | null, key: string, now: number): Session {
  try {
    const raw = store?.getItem(key);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      if (isRecord(parsed) && finite(parsed.openedAt) && isRecord(parsed.matches)) {
        const matches: Record<string, CountedMatch> = {};
        for (const [id, value] of Object.entries(parsed.matches)) {
          if (isRecord(value) && finite(value.endedAt) && finite(value.lengthMs) && typeof value.won === "boolean") {
            matches[id] = { id, endedAt: value.endedAt, lengthMs: value.lengthMs, won: value.won };
          }
        }
        return { openedAt: parsed.openedAt, matches };
      }
    }
  } catch {
    // fall through to a fresh count
  }
  const fresh: Session = { openedAt: now, matches: {} };
  saveSession(store, key, fresh);
  return fresh;
}

export function saveSession(store: Store | null, key: string, session: Session): void {
  try {
    const kept = Object.values(session.matches)
      .sort((a, b) => b.endedAt - a.endedAt)
      .slice(0, KEEP);
    const matches: Record<string, CountedMatch> = {};
    for (const m of kept) matches[m.id] = m;
    store?.setItem(key, JSON.stringify({ openedAt: session.openedAt, matches }));
  } catch {
    // Storage can be full or blocked. The count then lives only as long as the page does.
  }
}

/** Is this match on the agent being tracked? With no agent chosen, every match counts. */
export function isTracked(match: MatchSummary, tracked: Tracked): boolean {
  if (tracked.agentId) return match.agent.id === tracked.agentId;
  if (tracked.agentName) return match.agent.name.toLowerCase() === tracked.agentName.toLowerCase();
  return true;
}

/**
 * Adds the matches from a fresh look at HenrikDev's list that are new and that count. A match counts when it is on the tracked
 * agent, we know when it started, and it ENDED after the overlay was opened (so one that was still being played when the overlay
 * opened counts, and one that finished before it does not, even if HenrikDev lists it a minute late). Matches already counted
 * are left alone. Returns the same object when nothing was added.
 */
export function addMatches(session: Session, summaries: MatchSummary[], tracked: Tracked): { session: Session; added: number } {
  let matches: Record<string, CountedMatch> | null = null;
  let added = 0;
  for (const m of summaries) {
    if (session.matches[m.id] || (matches && matches[m.id])) continue;
    if (!isTracked(m, tracked) || m.startedAt === null) continue;
    const endedAt = m.startedAt + m.lengthMs;
    if (endedAt < session.openedAt) continue;
    matches ??= { ...session.matches };
    // A result the payload did not give counts as a loss: it still earned the base MP, only the win bonus is left out.
    matches[m.id] = { id: m.id, endedAt, lengthMs: m.lengthMs, won: m.won === true };
    added++;
  }
  return matches ? { session: { ...session, matches }, added } : { session, added: 0 };
}

/** The matches of a count, oldest first. */
export function countedList(session: Session): CountedMatch[] {
  return Object.values(session.matches).sort((a, b) => a.endedAt - b.endedAt);
}
