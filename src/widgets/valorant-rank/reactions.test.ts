import { describe, expect, it } from "vitest";
import type { RankData } from "@/lib/rank-types";
import { computeSession } from "@/lib/session";
import { RECENT_MS, REACTION_KINDS, REACTION_MS, detectReaction, simulateGame } from "./reactions";
import { sampleRank } from "./sample";

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0);
const MINUTE = 60_000;

const diamond = () => sampleRank(NOW, "diamond");

/** The same account a poll later, with the changes you give it. */
function later(data: RankData, change: Partial<RankData["current"]> = {}, games: RankData["history"] = [], at = NOW + MINUTE): RankData {
  return {
    ...data,
    fetchedAt: at,
    current: { ...data.current, ...change },
    history: [...games, ...data.history],
  };
}

const game = (id: string, change: number, at = NOW + MINUTE / 2) => ({ id, at, change, rr: 0, tierId: 19, protected: false });

describe("detectReaction: games", () => {
  it("says nothing without two lookups to compare", () => {
    expect(detectReaction(null, diamond())).toBeNull();
    expect(detectReaction(diamond(), null)).toBeNull();
    expect(detectReaction(null, null)).toBeNull();
  });

  it("says nothing when a poll finds the same games again, even as a new object", () => {
    expect(detectReaction(diamond(), diamond())).toBeNull();
    expect(detectReaction(diamond(), later(diamond()))).toBeNull();
  });

  it("calls a new game that gained RR a win, and one that lost RR a loss", () => {
    const before = diamond();
    expect(detectReaction(before, later(before, { rr: 88, lastChange: 21 }, [game("g1", 21)]))).toBe("win");
    expect(detectReaction(before, later(before, { rr: 51, lastChange: -16 }, [game("g1", -16)]))).toBe("loss");
  });

  it("reacts to the newest of several games that landed between two polls", () => {
    const before = diamond();
    const next = later(before, {}, [game("old", -12, NOW + 10_000), game("new", 20, NOW + 50_000)]);
    expect(detectReaction(before, next)).toBe("win");
  });

  it("ignores a game that changed no RR", () => {
    const before = diamond();
    expect(detectReaction(before, later(before, {}, [game("shielded", 0)]))).toBeNull();
  });

  it("ignores games that ended long ago and only now showed up", () => {
    const before = diamond();
    const stale = game("stale", 20, NOW + MINUTE - RECENT_MS - 1);
    expect(detectReaction(before, later(before, {}, [stale]))).toBeNull();
    const fresh = game("fresh", 20, NOW + MINUTE - RECENT_MS + 1000);
    expect(detectReaction(before, later(before, {}, [fresh]))).toBe("win");
  });

  it("does not treat a history that was missing, then loaded, as a run of new games", () => {
    const missing = { ...diamond(), history: [], partial: true };
    expect(detectReaction(missing, { ...diamond(), fetchedAt: NOW + MINUTE })).toBeNull();
    const full = diamond();
    expect(detectReaction(full, { ...later(full, {}, [game("g1", 20)]), partial: true })).toBeNull();
  });

  it("does not react across two different accounts", () => {
    const before = diamond();
    const other = { ...later(before, { rr: 88 }, [game("g1", 21)]), account: { name: "Someone", tag: "9999", puuid: null } };
    expect(detectReaction(before, other)).toBeNull();
  });

  it("compares Riot IDs without regard to case", () => {
    const before = diamond();
    const shouted = { ...later(before, { rr: 88 }, [game("g1", 21)]), account: { name: "SAMPLE", tag: "0000", puuid: null } };
    expect(detectReaction(before, shouted)).toBe("win");
  });
});

describe("detectReaction: ranks", () => {
  it("calls a higher tier a rank up and a lower one a rank down, ahead of the game that caused it", () => {
    const before = diamond();
    expect(detectReaction(before, later(before, { tierId: 20, rr: 12 }, [game("g1", 24)]))).toBe("up");
    expect(detectReaction(before, later(before, { tierId: 18, rr: 84 }, [game("g1", -21)]))).toBe("down");
  });

  it("still sees a rank change when the history didn't load", () => {
    const before = diamond();
    expect(detectReaction(before, { ...later(before, { tierId: 20 }), partial: true })).toBe("up");
  });

  it("does not react to a rank appearing or vanishing from bad data", () => {
    const before = diamond();
    expect(detectReaction(before, later(before, { tierId: 0, rr: 0 }))).toBeNull();
    const unrated = sampleRank(NOW, "unrated");
    // Unrated with no placement games left to play: nothing to celebrate if a rank shows up.
    const settled = { ...unrated, current: { ...unrated.current, gamesNeeded: 0 } };
    expect(detectReaction(settled, later(settled, { tierId: 19, rr: 40 }))).toBeNull();
  });

  it("celebrates the last placement game, when Unrated becomes a rank", () => {
    const placing = sampleRank(NOW, "unrated");
    expect(placing.current.gamesNeeded).toBeGreaterThan(0);
    expect(detectReaction(placing, later(placing, { tierId: 15, tier: "Platinum 1", rr: 24, gamesNeeded: 0 }))).toBe("up");
  });
});

describe("simulateGame", () => {
  it("adds a win to the front of the history and moves RR, last change and the session stats with it", () => {
    const before = diamond();
    const after = simulateGame(before, "win", NOW + MINUTE);

    expect(after.current.rr).toBe(before.current.rr + 19);
    expect(after.current.lastChange).toBe(19);
    expect(after.current.tierId).toBe(before.current.tierId);
    expect(after.history).toHaveLength(before.history.length + 1);
    expect(after.history[0]).toMatchObject({ change: 19, rr: after.current.rr, tierId: after.current.tierId, protected: false });

    const options = { mode: "auto", gapHours: 4, windowHours: 6, now: NOW + MINUTE } as const;
    const was = computeSession(before.history, options);
    const is = computeSession(after.history, options);
    expect(is.net).toBe(was.net + 19);
    expect(is.wins).toBe(was.wins + 1);
  });

  it("takes RR off for a loss", () => {
    const after = simulateGame(diamond(), "loss", NOW);
    expect(after.current.rr).toBe(67 - 16);
    expect(after.current.lastChange).toBe(-16);
    expect(after.history[0].change).toBe(-16);
  });

  it("promotes when a win carries RR past 100, and carries the remainder over", () => {
    const near = { ...diamond(), current: { ...diamond().current, rr: 90 } };
    const after = simulateGame(near, "win", NOW);
    expect(after.current.tierId).toBe(20);
    expect(after.current.tier).toBe("Diamond 3");
    expect(after.current.rr).toBe(90 + 19 - 100);
  });

  it("demotes when a loss takes RR below zero, and stops at Iron 1", () => {
    const low = { ...diamond(), current: { ...diamond().current, rr: 5 } };
    const after = simulateGame(low, "loss", NOW);
    expect(after.current.tierId).toBe(18);
    expect(after.current.rr).toBe(5 - 16 + 100);

    const iron = { ...diamond(), current: { ...diamond().current, tierId: 3, tier: "Iron 1", rr: 5 } };
    const floor = simulateGame(iron, "loss", NOW);
    expect(floor.current.tierId).toBe(3);
    expect(floor.current.rr).toBe(0);
  });

  it("forces a rank up or down across a tier whatever the RR", () => {
    const up = simulateGame(diamond(), "up", NOW);
    expect(up.current.tierId).toBe(20);
    expect(up.current.rr).toBe(18);
    expect(up.current.lastChange).toBeGreaterThan(0);

    const down = simulateGame(diamond(), "down", NOW);
    expect(down.current.tierId).toBe(18);
    expect(down.current.rr).toBe(84);
    expect(down.current.lastChange).toBeLessThan(0);
  });

  it("lets RR run on past 100 from Immortal up, and never below zero", () => {
    const immortal = sampleRank(NOW, "immortal");
    expect(simulateGame(immortal, "win", NOW).current.rr).toBe(immortal.current.rr + 19);
    expect(simulateGame(immortal, "win", NOW).current.tierId).toBe(immortal.current.tierId);
    const edge = { ...immortal, current: { ...immortal.current, rr: 4 } };
    expect(simulateGame(edge, "loss", NOW).current.rr).toBe(0);
  });

  it("can't rank up past Radiant or down past Iron 1, so those play as a win and a loss", () => {
    const radiant = sampleRank(NOW, "radiant");
    expect(simulateGame(radiant, "up", NOW).current.tierId).toBe(27);
    expect(detectReaction(radiant, simulateGame(radiant, "up", NOW + MINUTE))).toBe("win");

    const iron = { ...diamond(), current: { ...diamond().current, tierId: 3, tier: "Iron 1", rr: 40 } };
    expect(simulateGame(iron, "down", NOW).current.tierId).toBe(3);
    expect(detectReaction(iron, simulateGame(iron, "down", NOW + MINUTE))).toBe("loss");
  });

  it("raises the peak when the new rank is above it", () => {
    const top = { ...diamond(), peak: { tierId: 19, tier: "Diamond 2", season: null } };
    expect(simulateGame(top, "up", NOW).peak?.tier).toBe("Diamond 3");
    expect(simulateGame(top, "down", NOW).peak?.tier).toBe("Diamond 2");
  });

  it("leaves Unrated alone and never changes what it was given", () => {
    const unrated = sampleRank(NOW, "unrated");
    expect(simulateGame(unrated, "win", NOW)).toBe(unrated);

    const before = diamond();
    const snapshot = JSON.stringify(before);
    simulateGame(before, "up", NOW);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it.each(REACTION_KINDS)("plays back as exactly what you asked for: %s", (kind) => {
    const before = diamond();
    const after = simulateGame(before, kind, before.fetchedAt + MINUTE);
    expect(detectReaction(before, after)).toBe(kind);
  });

  it("plays back correctly several games in a row, whatever tier it lands in", () => {
    let data = diamond();
    let at = NOW;
    for (const kind of ["win", "win", "win", "win", "loss", "down", "up", "loss", "down", "down"] as const) {
      at += MINUTE;
      const next = simulateGame(data, kind, at);
      expect(detectReaction(data, next)).not.toBeNull();
      if (kind === "up" || kind === "down") expect(detectReaction(data, next)).toBe(kind);
      data = next;
    }
  });
});

describe("reaction timing", () => {
  it("gives every kind a duration, the rank changes the longest", () => {
    for (const kind of REACTION_KINDS) expect(REACTION_MS[kind]).toBeGreaterThan(0);
    expect(REACTION_MS.up).toBeGreaterThan(REACTION_MS.win);
  });
});
