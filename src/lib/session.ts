// A "session" is worked out from match history each time, so there is nothing
// to reset and nothing that can be lost when OBS restarts.

export type HistoryEntry = {
  id: string;
  /** When the game ended, in ms since the epoch. */
  at: number;
  /** RR gained (positive) or lost (negative). */
  change: number;
  /** RR after the game. */
  rr: number;
  tierId: number;
  /** A loss that derank protection turned into 0 RR. */
  protected: boolean;
};

export type SessionMode = "auto" | "today" | "window";

export type SessionOptions = {
  mode: SessionMode;
  /** Auto: a gap longer than this many hours ends the session. */
  gapHours: number;
  /** Window: count games from the last this many hours. */
  windowHours: number;
  now: number;
};

export type SessionStats = {
  games: number;
  wins: number;
  losses: number;
  gained: number;
  lost: number;
  net: number;
  /** 0–100, or null before the first decided game. */
  winRate: number | null;
};

const HOUR = 3_600_000;

export const EMPTY_SESSION: SessionStats = {
  games: 0,
  wins: 0,
  losses: 0,
  gained: 0,
  lost: 0,
  net: 0,
  winRate: null,
};

function pick(history: HistoryEntry[], opts: SessionOptions): HistoryEntry[] {
  const sorted = history.filter((e) => Number.isFinite(e.at)).sort((a, b) => b.at - a.at);

  if (opts.mode === "today") {
    const midnight = new Date(opts.now);
    midnight.setHours(0, 0, 0, 0);
    return sorted.filter((e) => e.at >= midnight.getTime() && e.at <= opts.now + HOUR);
  }

  if (opts.mode === "window") {
    const from = opts.now - opts.windowHours * HOUR;
    return sorted.filter((e) => e.at >= from && e.at <= opts.now + HOUR);
  }

  // auto: the latest unbroken run of games — and only while it is still "live".
  const gap = opts.gapHours * HOUR;
  if (sorted.length === 0 || opts.now - sorted[0].at > gap) return [];

  const run: HistoryEntry[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i - 1].at - sorted[i].at > gap) break;
    run.push(sorted[i]);
  }
  return run;
}

export function computeSession(history: HistoryEntry[], opts: SessionOptions): SessionStats {
  const games = pick(history, opts);
  if (games.length === 0) return EMPTY_SESSION;

  let wins = 0;
  let losses = 0;
  let gained = 0;
  let lost = 0;

  for (const game of games) {
    if (game.change > 0) {
      wins += 1;
      gained += game.change;
    } else if (game.change < 0) {
      losses += 1;
      lost += -game.change;
    } else if (game.protected) {
      losses += 1;
    }
  }

  const decided = wins + losses;
  return {
    games: games.length,
    wins,
    losses,
    gained,
    lost,
    net: gained - lost,
    winRate: decided > 0 ? (wins / decided) * 100 : null,
  };
}
