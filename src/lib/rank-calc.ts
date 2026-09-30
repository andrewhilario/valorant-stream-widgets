// Games-to-rank-up maths. Iron 1 through Ascendant 3 climb in 100 RR steps, so the distance to a
// target is (steps × 100) − the RR you already have. Immortal and Radiant work differently, so
// the calculator stops at Immortal 1. Promotion and demotion shields are ignored.

export const RR_PER_TIER = 100;
/** Iron 1. */
export const MIN_TIER = 3;
/** Immortal 1: the last target this calculator handles. */
export const MAX_TARGET_TIER = 24;

export type RankPlan = {
  currentTier: number;
  /** 0–99. */
  currentRr: number;
  targetTier: number;
  /** 0–100. */
  winRate: number;
  /** Average RR gained per win. */
  rrWin: number;
  /** Average RR lost per loss, as a positive number. */
  rrLoss: number;
};

export function rrToGo(plan: Pick<RankPlan, "currentTier" | "currentRr" | "targetTier">): number {
  return (plan.targetTier - plan.currentTier) * RR_PER_TIER - plan.currentRr;
}

/** Expected RR per game and its spread. */
export function perGame(plan: Pick<RankPlan, "winRate" | "rrWin" | "rrLoss">): { mean: number; sd: number } {
  const w = Math.min(100, Math.max(0, plan.winRate)) / 100;
  const mean = w * plan.rrWin - (1 - w) * plan.rrLoss;
  const sd = Math.sqrt(w * (1 - w)) * (plan.rrWin + plan.rrLoss);
  return { mean, sd };
}

/** The win rate at which you gain nothing on average. Below it you lose RR. */
export function breakEvenWinRate(rrWin: number, rrLoss: number): number {
  return (rrLoss / (rrWin + rrLoss)) * 100;
}

// ── The spread ───────────────────────────────────────────────────────────────
// RR after each game is a random walk with drift μ and spread σ. The number of games until it
// first reaches a gap R is, to a good approximation, inverse-Gaussian with mean R/μ and shape
// R²/σ². We need its 10th and 90th percentiles, which have no closed form, so solve its CDF.

/** Complementary error function (Numerical Recipes, relative error below 1.2e-7). */
function erfc(x: number): number {
  const z = Math.abs(x);
  const t = 1 / (1 + 0.5 * z);
  const r =
    t *
    Math.exp(
      -z * z -
        1.26551223 +
        t *
          (1.00002368 +
            t *
              (0.37409196 +
                t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))),
    );
  return x >= 0 ? r : 2 - r;
}

const phi = (x: number) => 0.5 * erfc(-x / Math.SQRT2);

function inverseGaussianCdf(t: number, mean: number, shape: number): number {
  const s = Math.sqrt(shape / t);
  const tail = phi(-s * (t / mean + 1));
  // exp(2λ/μ) overflows long before the product does, so combine them in log space.
  const second = tail > 0 ? Math.exp((2 * shape) / mean + Math.log(tail)) : 0;
  return phi(s * (t / mean - 1)) + second;
}

function inverseGaussianQuantile(p: number, mean: number, shape: number): number {
  let lo = 0;
  let hi = mean * 4;
  for (let i = 0; i < 60 && inverseGaussianCdf(hi, mean, shape) < p; i++) hi *= 2;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    if (mid <= 0) break;
    if (inverseGaussianCdf(mid, mean, shape) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export type RankForecast =
  | {
      kind: "ok";
      rrToGo: number;
      meanPerGame: number;
      /** Expected games: the gap divided by your average RR per game. */
      expected: number;
      /** One run in ten gets there this quickly or quicker. */
      fast: number;
      /** Nine runs in ten have got there by this many games. */
      slow: number;
    }
  | { kind: "losing"; rrToGo: number; meanPerGame: number; breakEven: number }
  | { kind: "reached" }
  | { kind: "invalid"; reason: "target" | "amounts" };

export function forecastRank(plan: RankPlan): RankForecast {
  if (plan.targetTier <= plan.currentTier || plan.currentTier < MIN_TIER || plan.targetTier > MAX_TARGET_TIER) {
    return { kind: "invalid", reason: "target" };
  }
  if (!(plan.rrWin > 0) || !(plan.rrLoss > 0)) return { kind: "invalid", reason: "amounts" };

  const gap = rrToGo(plan);
  if (gap <= 0) return { kind: "reached" };

  const { mean, sd } = perGame(plan);
  if (mean <= 0) {
    return { kind: "losing", rrToGo: gap, meanPerGame: mean, breakEven: breakEvenWinRate(plan.rrWin, plan.rrLoss) };
  }

  // The epsilon stops 100 ÷ 4 from becoming 26 because the division came out as 25.000000000000004.
  const expected = Math.ceil(gap / mean - 1e-9);
  const shape = (gap * gap) / (sd * sd);
  const meanGames = gap / mean;

  // With no spread (always winning), or an enormous shape, every run takes the expected number of games.
  if (sd < 1e-9 || (2 * shape) / meanGames > 600) {
    return { kind: "ok", rrToGo: gap, meanPerGame: mean, expected, fast: expected, slow: expected };
  }

  const fast = Math.max(1, Math.ceil(inverseGaussianQuantile(0.1, meanGames, shape)));
  const slow = Math.ceil(inverseGaussianQuantile(0.9, meanGames, shape));
  return { kind: "ok", rrToGo: gap, meanPerGame: mean, expected, fast: Math.min(fast, expected), slow: Math.max(slow, expected) };
}

/** The win rate you'd need to cover the gap in `games` games, or null if even winning every game isn't enough. */
export function requiredWinRate(gap: number, games: number, rrWin: number, rrLoss: number): number | null {
  if (games <= 0 || gap <= 0) return null;
  const neededPerGame = gap / games;
  const w = (neededPerGame + rrLoss) / (rrWin + rrLoss);
  if (w > 1) return null;
  return Math.max(0, w) * 100;
}

/** Expected games for a few win rates, to show how much a few points of win rate matter. */
export function whatIf(plan: RankPlan, winRates: number[]): Array<{ winRate: number; games: number | null }> {
  return winRates.map((winRate) => {
    const result = forecastRank({ ...plan, winRate });
    return { winRate, games: result.kind === "ok" ? result.expected : result.kind === "reached" ? 0 : null };
  });
}
