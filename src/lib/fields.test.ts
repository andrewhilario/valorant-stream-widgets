import { describe, expect, it } from "vitest";
import { parseField, parseNumeric } from "./fields";

describe("parseNumeric", () => {
  it.each([
    ["35", 35],
    ["35.5", 35.5],
    [".5", 0.5],
    ["0", 0],
    ["  42  ", 42],
    ["1 200", 1200],
    ["1 200", 1200],
    ["12,000", 12000],
    ["1,234,567", 1234567],
    ["12,000.5", 12000.5],
    ["0,5", 0.5],
    ["35,5", 35.5],
    ["7,25", 7.25],
  ])("reads %j as %d", (raw, expected) => {
    expect(parseNumeric(raw)).toBe(expected);
  });

  it("does not confuse a thousands comma with a decimal comma", () => {
    // Three digits after the comma: thousands. One or two: a decimal.
    expect(parseNumeric("2,500")).toBe(2500);
    expect(parseNumeric("2,50")).toBe(2.5);
  });

  it.each(["", "   ", "abc", "12abc", "-5", "+5", "1e3", "1..2", "1,2,3", "12,3456", "1,0000", ",5", "5,", ".", "0x10", "١٢"])(
    "rejects %j",
    (raw) => {
      expect(parseNumeric(raw)).toBeNull();
    },
  );
});

describe("parseField", () => {
  const rule = { min: 0, max: 99, integer: true };

  it("returns the number when it's valid", () => {
    expect(parseField("67", rule)).toEqual({ value: 67, error: null });
    expect(parseField("0", rule)).toEqual({ value: 0, error: null });
    expect(parseField("99", rule)).toEqual({ value: 99, error: null });
  });

  it("asks for a number when the field is empty", () => {
    expect(parseField("", rule)).toEqual({ value: null, error: "Enter a number." });
    expect(parseField("  ", rule)).toEqual({ value: null, error: "Enter a number." });
  });

  it("lets an optional field be empty", () => {
    expect(parseField("", { ...rule, optional: true })).toEqual({ value: null, error: null });
    // But not wrong.
    expect(parseField("x", { ...rule, optional: true }).error).not.toBeNull();
  });

  it("says what a non-number should look like", () => {
    expect(parseField("lots", rule).error).toMatch(/digits/i);
  });

  it("rejects fractions where a whole number is needed, and allows them elsewhere", () => {
    expect(parseField("6.5", rule).error).toMatch(/whole number/i);
    expect(parseField("6.5", { min: 0, max: 10 })).toEqual({ value: 6.5, error: null });
  });

  it("states the allowed range, and lets a rule explain it better", () => {
    expect(parseField("100", rule).error).toBe("Enter a number from 0 to 99.");
    expect(parseField("-1", rule).error).toMatch(/digits/i);
    expect(parseField("100", { ...rule, rangeMessage: "RR stops at 99." }).error).toBe("RR stops at 99.");
    expect(parseField("300000", { min: 0, max: 205_000 }).error).toBe("Enter a number from 0 to 205,000.");
  });
});
