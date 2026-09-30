import { describe, expect, it } from "vitest";
import { parseTierIcons } from "./tier-icons";

const media = "https://media.valorant-api.com/competitivetiers/abc";

describe("parseTierIcons", () => {
  it("maps tier id to icon and uses the latest season", () => {
    const icons = parseTierIcons({
      data: [
        { tiers: [{ tier: 19, largeIcon: `${media}/old/19/largeicon.png` }] },
        {
          tiers: [
            { tier: 18, largeIcon: `${media}/new/18/largeicon.png` },
            { tier: 19, largeIcon: `${media}/new/19/largeicon.png` },
          ],
        },
      ],
    });
    expect(icons).toEqual({ "18": `${media}/new/18/largeicon.png`, "19": `${media}/new/19/largeicon.png` });
  });

  it("only accepts icons hosted on valorant-api's media host", () => {
    const icons = parseTierIcons({
      data: [
        {
          tiers: [
            { tier: 3, largeIcon: "https://evil.example/3.png" },
            { tier: 4, largeIcon: `${media}/4.png` },
            { tier: 5, largeIcon: "http://media.valorant-api.com/5.png" },
          ],
        },
      ],
    });
    expect(Object.keys(icons)).toEqual(["4"]);
  });

  it("returns nothing for junk instead of throwing", () => {
    expect(parseTierIcons(null)).toEqual({});
    expect(parseTierIcons({})).toEqual({});
    expect(parseTierIcons({ data: [{ tiers: [{ tier: "x", largeIcon: 5 }] }] })).toEqual({});
  });
});
