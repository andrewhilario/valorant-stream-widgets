import { describe, expect, it } from "vitest";
import { cumulativeMp, matchesNeeded } from "@/lib/mastery";
import { GAME_MODES, lengthLabel, typicalMinutes } from "@/lib/modes";
import { controlsOf } from "@/lib/schema";
import { defaults, schema } from "@/widgets/valorant-rank/definition";
import { REACTION_KINDS, REACTION_LABELS } from "@/widgets/valorant-rank/reactions";
import { faqForLd, masteryFaq, overlayFaq, rankFaq, type FaqItem } from "./faq";

const all: Array<[string, FaqItem[]]> = [
  ["overlay", overlayFaq],
  ["rank", rankFaq],
  ["mastery", masteryFaq],
];
const answer = (items: FaqItem[], question: RegExp) => items.find((i) => question.test(i.q))?.paragraphs.join(" ") ?? "";

describe.each(all)("%s FAQ", (_name, items) => {
  it("has questions, each with an answer", () => {
    expect(items.length).toBeGreaterThanOrEqual(5);
    for (const item of items) {
      expect(item.q.endsWith("?")).toBe(true);
      expect(item.paragraphs.length).toBeGreaterThan(0);
      for (const p of item.paragraphs) expect(p.trim().length).toBeGreaterThan(20);
    }
  });

  it("never asks the same question twice", () => {
    expect(new Set(items.map((i) => i.q)).size).toBe(items.length);
  });

  it("gives the structured data exactly the words on the page", () => {
    const ld = faqForLd(items);
    expect(ld.map((x) => x.q)).toEqual(items.map((i) => i.q));
    expect(ld.map((x) => x.a)).toEqual(items.map((i) => i.paragraphs.join(" ")));
  });
});

describe("the overlay FAQ and the editor's controls", () => {
  // The labels come from the real schema and registry, so the answers can't drift from what the editor says.
  const labelOf = (key: string) => controlsOf(schema).find((c) => c.key === key)!.label;
  const sectionOf = (key: string) => schema.sections.find((s) => s.controls.some((c) => c.key === key))!.label;

  it("sends people to the reactions controls and buttons by the labels they carry", () => {
    const reactions = answer(overlayFaq, /react when I win/);
    for (const text of [
      ...REACTION_KINDS.map((kind) => REACTION_LABELS[kind]),
      labelOf("reactions"),
      labelOf("animate"),
      sectionOf("reactions"),
    ]) {
      expect(reactions).toContain(text);
    }
  });

  it("says the reactions are off when Animate changes is, which is how the editor behaves", () => {
    expect(answer(overlayFaq, /react when I win/)).toMatch(new RegExp(`off whenever ${labelOf("animate")} is off`));
    expect(controlsOf(schema).find((c) => c.key === "reactions")?.showWhen?.({ ...defaults, animate: false })).toBe(false);
  });

  it("sends people to the colour controls by their labels too", () => {
    const colours = answer(overlayFaq, /own colours and fonts/);
    expect(colours).toContain(`${sectionOf("accent")}, ${labelOf("accent")}`);
    expect(colours).toContain("three themes");
    expect(controlsOf(schema).find((c) => c.key === "preset")).toMatchObject({ display: "gallery" });
  });
});

describe("the Mastery FAQ and game modes", () => {
  const modesAnswer = answer(masteryFaq, /Which game modes earn/);

  it("names every mode that earns Mastery Points, with Riot's estimated game time for each", () => {
    for (const mode of GAME_MODES) {
      expect(modesAnswer).toContain(mode.name);
      expect(modesAnswer).toContain(`${mode.name} ${lengthLabel(mode)}`);
    }
  });

  it("says no mode is faster per hour, and backs it with figures worked out by the calculator's own maths", () => {
    const fastest = answer(masteryFaq, /fastest/);
    expect(fastest).toMatch(/hours are the same in any mode/);
    const comp = matchesNeeded(cumulativeMp(10), typicalMinutes(GAME_MODES.find((m) => m.id === "competitive")!), 50);
    const swift = matchesNeeded(cumulativeMp(10), typicalMinutes(GAME_MODES.find((m) => m.id === "swiftplay")!), 50);
    expect(fastest).toContain(`${comp} Competitive matches`);
    expect(fastest).toContain(`${swift} Swiftplay matches`);
    // And says what it can't know.
    expect(fastest).toMatch(/Performance Score, which Riot hasn’t published/);
  });

  it("agrees with the other answer that quotes the same climb", () => {
    // "42 matches and about 24.5 hours" at 35 minutes and 50% wins, typed by hand in the Act Level 10 answer.
    const hand = answer(masteryFaq, /reach Act Level 10/);
    const comp = matchesNeeded(cumulativeMp(10), 35, 50);
    expect(hand).toContain(`${comp} matches`);
    expect(hand).toContain("24.5 hours");
  });
});

describe("the rank FAQ and game modes", () => {
  it("says only Competitive changes RR, and points to the Mastery calculator for the other modes", () => {
    const modes = answer(rankFaq, /Unrated, Swiftplay or other modes/);
    expect(modes).toMatch(/Only Competitive games change your RR/);
    expect(modes).toMatch(/Unrated, Swiftplay, Spike Rush and Team Deathmatch/);
    expect(modes).toMatch(/Agent Mastery calculator/);
  });
});
