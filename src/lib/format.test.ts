import { describe, expect, it } from "vitest";
import { daysText, dec, hoursText, int, list, signed } from "./format";

describe("numbers", () => {
  it("groups thousands and rounds whole numbers", () => {
    expect(int(98_900)).toBe("98,900");
    expect(int(12_308_400)).toBe("12,308,400");
    expect(int(54.5)).toBe("55");
    expect(int(0)).toBe("0");
  });

  it("trims trailing zeros", () => {
    expect(dec(47.222)).toBe("47.2");
    expect(dec(50)).toBe("50");
    expect(dec(2.44, 2)).toBe("2.44");
    expect(dec(1234.56)).toBe("1,234.6");
  });

  it("signs RR with a real minus", () => {
    expect(signed(2.44)).toBe("+2.44");
    expect(signed(-1.5)).toBe("−1.5");
    expect(signed(0)).toBe("0");
    // Rounds to zero, so it reads as zero rather than "+0".
    expect(signed(0.001)).toBe("0");
    expect(signed(-0.001)).toBe("0");
    expect(signed(18, 0)).toBe("+18");
  });
});

describe("durations", () => {
  it("reads short times in minutes and longer ones in hours", () => {
    expect(hoursText(0.5)).toBe("30 minutes");
    expect(hoursText(0.01)).toBe("1 minute");
    expect(hoursText(1)).toBe("1 hour");
    expect(hoursText(1.04)).toBe("1 hour");
    expect(hoursText(18.083)).toBe("18.1 hours");
    expect(hoursText(250)).toBe("250 hours");
  });

  it("reads days", () => {
    expect(daysText(0.4)).toBe("under a day");
    expect(daysText(1)).toBe("1 day");
    expect(daysText(9.04)).toBe("9 days");
    expect(daysText(9.5)).toBe("9.5 days");
    expect(daysText(31.6)).toBe("32 days");
  });
});

describe("list", () => {
  it("joins names the way a person would", () => {
    expect(list([])).toBe("");
    expect(list(["Jett"])).toBe("Jett");
    expect(list(["Jett", "Sage"])).toBe("Jett and Sage");
    expect(list(["Jett", "Sage", "Omen"])).toBe("Jett, Sage and Omen");
  });
});
