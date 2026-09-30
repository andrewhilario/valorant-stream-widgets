// What we can learn about a player's recent ranked games, to pre-fill the calculators with their own numbers.

import type { MatchSummary } from "./matches";
import type { RankData } from "./rank-types";
import type { HistoryEntry } from "./session";

export type AgentStat = {
  id: string;
  name: string;
  games: number;
  wins: number;
  losses: number;
  /** 0–100, or null before a decided game. */
  winRate: number | null;
  avgMinutes: number;
  /** Average RR gained on a win / lost on a loss, from the RR history, or null if none of those games are in it. */
  avgRrWin: number | null;
  avgRrLoss: number | null;
};

export type Snapshot = {
  account: { name: string; tag: string };
  rank: { tierId: number; tier: string; rr: number };
  /** Ranked games in the RR history. */
  games: number;
  winRate: number | null;
  avgRrWin: number | null;
  avgRrLoss: number | null;
  /** Average match length across the fetched matches, or null if none came back. */
  avgMinutes: number | null;
  agents: AgentStat[];
  /** False when the per-match data couldn't be loaded; the rest of the snapshot is still good. */
  agentsAvailable: boolean;
  fetchedAt: number;
};

const mean = (values: number[]): number | null => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null);
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10);

function isWin(entry: HistoryEntry) {
  return entry.change > 0;
}
function isLoss(entry: HistoryEntry) {
  return entry.change < 0 || (entry.change === 0 && entry.protected);
}

function rrAverages(entries: HistoryEntry[]) {
  return {
    win: mean(entries.filter(isWin).map((e) => e.change)),
    loss: mean(entries.filter(isLoss).map((e) => Math.abs(e.change))),
  };
}

/**
 * `matches` is null when the per-match request failed. Results come from the team result in
 * the match when present, otherwise from the sign of the RR change for the same match.
 */
export function buildSnapshot(rank: RankData, matches: MatchSummary[] | null, now = Date.now()): Snapshot {
  const history = rank.history;
  const decided = history.filter((e) => isWin(e) || isLoss(e));
  const overall = rrAverages(history);
  const wins = history.filter(isWin).length;

  const byMatch = new Map(history.map((e) => [e.id, e]));
  const groups = new Map<string, { name: string; list: MatchSummary[] }>();
  for (const match of matches ?? []) {
    const group = groups.get(match.agent.id) ?? { name: match.agent.name, list: [] };
    group.list.push(match);
    groups.set(match.agent.id, group);
  }

  const agents: AgentStat[] = [...groups.entries()]
    .map(([id, { name, list }]) => {
      let won = 0;
      let lost = 0;
      const joined: HistoryEntry[] = [];
      for (const match of list) {
        const entry = byMatch.get(match.id);
        if (entry) joined.push(entry);
        const result = match.won ?? (entry ? (isWin(entry) ? true : isLoss(entry) ? false : null) : null);
        if (result === true) won++;
        else if (result === false) lost++;
      }
      const avg = rrAverages(joined);
      return {
        id,
        name,
        games: list.length,
        wins: won,
        losses: lost,
        winRate: won + lost > 0 ? (won / (won + lost)) * 100 : null,
        avgMinutes: round1(mean(list.map((m) => m.lengthMs / 60_000))) ?? 0,
        avgRrWin: round1(avg.win),
        avgRrLoss: round1(avg.loss),
      };
    })
    .sort((a, b) => b.games - a.games || a.name.localeCompare(b.name));

  return {
    account: { name: rank.account.name, tag: rank.account.tag },
    rank: { tierId: rank.current.tierId, tier: rank.current.tier, rr: rank.current.rr },
    games: history.length,
    winRate: decided.length ? (wins / decided.length) * 100 : null,
    avgRrWin: round1(overall.win),
    avgRrLoss: round1(overall.loss),
    avgMinutes: matches && matches.length ? round1(mean(matches.map((m) => m.lengthMs / 60_000))) : null,
    agents,
    agentsAvailable: matches !== null,
    fetchedAt: now,
  };
}
