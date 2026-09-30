import { describe, expect, it } from "vitest";
import { formatRiotId, guessRegion, isPlatform, isRegion, parseRiotId } from "./riot";

describe("parseRiotId", () => {
  it("splits name and tag", () => {
    expect(parseRiotId("ainz#und3d")).toEqual({ name: "ainz", tag: "und3d" });
  });

  it("trims whitespace around each part", () => {
    expect(parseRiotId("  ainz #  und3d ")).toEqual({ name: "ainz", tag: "und3d" });
  });

  it("allows spaces and non-Latin letters in the name", () => {
    expect(parseRiotId("Night Owl#0001")).toEqual({ name: "Night Owl", tag: "0001" });
    expect(parseRiotId("ナイト#JP1")).toEqual({ name: "ナイト", tag: "JP1" });
  });

  it("splits on the last #", () => {
    expect(parseRiotId("a#b#1234")).toBeNull(); // '#' can't be in a name
  });

  it.each([
    ["", "empty"],
    ["ainz", "no tag"],
    ["#1234", "no name"],
    ["ai#1234", "name too short"],
    ["a".repeat(17) + "#1234", "name too long"],
    ["ainz#12", "tag too short"],
    ["ainz#123456", "tag too long"],
    ["ainz#12 4", "space in tag"],
    ["ain/z#1234", "slash in name"],
    ["ainz?#1234", "question mark in name"],
    ["ainz%#1234", "percent in name"],
  ])("rejects %j (%s)", (input) => {
    expect(parseRiotId(input)).toBeNull();
  });

  it("round-trips through formatRiotId", () => {
    const id = parseRiotId("ainz#und3d")!;
    expect(formatRiotId(id)).toBe("ainz#und3d");
  });
});

describe("guards", () => {
  it("accepts the four regions and two platforms only", () => {
    for (const r of ["na", "eu", "ap", "kr"]) expect(isRegion(r)).toBe(true);
    for (const r of ["latam", "br", "", null, 4]) expect(isRegion(r)).toBe(false);
    expect(isPlatform("pc")).toBe(true);
    expect(isPlatform("console")).toBe(true);
    expect(isPlatform("switch")).toBe(false);
  });
});

describe("guessRegion", () => {
  it("guesses from the time zone and falls back to NA", () => {
    expect(guessRegion("Asia/Manila")).toBe("ap");
    expect(guessRegion("Australia/Sydney")).toBe("ap");
    expect(guessRegion("Asia/Seoul")).toBe("kr");
    expect(guessRegion("Europe/Berlin")).toBe("eu");
    expect(guessRegion("America/New_York")).toBe("na");
    expect(guessRegion(undefined)).toBe("na");
  });
});
