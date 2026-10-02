import { describe, expect, it } from "vitest";
import { defaults, flagVisible, readConfig, schema } from "@/widgets/valorant-rank/definition";
import {
  applyChoice,
  fromLocation,
  fromParams,
  hasFlag,
  sanitize,
  sanitizeValue,
  secretHash,
  toParams,
  controlsOf,
  withChoice,
  type ChoiceControl,
} from "./schema";

const control = (key: string) => controlsOf(schema).find((c) => c.key === key)!;
const choice = (key: string) => {
  const found = control(key);
  if (found.kind !== "choice") throw new Error(`${key} is not a choice`);
  return found satisfies ChoiceControl;
};

describe("link format", () => {
  it("is empty when nothing differs from the defaults", () => {
    expect(toParams(schema, defaults).toString()).toBe("");
  });

  it("carries only what changed, with short readable keys", () => {
    const link = toParams(schema, { ...defaults, riotId: "ainz#und3d", region: "ap", scale: 120, marks: false });
    expect(link.get("id")).toBe("ainz#und3d");
    expect(link.get("r")).toBe("ap");
    expect(link.get("s")).toBe("120");
    expect(link.get("mk")).toBe("0");
    expect([...link.keys()].sort()).toEqual(["id", "mk", "r", "s"]);
  });

  it("round-trips a full config", () => {
    const config = {
      ...defaults,
      riotId: "Night Owl#0001",
      region: "eu",
      platform: "console",
      layout: "strip",
      show: "progress,net,wr",
      scale: 135,
      preset: "paper",
      accent: "2fd0c8",
      opacity: 75,
      corners: "round",
      font: "mono",
      progress: "accent",
      signals: "safe",
      marks: false,
      animate: false,
      reactions: false,
      sessionMode: "window",
      gap: 6,
      windowHours: 12,
      refresh: 120,
    };
    const parsed = fromParams(schema, new URLSearchParams(toParams(schema, config).toString()));
    expect(parsed).toEqual(config);
  });

  it("keeps the Riot ID's # and spaces intact through encoding", () => {
    const query = toParams(schema, { ...defaults, riotId: "Night Owl#0001" }).toString();
    expect(query).toContain("%23");
    expect(fromParams(schema, new URLSearchParams(query)).riotId).toBe("Night Owl#0001");
  });
});

describe("secrets (the API key)", () => {
  const KEY = "HDEV-00000000-1111-2222-3333-444444444444";

  it("never appear in the query string or the editor's address bar", () => {
    const query = toParams(schema, { ...defaults, riotId: "ainz#und3d", apiKey: KEY }).toString();
    expect(query).not.toContain("HDEV");
    expect(query).not.toContain("k=");
  });

  it("travel in the #fragment, which browsers never send to a server", () => {
    expect(secretHash(schema, { ...defaults, apiKey: KEY })).toBe(`k=${KEY}`);
    expect(secretHash(schema, defaults)).toBe("");
  });

  it("are trimmed and URL-encoded in the fragment", () => {
    expect(secretHash(schema, { ...defaults, apiKey: `  ${KEY}  ` })).toBe(`k=${KEY}`);
  });

  it("can be masked for display", () => {
    const shown = secretHash(schema, { ...defaults, apiKey: KEY }, true);
    expect(shown).toBe("k=••••••••");
    expect(shown).not.toContain("HDEV");
  });

  it("are read from the fragment only, never from the query", () => {
    expect(fromParams(schema, new URLSearchParams({ k: KEY })).apiKey).toBe("");
    expect(fromLocation(schema, `?k=${KEY}`, "").apiKey).toBe("");
    expect(fromLocation(schema, "?id=ainz%23und3d&r=ap", `#k=${KEY}`).apiKey).toBe(KEY);
    expect(fromLocation(schema, "", `k=${KEY}`).apiKey).toBe(KEY);
  });

  it("round-trip with the rest of the link through query plus fragment", () => {
    const config = { ...defaults, riotId: "ainz#und3d", region: "ap", apiKey: KEY };
    const link = `?${toParams(schema, config).toString()}#${secretHash(schema, config)}`;
    const [search, hash] = link.split("#");
    expect(fromLocation(schema, search, `#${hash}`)).toEqual(config);
  });
});

describe("validation", () => {
  it("replaces unknown choices with the default", () => {
    expect(sanitizeValue(control("layout"), "hologram")).toBe("card");
    expect(sanitizeValue(control("region"), "latam")).toBe("na");
  });

  it("clamps and snaps ranges", () => {
    expect(sanitizeValue(control("scale"), 9999)).toBe(200);
    expect(sanitizeValue(control("scale"), -4)).toBe(60);
    expect(sanitizeValue(control("scale"), "103")).toBe(105);
    expect(sanitizeValue(control("scale"), "abc")).toBe(100);
    expect(sanitizeValue(control("refresh"), 10)).toBe(30);
  });

  it("accepts colours as bare hex, with or without #, and rejects the rest", () => {
    expect(sanitizeValue(control("accent"), "#FF4655")).toBe("ff4655");
    expect(sanitizeValue(control("accent"), "ff4655")).toBe("ff4655");
    expect(sanitizeValue(control("accent"), "red")).toBe("");
    expect(sanitizeValue(control("accent"), "")).toBe("");
  });

  it("reads toggles from 1/0 and true/false", () => {
    expect(sanitizeValue(control("marks"), "0")).toBe(false);
    expect(sanitizeValue(control("marks"), "1")).toBe(true);
    expect(sanitizeValue(control("marks"), "maybe")).toBe(true);
  });

  it("strips control characters from text and caps its length, without trimming", () => {
    expect(sanitizeValue(control("riotId"), "ai\u0000nz#1\n234")).toBe("ainz#1234");
    expect(sanitizeValue(control("riotId"), "a b ")).toBe("a b ");
    expect(String(sanitizeValue(control("riotId"), "x".repeat(99))).length).toBe(24);
  });

  it("ignores unknown keys and fills missing ones", () => {
    const config = sanitize(schema, { layout: "strip", evil: "<script>" });
    expect(config.layout).toBe("strip");
    expect(config).not.toHaveProperty("evil");
    expect(config.region).toBe("na");
  });
});

describe("module flags", () => {
  it("keeps canonical order whatever order they arrive in, and drops unknowns", () => {
    expect(sanitizeValue(control("show"), "wr,peak,bogus,net")).toBe("peak,net,wr");
  });

  it("distinguishes 'none' from 'all'", () => {
    expect(sanitizeValue(control("show"), "")).toBe("");
    const link = toParams(schema, { ...defaults, show: "" });
    expect(link.has("sh")).toBe(true);
    expect(fromParams(schema, new URLSearchParams(link.toString())).show).toBe("");
  });

  it("only draws a module when it is on and the layout has room for it", () => {
    const card = readConfig({ ...defaults });
    expect(flagVisible(card, "peak")).toBe(true);
    const badge = readConfig({ ...defaults, layout: "badge" });
    expect(flagVisible(badge, "peak")).toBe(false);
    expect(flagVisible(badge, "last")).toBe(true);
    expect(hasFlag("peak,net", "net")).toBe(true);
  });

  it("gives the Stack layout (vertical streams) every module", () => {
    const stack = readConfig({ ...defaults, layout: "stack" });
    for (const flag of ["peak", "progress", "last", "net", "gl", "rec", "wr"]) {
      expect(flagVisible(stack, flag)).toBe(true);
    }
    const strip = readConfig({ ...defaults, layout: "strip" });
    expect(flagVisible(strip, "gl")).toBe(false);
  });
});

describe("presets", () => {
  it("apply their bundle and reset the accent to the theme's own", () => {
    const preset = control("preset");
    if (preset.kind !== "choice" || !preset.onSelect) throw new Error("preset control has no onSelect");
    expect(preset.onSelect("clean")).toMatchObject({ corners: "round", font: "grotesk", marks: false, progress: "accent", accent: "" });
    expect(preset.onSelect("nope")).toEqual({});
  });

  it("agree with the defaults for the default preset", () => {
    const preset = control("preset");
    if (preset.kind !== "choice" || !preset.onSelect) throw new Error("preset control has no onSelect");
    const bundle = preset.onSelect("tactical");
    for (const [key, value] of Object.entries(bundle)) expect(defaults[key]).toBe(value);
  });
});

describe("picking a choice", () => {
  it("sets the value and then whatever the option bundles with it, and leaves the rest alone", () => {
    const start = { ...defaults, riotId: "ainz#und3d", scale: 140, accent: "ff4655" };
    const picked = applyChoice(choice("preset"), start, "paper");
    expect(picked).toMatchObject({ preset: "paper", corners: "sharp", font: "grotesk", accent: "", riotId: "ainz#und3d", scale: 140 });
  });

  it("does not change what it was given", () => {
    const start = { ...defaults };
    applyChoice(choice("preset"), start, "clean");
    expect(start).toEqual(defaults);
  });

  it("is a plain value change for a choice that bundles nothing", () => {
    expect(applyChoice(choice("layout"), defaults, "strip")).toEqual({ ...defaults, layout: "strip" });
  });

  it("previews a pick the way picking it would, without touching the settings", () => {
    const controls = controlsOf(schema);
    const start = { ...defaults, scale: 150 };
    expect(withChoice(controls, start, "preset", "clean")).toEqual(applyChoice(choice("preset"), start, "clean"));
    expect(start).toEqual({ ...defaults, scale: 150 });
  });

  it("ignores anything that isn't a valid pick of a choice", () => {
    const controls = controlsOf(schema);
    expect(withChoice(controls, defaults, "preset", "neon")).toBe(defaults);
    expect(withChoice(controls, defaults, "nope", "clean")).toBe(defaults);
    expect(withChoice(controls, defaults, "scale", "120")).toBe(defaults);
  });
});

describe("the theme gallery", () => {
  const theme = choice("preset");

  it("is drawn as cards, one miniature per theme", () => {
    expect(theme.display).toBe("gallery");
    expect(theme.options.length).toBeGreaterThanOrEqual(3);
    for (const option of theme.options) {
      expect(option.note, option.value).toBeTruthy();
      expect(option.swatch, option.value).toBeDefined();
    }
  });

  it("leaves the other choices as plain segmented bars", () => {
    for (const key of ["region", "platform", "layout", "corners", "font", "progress", "signals", "sessionMode"]) {
      expect(choice(key).display, key).toBeUndefined();
    }
  });
});

describe("the reactions setting", () => {
  it("is on by default, so a link without it reacts, and a link that turns it off says so", () => {
    expect(defaults.reactions).toBe(true);
    expect(toParams(schema, defaults).has("rx")).toBe(false);
    expect(toParams(schema, { ...defaults, reactions: false }).get("rx")).toBe("0");
    expect(fromParams(schema, new URLSearchParams("rx=0")).reactions).toBe(false);
  });

  it("is offered only while the overlay animates at all", () => {
    const reactions = control("reactions");
    expect(reactions.showWhen?.({ ...defaults, animate: true })).toBe(true);
    expect(reactions.showWhen?.({ ...defaults, animate: false })).toBe(false);
  });
});
