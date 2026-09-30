import { describe, expect, it } from "vitest";
import { computeSession, EMPTY_SESSION, type HistoryEntry } from "./session";

const MIN = 60_000;
const HOUR = 60 * MIN;

const game = (id: string, at: number, change: number, protectedLoss = false): HistoryEntry => ({
  id,
  at,
  change,
  rr: 0,
  tierId: 19,
  protected: protectedLoss,
});

// Local time, so the "today" tests are about the viewer's midnight, as in real use.
const NOW = new Date(2026, 8, 30, 15, 0, 0).getTime();

describe("auto session", () => {
  const base = { mode: "auto" as const, gapHours: 4, windowHours: 6, now: NOW };

  it("counts the latest unbroken run and stops at a long gap", () => {
    const history = [
      game("a", NOW - 30 * MIN, 20),
      game("b", NOW - 60 * MIN, -15),
      game("c", NOW - 100 * MIN, 18),
      game("old", NOW - 100 * MIN - 5 * HOUR, 30), // more than 4 h before the run
    ];
    const s = computeSession(history, base);
    expect(s.games).toBe(3);
    expect(s.wins).toBe(2);
    expect(s.losses).toBe(1);
    expect(s.gained).toBe(38);
    expect(s.lost).toBe(15);
    expect(s.net).toBe(23);
    expect(s.winRate).toBeCloseTo(66.67, 1);
  });

  it("is empty when the newest game is older than the gap", () => {
    const history = [game("a", NOW - 5 * HOUR, 20)];
    expect(computeSession(history, base)).toEqual(EMPTY_SESSION);
  });

  it("does not depend on the order the API returns games in", () => {
    const history = [game("c", NOW - 100 * MIN, 18), game("a", NOW - 30 * MIN, 20), game("b", NOW - 60 * MIN, -15)];
    expect(computeSession(history, base).games).toBe(3);
  });

  it("bridges a gap exactly equal to the limit, but not one minute more", () => {
    const at = (m: number) => NOW - m * MIN;
    const tight = [game("a", at(30), 10), game("b", at(30 + 240), 10)];
    const loose = [game("a", at(30), 10), game("b", at(30 + 241), 10)];
    expect(computeSession(tight, base).games).toBe(2);
    expect(computeSession(loose, base).games).toBe(1);
  });
});

describe("today", () => {
  const base = { mode: "today" as const, gapHours: 4, windowHours: 6, now: NOW };

  it("counts games since local midnight only", () => {
    const midnight = new Date(2026, 8, 30, 0, 0, 0).getTime();
    const history = [
      game("now", NOW - 10 * MIN, 12),
      game("early", midnight + 5 * MIN, -10),
      game("last-night", midnight - 5 * MIN, 25),
    ];
    const s = computeSession(history, base);
    expect(s.games).toBe(2);
    expect(s.net).toBe(2);
  });
});

describe("rolling window", () => {
  it("counts games in the last N hours", () => {
    const history = [game("in", NOW - 5 * HOUR, 10), game("out", NOW - 7 * HOUR, 10)];
    expect(computeSession(history, { mode: "window", gapHours: 4, windowHours: 6, now: NOW }).games).toBe(1);
    expect(computeSession(history, { mode: "window", gapHours: 4, windowHours: 8, now: NOW }).games).toBe(2);
  });
});

describe("decided games", () => {
  const base = { mode: "auto" as const, gapHours: 4, windowHours: 6, now: NOW };

  it("counts a derank-protected 0 RR game as a loss", () => {
    const s = computeSession([game("a", NOW - 10 * MIN, 0, true)], base);
    expect(s.losses).toBe(1);
    expect(s.winRate).toBe(0);
  });

  it("counts an undecided 0 RR game as played but neither won nor lost", () => {
    const s = computeSession([game("a", NOW - 10 * MIN, 0)], base);
    expect(s.games).toBe(1);
    expect(s.wins + s.losses).toBe(0);
    expect(s.winRate).toBeNull();
  });
});
