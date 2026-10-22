import { describe, expect, it } from "vitest";
import { actRecord, type CurrentAct } from "./act-record";

const act: CurrentAct = { id: "D816F426-48EA-F052-117F-9697A155B319", label: "V26 · ACT VI", short: "v26a6" };
const seasons = [
  { id: "8102cd81-43a0-d0d7-bd59-47b8fe9bed1b", short: "v26a5", wins: 40, games: 70 },
  { id: "d816f426-48ea-f052-117f-9697a155b319", short: "v26a6", wins: 134, games: 223 },
];

describe("actRecord", () => {
  it("is the record in the Act that is running: wins, losses (games minus wins) and the win rate", () => {
    const r = actRecord(seasons, act);
    expect(r).toMatchObject({ wins: 134, losses: 89, games: 223 });
    expect(r?.winRate).toBeCloseTo(60.09, 1);
  });

  it("matches the id whatever its case, and falls back to the short name when the ids differ", () => {
    expect(actRecord(seasons, { ...act, id: "d816f426-48ea-f052-117f-9697a155b319" })?.games).toBe(223);
    expect(actRecord(seasons, { ...act, id: "no-such-id" })?.games).toBe(223);
    expect(actRecord(seasons, { ...act, id: "no-such-id", short: null })?.games).toBe(0);
  });

  it("is 0 and 0, with no win rate, for an Act the player has not played yet", () => {
    expect(actRecord([seasons[0]], act)).toEqual({ wins: 0, losses: 0, games: 0, winRate: null });
  });

  it("is null when it cannot be told: no seasons in the data, or no Act known", () => {
    expect(actRecord(undefined, act)).toBeNull();
    expect(actRecord(seasons, null)).toBeNull();
  });
});
