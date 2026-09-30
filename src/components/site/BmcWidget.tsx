"use client";

import { useEffect } from "react";
import { bmc } from "@/config/site";

const SRC = "https://cdnjs.buymeacoffee.com/1.0.0/widget.prod.min.js";

/**
 * Buy Me a Coffee's floating button.
 *
 * Their script reads its settings from a <script data-name="BMC-Widget"> tag and only starts
 * inside a DOMContentLoaded listener. Loaded late (which keeps it off the critical path), that
 * event has already fired, so we replay it once the script is in.
 *
 * Only the site layout renders this. The widget pages OBS loads never do: a coffee button has
 * no business on a stream overlay.
 */
export function BmcWidget() {
  useEffect(() => {
    if (!bmc.widget.enabled) return;

    let cancelled = false;
    const inject = () => {
      if (cancelled || document.querySelector('script[data-name="BMC-Widget"]')) return;

      const w = bmc.widget;
      const phone = window.matchMedia("(max-width: 59.99rem)").matches;

      const script = document.createElement("script");
      script.src = SRC;
      script.async = true;
      script.setAttribute("data-cfasync", "false");
      script.dataset.name = "BMC-Widget";
      script.dataset.id = bmc.handle;
      script.dataset.description = w.description;
      script.dataset.message = w.message;
      script.dataset.color = w.color;
      script.dataset.position = w.position;
      script.dataset.x_margin = String(w.xMargin);
      script.dataset.y_margin = String(phone ? w.yMarginPhone : w.yMargin);
      script.onload = () => window.dispatchEvent(new Event("DOMContentLoaded"));
      document.body.appendChild(script);
    };

    // Wait until the page has settled, then until the browser is idle.
    const whenIdle = () => {
      if ("requestIdleCallback" in window) window.requestIdleCallback(inject, { timeout: 4000 });
      else setTimeout(inject, 1500);
    };

    if (document.readyState === "complete") whenIdle();
    else window.addEventListener("load", whenIdle, { once: true });

    return () => {
      cancelled = true;
      window.removeEventListener("load", whenIdle);
    };
  }, []);

  return null;
}
