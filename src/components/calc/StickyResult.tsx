"use client";

import { useEffect, useState, type ReactNode } from "react";

/**
 * Phones only (CSS hides it on desktop): the headline figure stays under your thumb while you work through the fields.
 * It shows only while the calculator is on screen and the full result isn't, so it never repeats the panel beside it
 * and isn't left hanging over the FAQ and footer.
 */
export function StickyResult({ calculatorId, resultId, children }: { calculatorId: string; resultId: string; children: ReactNode }) {
  const [show, setShow] = useState(true);

  useEffect(() => {
    const calculator = document.getElementById(calculatorId);
    const result = document.getElementById(resultId);
    if (!calculator || !result || typeof IntersectionObserver === "undefined") return;

    const seen = { calculator: true, result: false };
    const update = () => setShow(seen.calculator && !seen.result);
    // Shrink the viewport by the sticky nav above and this bar below, so "in view" means actually readable.
    const rootMargin = "-56px 0px -72px 0px";

    const a = new IntersectionObserver(([entry]) => {
      seen.calculator = entry.isIntersecting;
      update();
    }, { rootMargin });
    const b = new IntersectionObserver(([entry]) => {
      seen.result = entry.isIntersecting;
      update();
    }, { rootMargin });

    a.observe(calculator);
    b.observe(result);
    return () => {
      a.disconnect();
      b.disconnect();
    };
  }, [calculatorId, resultId]);

  return (
    <aside className="stickybar" hidden={!show} aria-label="Your estimate, summary">
      {children}
    </aside>
  );
}
