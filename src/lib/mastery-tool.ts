// The Agent Mastery calculator's form, turned into something a screen can show. No React in here,
// so the numbers and the wording of every state can be tested.

import { parseField, type FieldRule } from "./fields";
import {
  forecastMastery,
  MAX_LEVEL,
  matchesNeeded,
  milestonesBetween,
  mpForLevel,
  normaliseMastery,
  PORTRAIT_ACCENT_LEVELS,
  type MasteryForecast,
  type MasteryInput,
  type Milestone,
} from "./mastery";
import { GAME_MODES, modeById, typicalMinutes, type GameMode } from "./modes";

export type MasteryForm = {
  /** The game mode the matches are in: one of the ids in modes.ts. */
  mode: string;
  /** Act Level reached, 0 if none yet. */
  level: string;
  /** MP already earned toward the next level. */
  mpInto: string;
  /** The Act Level you want. */
  target: string;
  /** Lifetime Level now. Blank means "same as your Act Level", which is true until an Act has ended. */
  lifetime: string;
  minutes: string;
  winRate: string;
  /** Extra MP from Performance Score, in percent. */
  bonus: string;
  /** Optional. */
  hours: string;
};

/** The fields someone types into. The mode is a choice from a list, so it can't be wrong. */
export type MasteryField = Exclude<keyof MasteryForm, "mode">;
export type MasteryErrors = Partial<Record<MasteryField, string>>;

/** Shown as examples and labelled that way on screen: a player part-way up their first Act. */
export const MASTERY_EXAMPLE: MasteryForm = {
  mode: "competitive",
  level: "4",
  mpInto: "3200",
  target: "10",
  lifetime: "",
  minutes: "35",
  winRate: "50",
  bonus: "0",
  hours: "2",
};

const fmt = (n: number) => n.toLocaleString("en-US");

function rules(level: number | null): Record<MasteryField, FieldRule> {
  const floor = level === null ? 0 : level;
  return {
    level: { min: 0, max: MAX_LEVEL - 1, integer: true, rangeMessage: `Act Levels run from 0 to ${MAX_LEVEL - 1} here. At ${MAX_LEVEL} there's nothing left to earn.` },
    mpInto: {
      min: 0,
      max: level === null ? mpForLevel(MAX_LEVEL) - 1 : mpForLevel(level + 1) - 1,
      integer: true,
      rangeMessage:
        level === null
          ? "Enter the MP you've earned toward your next level."
          : `Level ${level + 1} costs ${fmt(mpForLevel(level + 1))} MP in all, so enter less than that.`,
    },
    target: { min: floor + 1, max: MAX_LEVEL, integer: true, rangeMessage: `Pick a level above your current one, up to ${MAX_LEVEL}.` },
    lifetime: { min: 0, max: 999, integer: true, optional: true },
    minutes: { min: 1, max: 180, rangeMessage: "Average match length in minutes, 1 to 180." },
    winRate: { min: 0, max: 100 },
    bonus: { min: 0, max: 500, rangeMessage: "Enter a percentage from 0 to 500. Leave 0 if you don't know." },
    hours: { min: 0, max: 24, optional: true, rangeMessage: "Hours per day, 0 to 24." },
  };
}

/** Matches needed if the same Mastery Points were earned in one particular mode. */
export type ModeRow = {
  mode: GameMode;
  /** The match length this row assumes: Riot's middle figure, or what was typed for the picked mode. */
  minutes: number;
  matches: number;
  /** Matches if every one ran to the long end of Riot's range, and to the short end (widened to include `matches`). */
  fewest: number;
  most: number;
  /** The mode that was picked. It uses the length that was typed. */
  picked: boolean;
};

export type MasteryOk = {
  kind: "ok";
  input: MasteryInput;
  /** The mode the headline figure is for. */
  mode: GameMode;
  /** The same climb in every mode that earns Mastery Points. */
  modes: ModeRow[];
  forecast: Extract<MasteryForecast, { ok: true }>;
  /** Matches needed if every one were a win, and if every one were a loss. */
  bestCase: number;
  worstCase: number;
  /** Portrait Accents you'd unlock on the way. */
  accents: number[];
  milestones: Milestone[];
  lifetime: { from: number; to: number; assumed: boolean };
};

export type MasteryView = { kind: "invalid"; errors: MasteryErrors } | MasteryOk;

export function evaluateMastery(form: MasteryForm): MasteryView {
  const level = parseField(form.level, rules(null).level);
  const r = rules(level.value);

  const parsed = {
    level,
    mpInto: parseField(form.mpInto, r.mpInto),
    target: parseField(form.target, r.target),
    lifetime: parseField(form.lifetime, r.lifetime),
    minutes: parseField(form.minutes, r.minutes),
    winRate: parseField(form.winRate, r.winRate),
    bonus: parseField(form.bonus, r.bonus),
    hours: parseField(form.hours, r.hours),
  };

  const errors: MasteryErrors = {};
  for (const [field, result] of Object.entries(parsed) as Array<[MasteryField, (typeof parsed)[MasteryField]]>) {
    if (result.error) errors[field] = result.error;
  }

  const { level: lv, mpInto, target, minutes, winRate, bonus } = parsed;
  if (lv.value === null || mpInto.value === null || target.value === null || minutes.value === null || winRate.value === null || bonus.value === null || errors.lifetime || errors.hours) {
    return { kind: "invalid", errors };
  }

  const input = normaliseMastery({
    currentLevel: lv.value,
    mpIntoLevel: mpInto.value,
    targetLevel: target.value,
    minutes: minutes.value,
    winRate: winRate.value,
    bonusPct: bonus.value,
    hoursPerDay: parsed.hours.value ?? 0,
  });

  const forecast = forecastMastery(input);
  // Unreachable from the form: every field is range-checked above, so there is always something left to earn.
  if (!forecast.ok) return { kind: "invalid", errors };

  const assumed = parsed.lifetime.value === null;
  const from = parsed.lifetime.value ?? input.currentLevel;
  const to = from + forecast.levelsGained;

  // Mastery Points come from minutes played, so every mode needs the same play time; a shorter match just means
  // more of them. The picked mode uses the length that was typed, the rest the middle of Riot's range.
  const picked = modeById(form.mode);
  const count = (minutes: number) => matchesNeeded(forecast.remainingMp, minutes, input.winRate, input.bonusPct);
  const modes = GAME_MODES.map((mode): ModeRow => {
    const isPicked = mode.id === picked.id;
    const minutes = isPicked ? input.minutes : typicalMinutes(mode);
    const matches = isPicked ? forecast.matches : count(minutes);
    return {
      mode,
      minutes,
      matches,
      fewest: Math.min(matches, count(mode.high)),
      most: Math.max(matches, count(mode.low)),
      picked: isPicked,
    };
  });

  return {
    kind: "ok",
    input,
    mode: picked,
    modes,
    forecast,
    bestCase: Math.ceil(forecast.remainingMp / forecast.perMatch.win - 1e-9),
    worstCase: Math.ceil(forecast.remainingMp / forecast.perMatch.loss - 1e-9),
    accents: PORTRAIT_ACCENT_LEVELS.filter((l) => l > input.currentLevel && l <= input.targetLevel),
    milestones: milestonesBetween(from, to),
    lifetime: { from, to, assumed },
  };
}
