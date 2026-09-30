// The rank calculator's form, turned into something a screen can show. No React in here, so the
// numbers and the wording of every state can be tested.

import { parseField, type FieldRule } from "./fields";
import {
  breakEvenWinRate,
  forecastRank,
  MAX_TARGET_TIER,
  MIN_TIER,
  requiredWinRate,
  rrToGo,
  whatIf,
  type RankPlan,
} from "./rank-calc";

export type RankForm = {
  /** Current tier id (Iron 1 is 3). */
  tier: number;
  rr: string;
  /** Target tier id. */
  target: number;
  winRate: string;
  rrWin: string;
  rrLoss: string;
};

export type RankField = "rr" | "winRate" | "rrWin" | "rrLoss";
export type RankErrors = Partial<Record<RankField, string>>;

/** Diamond 2 at 67 RR, the same account the overlay editor shows as sample data. The screen always labels these as examples. */
export const RANK_EXAMPLE: RankForm = { tier: 19, rr: "67", target: 21, winRate: "54", rrWin: "19", rrLoss: "17" };

/** Tiers you can start from: Iron 1 through Ascendant 3. */
export const CURRENT_TIERS: number[] = Array.from({ length: MAX_TARGET_TIER - MIN_TIER }, (_, i) => MIN_TIER + i);

/** Tiers you can aim for: anything above the current one, up to Immortal 1. */
export function targetTiers(current: number): number[] {
  const first = Math.max(current + 1, MIN_TIER + 1);
  return Array.from({ length: Math.max(0, MAX_TARGET_TIER - first + 1) }, (_, i) => first + i);
}

/** Changing the current rank past the target pulls the target up with it. */
export function withCurrentTier(form: RankForm, tier: number): RankForm {
  return { ...form, tier, target: Math.max(form.target, tier + 1) };
}

const RULES: Record<RankField, FieldRule> = {
  rr: { min: 0, max: 99, integer: true, rangeMessage: "RR inside a rank is 0 to 99." },
  winRate: { min: 0, max: 100 },
  rrWin: { min: 1, max: 100, rangeMessage: "Enter the RR you gain on an average win, 1 to 100." },
  rrLoss: { min: 1, max: 100, rangeMessage: "Enter the RR you lose on an average loss, 1 to 100, without a minus sign." },
};

export type SweepRow = { winRate: number; games: number | null; current: boolean };
export type GoalRow = { games: number; winRate: number | null };

type Common = { plan: RankPlan; gap: number; meanPerGame: number; breakEven: number; sweep: SweepRow[] };

export type RankView =
  | { kind: "invalid"; errors: RankErrors }
  | ({ kind: "ok"; expected: number; fast: number; slow: number; goals: GoalRow[] } & Common)
  | ({ kind: "losing" } & Common);

const SWEEP_STEPS = [-6, -3, 0, 3, 6];
/** Points above break-even to show when the typed rate loses RR: the table's job is then to show what would work. */
const ABOVE_BREAK_EVEN = [2, 4, 7, 10];
const GOAL_GAMES = [25, 50, 100];

export function evaluateRank(form: RankForm): RankView {
  const rr = parseField(form.rr, RULES.rr);
  const winRate = parseField(form.winRate, RULES.winRate);
  const rrWin = parseField(form.rrWin, RULES.rrWin);
  const rrLoss = parseField(form.rrLoss, RULES.rrLoss);

  const errors: RankErrors = {};
  if (rr.error) errors.rr = rr.error;
  if (winRate.error) errors.winRate = winRate.error;
  if (rrWin.error) errors.rrWin = rrWin.error;
  if (rrLoss.error) errors.rrLoss = rrLoss.error;
  if (rr.value === null || winRate.value === null || rrWin.value === null || rrLoss.value === null) return { kind: "invalid", errors };

  const plan: RankPlan = {
    currentTier: form.tier,
    currentRr: rr.value,
    targetTier: form.target,
    winRate: winRate.value,
    rrWin: rrWin.value,
    rrLoss: rrLoss.value,
  };

  const forecast = forecastRank(plan);
  // The form can't produce these: the target list only offers higher tiers and the fields are validated above.
  if (forecast.kind === "invalid" || forecast.kind === "reached") return { kind: "invalid", errors };

  const breakEven = breakEvenWinRate(plan.rrWin, plan.rrLoss);

  // The typed rate is always a row, exactly as typed, so it can be marked as yours. Around it: a few points either
  // side, or, when it loses RR, the rates just above break-even that would actually finish.
  const around =
    forecast.kind === "losing"
      ? ABOVE_BREAK_EVEN.map((d) => Math.ceil(breakEven) + d)
      : SWEEP_STEPS.filter((d) => d !== 0).map((d) => Math.round((plan.winRate + d) * 10) / 10);
  const rates = [...new Set([plan.winRate, ...around].filter((w) => w >= 0 && w <= 100))].sort((a, b) => a - b);
  const sweep = whatIf(plan, rates).map((row) => ({ ...row, current: row.winRate === plan.winRate }));

  const gap = rrToGo(plan);
  const common: Common = { plan, gap, meanPerGame: forecast.meanPerGame, breakEven, sweep };

  if (forecast.kind === "losing") return { kind: "losing", ...common };

  return {
    kind: "ok",
    ...common,
    expected: forecast.expected,
    fast: forecast.fast,
    slow: forecast.slow,
    goals: GOAL_GAMES.map((games) => ({ games, winRate: requiredWinRate(gap, games, plan.rrWin, plan.rrLoss) })),
  };
}
