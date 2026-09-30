import { describe, expect, it } from "vitest";
import { defaults } from "./valorant-rank/definition";
import { defaultWidgetId, getWidget } from "./registry";

const widget = getWidget(defaultWidgetId)!;
const KEY = "HDEV-00000000-1111-2222-3333-444444444444";

describe("what's needed for a working link", () => {
  it("asks for the Riot ID first, then the key, then nothing", () => {
    expect(widget.needs(defaults)).toEqual({ message: "Add your Riot ID", focus: "riotId" });
    expect(widget.needs({ ...defaults, riotId: "ainz#und3d" })).toEqual({ message: "Add your HenrikDev key", focus: "apiKey" });
    expect(widget.needs({ ...defaults, riotId: "ainz#und3d", apiKey: "nope" })?.focus).toBe("apiKey");
    expect(widget.needs({ ...defaults, riotId: "ainz#und3d", apiKey: KEY })).toBeNull();
  });

  it("does not let a key stand in for a missing Riot ID", () => {
    expect(widget.needs({ ...defaults, apiKey: KEY })?.focus).toBe("riotId");
  });
});

describe("first run", () => {
  it("guesses the region from the time zone", () => {
    expect(widget.firstRun?.(defaults, { timeZone: "Asia/Manila" }).region).toBe("ap");
    expect(widget.firstRun?.(defaults, { timeZone: "Europe/Paris" }).region).toBe("eu");
  });
});
