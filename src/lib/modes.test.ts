import { describe, expect, it } from "vitest";
import { defaultMinutes, DEFAULT_MODE, GAME_MODES, isModeId, lengthLabel, modeById, typicalMinutes } from "./modes";

describe("the modes that earn Mastery Points", () => {
  it("are the six Riot's wiki lists, each once", () => {
    expect(GAME_MODES.map((m) => m.name).sort()).toEqual(["Competitive", "Premier", "Spike Rush", "Swiftplay", "Team Deathmatch", "Unrated"]);
    expect(new Set(GAME_MODES.map((m) => m.id)).size).toBe(GAME_MODES.length);
  });

  // The "Estimated Game Time" column of Riot's Game Modes page, copied as printed.
  it("carry Riot's Estimated Game Time for each", () => {
    const printed = Object.fromEntries(GAME_MODES.map((m) => [m.name, lengthLabel(m)]));
    expect(printed).toEqual({
      Competitive: "30–40 min",
      Unrated: "30–40 min",
      Premier: "30–40+ min",
      Swiftplay: "10–15 min",
      "Spike Rush": "8–12 min",
      "Team Deathmatch": "8–10 min",
    });
  });

  it("have a sensible range each: short end below the long end", () => {
    for (const m of GAME_MODES) {
      expect(m.low).toBeGreaterThan(0);
      expect(m.high).toBeGreaterThan(m.low);
    }
  });

  it("only mark the first-to-13 modes as standard", () => {
    expect(GAME_MODES.filter((m) => m.standard).map((m) => m.id)).toEqual(["competitive", "unrated", "premier"]);
  });

  it("start with Competitive, which is the default", () => {
    expect(GAME_MODES[0].id).toBe(DEFAULT_MODE);
  });
});

describe("typicalMinutes", () => {
  it("is the middle of the range", () => {
    const minutes = Object.fromEntries(GAME_MODES.map((m) => [m.id, typicalMinutes(m)]));
    expect(minutes).toEqual({ competitive: 35, unrated: 35, premier: 35, swiftplay: 12.5, spikerush: 10, teamdeathmatch: 9 });
  });
});

describe("modeById and isModeId", () => {
  it("find a mode by its id, and fall back to Competitive for anything else", () => {
    expect(modeById("swiftplay").name).toBe("Swiftplay");
    expect(modeById("teamdeathmatch").name).toBe("Team Deathmatch");
    expect(modeById("nonsense").id).toBe("competitive");
    expect(modeById("").id).toBe("competitive");
  });

  it("recognise ids", () => {
    expect(isModeId("spikerush")).toBe(true);
    expect(isModeId("Spike Rush")).toBe(false);
    expect(isModeId(undefined)).toBe(false);
  });
});

describe("defaultMinutes", () => {
  const competitive = modeById("competitive");
  const swiftplay = modeById("swiftplay");

  it("uses Riot's middle figure when nothing is known about the player", () => {
    expect(defaultMinutes(competitive, null)).toBe(35);
    expect(defaultMinutes(swiftplay, null)).toBe(12.5);
  });

  it("uses the player's own ranked average for first-to-13 modes", () => {
    expect(defaultMinutes(competitive, 33.6)).toBe(33.6);
    expect(defaultMinutes(modeById("unrated"), 33.6)).toBe(33.6);
    expect(defaultMinutes(modeById("premier"), 33.6)).toBe(33.6);
  });

  it("never applies a ranked average to a short mode", () => {
    expect(defaultMinutes(swiftplay, 33.6)).toBe(12.5);
    expect(defaultMinutes(modeById("spikerush"), 33.6)).toBe(10);
  });

  it("ignores a useless average", () => {
    expect(defaultMinutes(competitive, 0)).toBe(35);
    expect(defaultMinutes(competitive, -4)).toBe(35);
  });
});
