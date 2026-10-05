import { describe, expect, it } from "vitest";
import { pageList } from "@/config/pages";
import { controlsOf } from "@/lib/schema";
import { widgets } from "@/widgets/registry";
import { MASTERY_REACTION_KINDS } from "@/widgets/valorant-mastery/reactions";
import { REACTION_KINDS } from "@/widgets/valorant-rank/reactions";
import { PRESETS } from "@/widgets/valorant-rank/themes";
import {
  EVENTS,
  EVENT_NAMES,
  LAYOUTS,
  PAGES,
  THEMES,
  TRYOUTS,
  WIDGETS,
  encodeEvent,
  labelsValid,
  parseEvent,
  toDataPoint,
  type EventName,
} from "./events";

/** Every event with every combination of labels it allows. */
function everyAllowed(): Array<{ event: EventName; first: string; second: string }> {
  return EVENT_NAMES.flatMap((event) => {
    const spec: { first: readonly string[]; second?: readonly string[] } = EVENTS[event];
    return spec.first.flatMap((first) => (spec.second ? spec.second.map((second) => ({ event, first, second })) : [{ event, first, second: "" }]));
  });
}

describe("what can be counted", () => {
  it("is a short, fixed list of plain words, never free text", () => {
    for (const { event, first, second } of everyAllowed()) {
      for (const word of [event, first, ...(second ? [second] : [])]) expect(word).toMatch(/^[a-z][a-z0-9_-]{0,23}$/);
    }
  });

  it("can only ever be a few dozen different things", () => {
    expect(everyAllowed().length).toBeLessThan(100);
  });

  it("has no event that could carry a Riot ID, region, key or address", () => {
    const labels = new Set(everyAllowed().flatMap((x) => [x.first, x.second]));
    for (const forbidden of ["na", "eu", "ap", "kr", "pc", "console"]) expect(labels.has(forbidden)).toBe(false);
    for (const word of labels) expect(word).not.toMatch(/[#@.\/]|hdev/i);
  });
});

describe("the lists match the real thing, so nothing can be added without being listed", () => {
  it("has every widget, and only those", () => {
    expect([...WIDGETS].sort()).toEqual(Object.keys(widgets).sort());
  });

  it("has every theme, and only those", () => {
    expect([...THEMES].sort()).toEqual(Object.keys(PRESETS).sort());
    for (const widget of Object.values(widgets)) {
      const preset = controlsOf(widget.schema).find((c) => c.key === "preset");
      expect(preset?.kind).toBe("choice");
      if (preset?.kind === "choice") expect(preset.options.map((o) => o.value).sort()).toEqual([...THEMES].sort());
    }
  });

  it("has every layout, and only those", () => {
    for (const widget of Object.values(widgets)) {
      const layout = controlsOf(widget.schema).find((c) => c.key === "layout");
      expect(layout?.kind).toBe("choice");
      if (layout?.kind === "choice") expect(layout.options.map((o) => o.value).sort()).toEqual([...LAYOUTS].sort());
    }
  });

  it("has every try-a-game button, and only those", () => {
    expect([...TRYOUTS].sort()).toEqual([...REACTION_KINDS, ...MASTERY_REACTION_KINDS].sort());
    for (const widget of Object.values(widgets)) {
      for (const option of widget.tryouts?.options ?? []) expect(TRYOUTS).toContain(option.kind);
    }
  });

  it("has every page", () => {
    for (const page of pageList) expect(PAGES).toContain(page.id);
    expect(PAGES).toContain("other");
  });
});

describe("encodeEvent and parseEvent", () => {
  it("round-trip every allowed event", () => {
    for (const x of everyAllowed()) {
      expect(parseEvent(encodeEvent(x.event, x.first, x.second))).toEqual(x);
    }
  });

  it("keep the message small and leave out an empty second label", () => {
    expect(encodeEvent("link_copied", "valorant-rank")).toBe('{"e":"link_copied","a":"valorant-rank"}');
    expect(encodeEvent("visit", "overlay", "reddit")).toBe('{"e":"visit","a":"overlay","b":"reddit"}');
    for (const x of everyAllowed()) expect(encodeEvent(x.event, x.first, x.second).length).toBeLessThan(100);
  });

  it.each([
    ["not JSON", "visit overlay reddit"],
    ["an empty body", ""],
    ["a number", "7"],
    ["null", "null"],
    ["an array", '["visit","overlay","reddit"]'],
    ["an event that doesn't exist", '{"e":"purchase","a":"overlay"}'],
    ["a prototype name", '{"e":"constructor","a":"overlay"}'],
    ["a label from another event", '{"e":"theme_picked","a":"card"}'],
    ["a label that isn't listed", '{"e":"visit","a":"overlay","b":"facebook"}'],
    ["a Riot ID in a label", '{"e":"visit","a":"ainz#und3d","b":"direct"}'],
    ["a missing first label", '{"e":"link_copied"}'],
    ["a missing second label where one is needed", '{"e":"visit","a":"overlay"}'],
    ["a second label where there is none", '{"e":"link_copied","a":"valorant-rank","b":"live"}'],
    ["a label that isn't text", '{"e":"visit","a":1,"b":"direct"}'],
    ["an extra field", '{"e":"visit","a":"overlay","b":"direct","id":"abc"}'],
    ["a different casing", '{"e":"Visit","a":"overlay","b":"direct"}'],
  ])("reject %s", (_what, body) => {
    expect(parseEvent(body)).toBeNull();
  });
});

describe("labelsValid", () => {
  it("accepts exactly what the event allows", () => {
    expect(labelsValid("visit", "rank", "tiktok")).toBe(true);
    expect(labelsValid("visit", "rank", "")).toBe(false);
    expect(labelsValid("link_copied", "valorant-mastery", "")).toBe(true);
    expect(labelsValid("link_copied", "valorant-mastery", "x")).toBe(false);
    expect(labelsValid("nope", "a", "")).toBe(false);
  });
});

describe("toDataPoint", () => {
  it("writes the event as the index and first blob, then its labels, counted once", () => {
    expect(toDataPoint({ event: "visit", first: "overlay", second: "reddit" })).toEqual({
      indexes: ["visit"],
      blobs: ["visit", "overlay", "reddit"],
      doubles: [1],
    });
    expect(toDataPoint({ event: "link_copied", first: "valorant-rank", second: "" }).blobs).toEqual(["link_copied", "valorant-rank", ""]);
  });
});
