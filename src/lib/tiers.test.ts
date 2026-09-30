import { describe, expect, it } from "vitest";
import { progressFor, tierFamily, tierName, tierStep } from "./tiers";

describe("tiers", () => {
  it("names tiers the way the game does", () => {
    expect(tierName(3)).toBe("Iron 1");
    expect(tierName(19)).toBe("Diamond 2");
    expect(tierName(23)).toBe("Ascendant 3");
    expect(tierName(26)).toBe("Immortal 3");
    expect(tierName(27)).toBe("Radiant");
    expect(tierName(0)).toBe("Unrated");
  });

  it("groups ids into families and steps", () => {
    expect(tierFamily(18)).toBe("diamond");
    expect(tierFamily(20)).toBe("diamond");
    expect(tierFamily(21)).toBe("ascendant");
    expect(tierFamily(27)).toBe("radiant");
    expect(tierFamily(1)).toBe("unrated");
    expect(tierStep(18)).toBe(1);
    expect(tierStep(20)).toBe(3);
    expect(tierStep(27)).toBe(0);
  });
});

describe("progressFor", () => {
  it("shows a bar out of 100 up to Ascendant 3", () => {
    expect(progressFor(19, 67)).toEqual({ kind: "bar", rr: 67, toNext: 33, next: "Diamond 3" });
    expect(progressFor(23, 100)).toEqual({ kind: "bar", rr: 100, toNext: 0, next: "Immortal 1" });
  });

  it("does not invent a 100 RR ceiling for Immortal and Radiant", () => {
    expect(progressFor(25, 187)).toEqual({ kind: "open" });
    expect(progressFor(27, 412)).toEqual({ kind: "open" });
  });

  it("has no bar while unrated", () => {
    expect(progressFor(0, 0)).toEqual({ kind: "none" });
  });

  it("clamps RR into the bar's range", () => {
    expect(progressFor(10, 140)).toMatchObject({ rr: 100, toNext: 0 });
    expect(progressFor(10, -5)).toMatchObject({ rr: 0, toNext: 100 });
  });
});
