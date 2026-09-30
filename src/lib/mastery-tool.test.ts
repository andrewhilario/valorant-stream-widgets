import { describe, expect, it } from "vitest";
import { evaluateMastery, MASTERY_EXAMPLE, type MasteryField, type MasteryForm } from "./mastery-tool";

const form = (over: Partial<MasteryForm> = {}): MasteryForm => ({ ...MASTERY_EXAMPLE, ...over });

function ok(over: Partial<MasteryForm> = {}) {
  const view = evaluateMastery(form(over));
  if (view.kind !== "ok") throw new Error(`expected a result, got ${JSON.stringify(view)}`);
  return view;
}

describe("evaluateMastery: the example", () => {
  const view = ok();

  it("works out what is left to earn", () => {
    // Levels 1–4 cost 2,000 + 8,500 + 9,300 + 10,500 = 30,300. Levels 1–10 cost 132,400. Minus 3,200 already earned.
    expect(view.forecast.remainingMp).toBe(132_400 - 30_300 - 3_200);
    expect(view.forecast.levelsGained).toBe(6);
  });

  it("prices a match from its length, a win bonus and the win rate", () => {
    // 35 minutes is 2,800 MP; a win is worth 1.3×; half wins is the average of the two.
    expect(view.forecast.perMatch.loss).toBeCloseTo(2800, 6);
    expect(view.forecast.perMatch.win).toBeCloseTo(3640, 6);
    expect(view.forecast.perMatch.average).toBeCloseTo(3220, 6);
    expect(view.forecast.matches).toBe(Math.ceil(98_900 / 3220)); // 31
  });

  it("gives matches, hours and days", () => {
    expect(view.forecast.matches).toBe(31);
    expect(view.forecast.hours).toBeCloseTo((31 * 35) / 60, 6);
    expect(view.forecast.days).toBeCloseTo(view.forecast.hours / 2, 6);
  });

  it("brackets the answer between all wins and all losses", () => {
    expect(view.bestCase).toBe(Math.ceil(98_900 / 3640));
    expect(view.worstCase).toBe(Math.ceil(98_900 / 2800));
    expect(view.bestCase).toBeLessThanOrEqual(view.forecast.matches);
    expect(view.forecast.matches).toBeLessThanOrEqual(view.worstCase);
  });

  it("lists the Portrait Accents and reward milestones you'd pass, not the ones you already have", () => {
    // Level 4 is already reached, so its accent isn't on the way.
    expect(view.accents).toEqual([7, 10]);
    expect(view.lifetime).toEqual({ from: 4, to: 10, assumed: true });
    expect(view.milestones.map((m) => m.level)).toEqual([5, 10]);
  });
});

describe("evaluateMastery: game modes", () => {
  const view = ok();
  const row = (v: typeof view, id: string) => v.modes.find((r) => r.mode.id === id)!;

  it("lists every mode that earns Mastery Points, with the picked one marked", () => {
    expect(view.modes.map((r) => r.mode.id)).toEqual(["competitive", "unrated", "premier", "swiftplay", "spikerush", "teamdeathmatch"]);
    expect(view.modes.filter((r) => r.picked).map((r) => r.mode.id)).toEqual(["competitive"]);
    expect(view.mode.id).toBe("competitive");
  });

  it("prices the picked mode at the typed length and the rest at the middle of Riot's range", () => {
    expect(row(view, "competitive")).toMatchObject({ minutes: 35, matches: 31 });
    expect(row(view, "unrated")).toMatchObject({ minutes: 35, matches: 31 });
    // 12.5 minutes is 1,000 MP, so 1,150 on average; 98,900 ÷ 1,150 is exactly 86.
    expect(row(view, "swiftplay")).toMatchObject({ minutes: 12.5, matches: 86 });
    // 10 minutes averages 920 MP: 98,900 ÷ 920 = 107.5.
    expect(row(view, "spikerush")).toMatchObject({ minutes: 10, matches: 108 });
    // 9 minutes averages 828 MP: 98,900 ÷ 828 = 119.4.
    expect(row(view, "teamdeathmatch")).toMatchObject({ minutes: 9, matches: 120 });
  });

  it("gives each mode's spread from the two ends of Riot's range", () => {
    // 40 minutes averages 3,680 MP (26.9 matches); 30 minutes averages 2,760 (35.8).
    expect(row(view, "competitive")).toMatchObject({ fewest: 27, most: 36 });
    // 15 minutes averages 1,380 (71.7); 10 minutes averages 920 (107.5).
    expect(row(view, "swiftplay")).toMatchObject({ fewest: 72, most: 108 });
    for (const r of view.modes) {
      expect(r.fewest).toBeLessThanOrEqual(r.matches);
      expect(r.matches).toBeLessThanOrEqual(r.most);
    }
  });

  it("needs about the same play time in any mode, because Mastery Points come from minutes played", () => {
    for (const r of view.modes) expect((r.matches * r.minutes) / 60).toBeCloseTo(view.forecast.hours, 0);
  });

  it("follows the picked mode and the length typed for it, and leaves the others at Riot's figures", () => {
    const swift = ok({ mode: "swiftplay", minutes: "15" });
    expect(swift.mode.id).toBe("swiftplay");
    expect(swift.modes.filter((r) => r.picked).map((r) => r.mode.id)).toEqual(["swiftplay"]);
    expect(row(swift, "swiftplay")).toMatchObject({ minutes: 15, matches: swift.forecast.matches });
    expect(row(swift, "competitive")).toMatchObject({ minutes: 35, picked: false });
  });

  it("widens the spread to include a length outside Riot's range", () => {
    const long = ok({ minutes: "55" });
    const r = long.modes.find((x) => x.picked)!;
    expect(r.fewest).toBe(r.matches);
    expect(r.matches).toBeLessThan(27);
  });

  it("treats a mode it doesn't know as Competitive", () => {
    expect(ok({ mode: "nonsense" }).mode.id).toBe("competitive");
  });
});

describe("evaluateMastery: inputs", () => {
  it("uses the lifetime level when one is given", () => {
    const view = ok({ lifetime: "12" });
    expect(view.lifetime).toEqual({ from: 12, to: 18, assumed: false });
    expect(view.milestones.map((m) => m.level)).toEqual([15]);
  });

  it("scales MP per match by the Performance Score bonus", () => {
    const base = ok({ bonus: "0" });
    const boosted = ok({ bonus: "20" });
    expect(boosted.forecast.perMatch.average).toBeCloseTo(base.forecast.perMatch.average * 1.2, 6);
    expect(boosted.forecast.matches).toBeLessThan(base.forecast.matches);
  });

  it("skips the calendar estimate when hours per day is blank", () => {
    expect(ok({ hours: "" }).forecast.days).toBeNull();
    expect(ok({ hours: "0" }).forecast.days).toBeNull();
  });

  it("handles a first-time player and a long climb", () => {
    const fresh = ok({ level: "0", mpInto: "0", target: "30", minutes: "30", winRate: "50" });
    expect(fresh.forecast.remainingMp).toBe(12_308_400);
    expect(fresh.forecast.levelsGained).toBe(30);
    expect(fresh.accents).toEqual([4, 7, 10]);
    expect(fresh.milestones.map((m) => m.level)).toEqual([5, 10, 15, 20, 25, 30]);
  });

  it("accepts thousands separators and decimal commas", () => {
    const view = ok({ mpInto: "3,200", minutes: "35,5" });
    expect(view.input.mpIntoLevel).toBe(3200);
    expect(view.input.minutes).toBe(35.5);
  });
});

describe("evaluateMastery: validation", () => {
  const errorsFor = (over: Partial<MasteryForm>) => {
    const view = evaluateMastery(form(over));
    expect(view.kind).toBe("invalid");
    return view.kind === "invalid" ? view.errors : {};
  };

  it("names the level's real cost when the MP entered is more than the level holds", () => {
    // Level 4 → the next level (5) costs 12,000.
    expect(errorsFor({ mpInto: "12000" }).mpInto).toMatch(/Level 5 costs 12,000 MP/);
    expect(ok({ mpInto: "11999" }).input.mpIntoLevel).toBe(11_999);
  });

  it("follows the level when it changes", () => {
    expect(errorsFor({ level: "0", mpInto: "2000" }).mpInto).toMatch(/Level 1 costs 2,000 MP/);
    expect(errorsFor({ level: "10", mpInto: "35000", target: "12" }).mpInto).toMatch(/Level 11 costs 35,000 MP/);
  });

  it("wants a target above the current level, up to 30", () => {
    expect(errorsFor({ target: "4" }).target).toMatch(/above your current one/);
    expect(errorsFor({ target: "3" }).target).toBeDefined();
    expect(errorsFor({ target: "31" }).target).toBeDefined();
    expect(ok({ target: "5" }).forecast.levelsGained).toBe(1);
  });

  it("keeps the level in range", () => {
    expect(errorsFor({ level: "30" }).level).toBeDefined();
    expect(errorsFor({ level: "-1" }).level).toBeDefined();
    expect(errorsFor({ level: "4.5" }).level).toMatch(/whole number/);
    expect(ok({ level: "29", mpInto: "0", target: "30" }).forecast.levelsGained).toBe(1);
  });

  it.each([
    ["minutes", { minutes: "0" }],
    ["minutes", { minutes: "" }],
    ["minutes", { minutes: "200" }],
    ["winRate", { winRate: "101" }],
    ["winRate", { winRate: "" }],
    ["bonus", { bonus: "-5" }],
    ["bonus", { bonus: "600" }],
    ["hours", { hours: "25" }],
    ["hours", { hours: "lots" }],
    ["lifetime", { lifetime: "1.5" }],
    ["lifetime", { lifetime: "1000" }],
  ] as Array<[MasteryField, Partial<MasteryForm>]>)("flags %s for %j", (field, over) => {
    expect(errorsFor(over)[field]).toEqual(expect.any(String));
  });

  it("does not flag the optional fields when they are empty", () => {
    const view = evaluateMastery(form({ hours: "", lifetime: "" }));
    expect(view.kind).toBe("ok");
  });

  it("reports every bad field at once", () => {
    const errors = errorsFor({ level: "x", mpInto: "x", target: "x", minutes: "x", winRate: "x", bonus: "x" });
    expect(Object.keys(errors).sort()).toEqual(["bonus", "level", "minutes", "mpInto", "target", "winRate"]);
  });
});
