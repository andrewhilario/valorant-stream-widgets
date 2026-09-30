// Valorant Agent Mastery (Patch 13.06, 22 September 2026). The Mastery Point rule, the level costs, the
// modes and the reward costs come from Riot's VALORANT Wiki page for Agent Mastery; the Portrait Accent
// levels and Overleveling come from Riot's Patch 13.06 notes. Riot hasn't published how much
// Performance Score adds, so that is an input, never a built-in.

export const MASTERY_SOURCE = {
  patch: "13.06",
  released: "22 September 2026",
  /** When these numbers were last compared with the sources below. */
  checked: "30 September 2026",
  wiki: { name: "VALORANT Wiki: Agent Mastery", url: "https://wiki.playvalorant.com/en-us/Agent_Mastery" },
  notes: { name: "VALORANT Patch Notes 13.06", url: "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-06/" },
} as const;

/** MP to go from level n-1 to level n, for Act Levels 1–14. */
const LEVEL_MP = [2_000, 8_500, 9_300, 10_500, 12_000, 13_800, 15_800, 17_900, 20_100, 22_500, 35_000, 78_000, 205_000, 418_000];

/** Every Act Level from 15 on costs this much. */
export const FLAT_LEVEL_MP = 715_000;
/** Act Levels 1–10 are the main track; past 10 is Overleveling. */
export const MAIN_LEVELS = 10;
export const MAX_LEVEL = 30;
/** Portrait Accents unlock at these Act Levels. */
export const PORTRAIT_ACCENT_LEVELS = [4, 7, 10] as const;

/** Base MP is seconds played × 4/3, which is 80 a minute. */
export const MP_PER_SECOND = 4 / 3;
/** Winning the match multiplies it by this. */
export const WIN_MULTIPLIER = 1.3;

/** MP to go from level n-1 to level n (n ≥ 1). */
export function mpForLevel(level: number): number {
  if (level < 1) return 0;
  return level <= LEVEL_MP.length ? LEVEL_MP[level - 1] : FLAT_LEVEL_MP;
}

/** Total MP to reach a level from zero. Level 0 is 0. */
export function cumulativeMp(level: number): number {
  let total = 0;
  for (let n = 1; n <= level; n++) total += mpForLevel(n);
  return total;
}

export type LevelRow = { level: number; mp: number; cumulative: number };

/** Rows for the published table: levels 1–14, each with its own cost. */
export function levelRows(): LevelRow[] {
  return LEVEL_MP.map((mp, i) => ({ level: i + 1, mp, cumulative: cumulativeMp(i + 1) }));
}

export type MpPerMatch = { win: number; loss: number; average: number };

/**
 * MP for one match, before Performance Score. `bonusPct` is whatever extra you believe
 * your matches earn from it; it defaults to none.
 */
export function mpPerMatch(minutes: number, winRate: number, bonusPct = 0): MpPerMatch {
  const base = Math.max(0, minutes) * 60 * MP_PER_SECOND;
  const bonus = 1 + Math.max(0, bonusPct) / 100;
  const win = base * WIN_MULTIPLIER * bonus;
  const loss = base * bonus;
  const w = Math.min(100, Math.max(0, winRate)) / 100;
  return { win, loss, average: w * win + (1 - w) * loss };
}

/**
 * Matches to earn `remainingMp` when each match lasts `minutes`. The epsilon keeps an exact division from
 * rounding up a whole match on floating-point dust.
 */
export function matchesNeeded(remainingMp: number, minutes: number, winRate: number, bonusPct = 0): number {
  return Math.ceil(remainingMp / mpPerMatch(minutes, winRate, bonusPct).average - 1e-9);
}

export type MasteryInput = {
  /** The Act Level you have reached (0 if none). */
  currentLevel: number;
  /** Progress toward the next level, in MP. */
  mpIntoLevel: number;
  /** The Act Level you want. */
  targetLevel: number;
  /** Average match length. */
  minutes: number;
  /** 0–100. */
  winRate: number;
  /** Extra MP from Performance Score, as a percentage. */
  bonusPct: number;
  /** How much you play, for the calendar estimate. 0 or less skips it. */
  hoursPerDay: number;
};

export type MasteryForecast =
  | {
      ok: true;
      remainingMp: number;
      perMatch: MpPerMatch;
      matches: number;
      hours: number;
      /** Calendar days at `hoursPerDay`, or null when that wasn't given. */
      days: number | null;
      levelsGained: number;
    }
  | { ok: false; reason: "no-match-time" | "already-there" };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

/** Bring raw field values into a sensible range before forecasting. */
export function normaliseMastery(input: MasteryInput): MasteryInput {
  const currentLevel = clamp(Math.floor(input.currentLevel), 0, MAX_LEVEL - 1);
  const into = clamp(Math.floor(input.mpIntoLevel), 0, mpForLevel(currentLevel + 1) - 1);
  return {
    ...input,
    currentLevel,
    mpIntoLevel: into,
    targetLevel: clamp(Math.floor(input.targetLevel), currentLevel + 1, MAX_LEVEL),
  };
}

export function forecastMastery(raw: MasteryInput): MasteryForecast {
  const input = normaliseMastery(raw);
  if (input.minutes <= 0) return { ok: false, reason: "no-match-time" };

  const total = cumulativeMp(input.currentLevel) + input.mpIntoLevel;
  const remainingMp = cumulativeMp(input.targetLevel) - total;
  if (remainingMp <= 0) return { ok: false, reason: "already-there" };

  const perMatch = mpPerMatch(input.minutes, input.winRate, input.bonusPct);
  const matches = matchesNeeded(remainingMp, input.minutes, input.winRate, input.bonusPct);
  const hours = (matches * input.minutes) / 60;

  return {
    ok: true,
    remainingMp,
    perMatch,
    matches,
    hours,
    days: input.hoursPerDay > 0 ? hours / input.hoursPerDay : null,
    levelsGained: input.targetLevel - input.currentLevel,
  };
}

export type Reward = { name: string; /** Kingdom Credits to claim it. */ credits: number };
export type Milestone = { level: number; rewards: Reward[] };

/**
 * Lifetime Level rewards, each with the Kingdom Credits it costs to claim, as listed on the wiki. Ranges and totals
 * are worked out from these rather than typed in a second time.
 */
export const REWARD_MILESTONES: Milestone[] = [
  {
    level: 5,
    rewards: [
      { name: "Spray", credits: 4_000 },
      { name: "Player title", credits: 2_500 },
      { name: "Player card", credits: 4_500 },
      { name: "KD stat", credits: 2_500 },
      { name: "Quote", credits: 5_000 },
    ],
  },
  {
    level: 10,
    rewards: [
      { name: "MVPs stat", credits: 2_500 },
      { name: "Level II frame", credits: 2_500 },
      { name: "Headshots stat", credits: 2_500 },
      { name: "Agent role background", credits: 6_000 },
      { name: "Player card", credits: 4_500 },
    ],
  },
  {
    level: 15,
    rewards: [
      { name: "Sidearm weapon skin", credits: 8_000 },
      { name: "Quote", credits: 5_000 },
      { name: "Spray", credits: 4_000 },
      { name: "First Bloods stat", credits: 2_500 },
    ],
  },
  {
    level: 20,
    rewards: [
      { name: "Buddy", credits: 5_500 },
      { name: "Win rate stat", credits: 2_500 },
      { name: "Player title", credits: 2_500 },
      { name: "VALORANT background", credits: 6_000 },
      { name: "Level III frame", credits: 5_000 },
    ],
  },
  {
    level: 25,
    rewards: [
      { name: "Spray", credits: 4_000 },
      { name: "Clutches stat", credits: 2_500 },
      { name: "Agent lore background", credits: 6_000 },
      { name: "Mastery I pose", credits: 7_500 },
    ],
  },
  {
    level: 30,
    rewards: [
      { name: "Player title", credits: 2_500 },
      { name: "Quote", credits: 5_000 },
      { name: "Aces stat", credits: 2_500 },
      { name: "Mastery player card", credits: 7_500 },
      { name: "Level IV frame", credits: 7_500 },
    ],
  },
];

const grouped = (n: number) => n.toLocaleString("en-US");

/** Claiming everything at one milestone. */
export const milestoneCost = (m: Milestone): number => m.rewards.reduce((sum, r) => sum + r.credits, 0);

/** "2,500–5,000": the cheapest and dearest single reward at a milestone. */
export function creditRange(m: Milestone): string {
  const costs = m.rewards.map((r) => r.credits);
  const low = Math.min(...costs);
  const high = Math.max(...costs);
  return low === high ? grouped(low) : `${grouped(low)}–${grouped(high)}`;
}

/** Reward milestones you pass going from one Lifetime Level to another (the start is exclusive). */
export function milestonesBetween(fromLifetime: number, toLifetime: number): Milestone[] {
  return REWARD_MILESTONES.filter((m) => m.level > fromLifetime && m.level <= toLifetime);
}
