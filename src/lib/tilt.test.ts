import { describe, expect, it } from "vitest";
import { MAX_TILT, isOver, offsetIn, tiltFor } from "./tilt";

const box = { left: 100, top: 50, width: 200, height: 100 };

describe("isOver", () => {
  it("is true inside the box, on its edge, and false outside", () => {
    expect(isOver(150, 80, box)).toBe(true);
    expect(isOver(100, 50, box)).toBe(true);
    expect(isOver(300, 150, box)).toBe(true);
    expect(isOver(99, 80, box)).toBe(false);
    expect(isOver(150, 151, box)).toBe(false);
  });

  it("grows the box by the slop on every side", () => {
    expect(isOver(96, 80, box, 4)).toBe(true);
    expect(isOver(95, 80, box, 4)).toBe(false);
    expect(isOver(150, 154, box, 4)).toBe(true);
    expect(isOver(150, 155, box, 4)).toBe(false);
  });
});

describe("offsetIn", () => {
  it("reads the centre as zero and the edges as plus or minus one", () => {
    expect(offsetIn(200, 100, box)).toEqual({ x: 0, y: 0 });
    expect(offsetIn(100, 50, box)).toEqual({ x: -1, y: -1 });
    expect(offsetIn(300, 150, box)).toEqual({ x: 1, y: 1 });
  });

  it("is proportional between", () => {
    expect(offsetIn(250, 125, box)).toEqual({ x: 0.5, y: 0.5 });
  });

  it("reads a pointer outside the box as its nearest edge", () => {
    expect(offsetIn(9999, -9999, box)).toEqual({ x: 1, y: -1 });
  });

  it("copes with a box that has no size yet", () => {
    const flat = { left: 10, top: 10, width: 0, height: 0 };
    const { x, y } = offsetIn(10, 10, flat);
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
  });
});

describe("tiltFor", () => {
  it("is flat with the pointer at the centre, and never reports -0", () => {
    const flat = tiltFor(0, 0);
    expect(flat).toEqual({ x: 0, y: 0 });
    expect(Object.is(flat.x, 0) && Object.is(flat.y, 0)).toBe(true);
    expect(Object.is(tiltFor(1, 0).x, 0)).toBe(true);
  });

  it("presses away the side the pointer is on", () => {
    // rotateY(+) sends the right edge away; rotateX(-) sends the bottom edge away.
    expect(tiltFor(1, 0).y).toBe(MAX_TILT);
    expect(tiltFor(-1, 0).y).toBe(-MAX_TILT);
    expect(tiltFor(0, 1).x).toBe(-MAX_TILT);
    expect(tiltFor(0, -1).x).toBe(MAX_TILT);
  });

  it("grows in proportion and is capped", () => {
    expect(tiltFor(0.5, 0).y).toBe(MAX_TILT / 2);
    expect(tiltFor(40, -40)).toEqual({ x: MAX_TILT, y: MAX_TILT });
  });

  it("stays subtle", () => {
    expect(MAX_TILT).toBeLessThanOrEqual(5);
    expect(tiltFor(1, 1, 8)).toEqual({ x: -8, y: 8 });
  });

  it("rounds to two places so the style doesn't churn", () => {
    expect(tiltFor(1 / 3, 0).y).toBe(1.17);
  });
});
