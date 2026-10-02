"use client";

import { useCallback, useEffect, useRef, type MouseEvent, type PointerEvent, type RefObject } from "react";
import { isOver, offsetIn, tiltFor, type Box } from "@/lib/tilt";

/** How far outside the widget, in screen pixels, still counts as pointing at it. */
const SLOP = 6;

type Options = {
  /** The scaled canvas box, which receives the pointer events (the widget's iframe ignores them). */
  fitRef: RefObject<HTMLDivElement | null>;
  /** The widget's iframe, positioned inside the canvas. */
  frameRef: RefObject<HTMLIFrameElement | null>;
  /** Screen pixels per canvas pixel. */
  scale: number;
  /** Whether clicking the widget plays a game; false when there is nothing to play. */
  canPlay: boolean;
  onPlay: () => void;
};

const wantsCalm = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Lets the widget in the editor's preview answer the pointer: it leans a few degrees toward it, dips when pressed, and a
 * click plays a game. This only ever touches the preview in this page, never the widget page OBS loads. The state lives
 * on the elements (custom properties and data attributes the stylesheet reads), so moving the pointer re-renders nothing.
 * Touch gets the click (a tap) but no lean; reduced motion gets neither the lean nor the dip.
 */
export function useStageTilt({ fitRef, frameRef, scale, canPlay, onPlay }: Options) {
  const pending = useRef(0);
  const point = useRef<{ x: number; y: number } | null>(null);

  /** The widget's box on screen, from its layout box: a tilt doesn't move that, so the edges don't shimmer under the pointer. */
  const boxOf = useCallback((): Box | null => {
    const fit = fitRef.current;
    const widget = frameRef.current;
    if (!fit || !widget) return null;
    const origin = fit.getBoundingClientRect();
    return {
      left: origin.left + widget.offsetLeft * scale,
      top: origin.top + widget.offsetTop * scale,
      width: widget.offsetWidth * scale,
      height: widget.offsetHeight * scale,
    };
  }, [fitRef, frameRef, scale]);

  const rest = useCallback(() => {
    const widget = frameRef.current;
    if (widget) {
      widget.style.removeProperty("--tilt-x");
      widget.style.removeProperty("--tilt-y");
      delete widget.dataset.lean;
      delete widget.dataset.press;
    }
    if (fitRef.current) delete fitRef.current.dataset.over;
  }, [fitRef, frameRef]);

  const lean = useCallback(() => {
    pending.current = 0;
    const widget = frameRef.current;
    const at = point.current;
    const box = boxOf();
    if (!widget || !at || !box) return;
    if (!isOver(at.x, at.y, box, SLOP)) {
      rest();
      return;
    }

    const where = offsetIn(at.x, at.y, box);
    const tilt = tiltFor(where.x, where.y);
    widget.style.setProperty("--tilt-x", `${tilt.x}deg`);
    widget.style.setProperty("--tilt-y", `${tilt.y}deg`);
    widget.dataset.lean = "true";
    if (fitRef.current) {
      if (canPlay) fitRef.current.dataset.over = "true";
      else delete fitRef.current.dataset.over;
    }
  }, [boxOf, canPlay, fitRef, frameRef, rest]);

  useEffect(
    () => () => {
      cancelAnimationFrame(pending.current);
    },
    [],
  );

  const onTheWidget = (event: { clientX: number; clientY: number }) => {
    const box = boxOf();
    return box !== null && isOver(event.clientX, event.clientY, box, SLOP);
  };

  return {
    onPointerMove(event: PointerEvent<HTMLElement>) {
      if (event.pointerType === "touch" || wantsCalm()) return;
      point.current = { x: event.clientX, y: event.clientY };
      if (!pending.current) pending.current = requestAnimationFrame(lean);
    },
    onPointerLeave() {
      point.current = null;
      cancelAnimationFrame(pending.current);
      pending.current = 0;
      rest();
    },
    onPointerDown(event: PointerEvent<HTMLElement>) {
      if (!canPlay || event.button !== 0 || wantsCalm() || !frameRef.current) return;
      if (onTheWidget(event)) frameRef.current.dataset.press = "true";
    },
    onPointerUp() {
      if (frameRef.current) delete frameRef.current.dataset.press;
    },
    onPointerCancel() {
      if (frameRef.current) delete frameRef.current.dataset.press;
    },
    onClick(event: MouseEvent<HTMLElement>) {
      if (canPlay && onTheWidget(event)) onPlay();
    },
  };
}
