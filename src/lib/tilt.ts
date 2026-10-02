// The editor's preview leans toward the pointer a few degrees, like a card under a thumb. This is the maths, kept apart
// from the DOM so it can be tested; src/components/playground/useStageTilt.ts does the listening.

/** The most the widget ever leans, in degrees. Enough to feel; not enough to hide how it will look in OBS. */
export const MAX_TILT = 3.5;

export type Box = { left: number; top: number; width: number; height: number };
export type Tilt = { x: number; y: number };

const clamp = (value: number) => Math.min(1, Math.max(-1, value));

/** Rounded, and never -0, so the style string stays steady while the pointer sits still. */
const tidy = (value: number) => Math.round(value * 100) / 100 + 0;

/** True when a point is inside a box grown by `slop` pixels on every side. */
export function isOver(x: number, y: number, box: Box, slop = 0): boolean {
  return x >= box.left - slop && x <= box.left + box.width + slop && y >= box.top - slop && y <= box.top + box.height + slop;
}

/**
 * Where the pointer sits in a box, from -1 (left or top edge) to 1 (right or bottom edge), 0 at the centre. A pointer
 * outside the box reads as its nearest edge.
 */
export function offsetIn(x: number, y: number, box: Box): { x: number; y: number } {
  const w = box.width / 2 || 1;
  const h = box.height / 2 || 1;
  return { x: clamp((x - (box.left + w)) / w), y: clamp((y - (box.top + h)) / h) };
}

/**
 * How far to turn the widget about each axis, in degrees, given where the pointer sits in it (see offsetIn). The side
 * the pointer is on is pressed away from the viewer, like a card under a finger: the right edge dips for a pointer on the
 * right, the bottom edge for one below the middle. The turn is proportional and capped.
 */
export function tiltFor(px: number, py: number, max = MAX_TILT): Tilt {
  return { x: tidy(-clamp(py) * max), y: tidy(clamp(px) * max) };
}
