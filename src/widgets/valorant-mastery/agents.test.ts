import { describe, expect, it } from "vitest";
import { VALORANT_AGENTS, sections } from "./definition";

describe("the Mastery overlay's agent list", () => {
  it("has no repeats and is in alphabetical order", () => {
    expect(new Set(VALORANT_AGENTS).size).toBe(VALORANT_AGENTS.length);
    expect([...VALORANT_AGENTS]).toEqual([...VALORANT_AGENTS].sort((a, b) => a.localeCompare(b)));
  });

  it("includes the newest agents", () => {
    for (const name of ["Tejo", "Vyse", "Miks", "Veto", "Waylay"]) expect(VALORANT_AGENTS).toContain(name);
  });

  it("is what the editor's picker offers, so a link to any of them is accepted", () => {
    const control = sections.flatMap((s) => s.controls).find((c) => c.key === "agentName");
    expect(control?.kind).toBe("choice");
    if (control?.kind !== "choice") return;
    expect(control.options.map((o) => o.value)).toEqual([...VALORANT_AGENTS]);
  });
});
