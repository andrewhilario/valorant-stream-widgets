// The game modes that earn Agent Mastery Points, and how long a match in each usually takes.
//
// Riot's VALORANT Wiki lists the six modes on its Agent Mastery page, and gives each an "Estimated Game Time"
// on its Game Modes page. Riot publishes a range for every mode, never a single figure, so the length used
// for a mode is the middle of its range, and the page says so. The user can always type their own.

export type ModeId = "competitive" | "unrated" | "premier" | "swiftplay" | "spikerush" | "teamdeathmatch";

export type GameMode = {
  id: ModeId;
  name: string;
  /** Riot's "Estimated Game Time", in minutes: the two ends of the range. */
  low: number;
  high: number;
  /** Riot writes Premier as "30-40 minutes+": it can run longer than the range. */
  openEnded?: boolean;
  /** First to 13 rounds, the same format as Competitive. Your ranked games say something about how long these run. */
  standard: boolean;
};

export const MODE_SOURCE = {
  name: "VALORANT Wiki: Game Modes",
  url: "https://wiki.playvalorant.com/en-us/Game_Modes",
  column: "Estimated Game Time",
  checked: "30 September 2026",
} as const;

export const GAME_MODES: readonly GameMode[] = [
  { id: "competitive", name: "Competitive", low: 30, high: 40, standard: true },
  { id: "unrated", name: "Unrated", low: 30, high: 40, standard: true },
  { id: "premier", name: "Premier", low: 30, high: 40, openEnded: true, standard: true },
  { id: "swiftplay", name: "Swiftplay", low: 10, high: 15, standard: false },
  { id: "spikerush", name: "Spike Rush", low: 8, high: 12, standard: false },
  { id: "teamdeathmatch", name: "Team Deathmatch", low: 8, high: 10, standard: false },
];

export const DEFAULT_MODE: ModeId = "competitive";

export function isModeId(value: unknown): value is ModeId {
  return GAME_MODES.some((m) => m.id === value);
}

/** The mode for an id, or Competitive if the id isn't one of ours. */
export function modeById(id: string): GameMode {
  return GAME_MODES.find((m) => m.id === id) ?? GAME_MODES[0];
}

/** The middle of Riot's range. */
export const typicalMinutes = (mode: GameMode): number => (mode.low + mode.high) / 2;

/** "30–40 min", or "30–40+ min" where Riot says the range can be exceeded. */
export const lengthLabel = (mode: GameMode): string => `${mode.low}–${mode.high}${mode.openEnded ? "+" : ""} min`;

/**
 * The match length to start from when a mode is picked. For a first-to-13 mode, the player's own average from
 * their recent ranked games is the better guess, if they've loaded it; every other mode gets Riot's middle figure.
 */
export function defaultMinutes(mode: GameMode, rankedAverage: number | null): number {
  return rankedAverage !== null && rankedAverage > 0 && mode.standard ? rankedAverage : typicalMinutes(mode);
}
