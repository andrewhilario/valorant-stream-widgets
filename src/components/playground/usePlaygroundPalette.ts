"use client";

import { useMemo } from "react";
import { usePaletteItems, type PaletteItem } from "../site/PaletteProvider";
import type { Playground } from "./usePlayground";

/** Lists the editor's settings and actions in the site-wide ⌘K palette. */
export function usePlaygroundPalette(pg: Playground) {
  const { widget, config, url, sample, view, backdrop, format, needs } = pg;

  const items = useMemo<PaletteItem[]>(() => {
    const out: PaletteItem[] = [];

    out.push({
      id: "copy",
      group: "Actions",
      label: "Copy OBS link",
      detail: url ? undefined : needs?.message,
      words: "link url clipboard browser source",
      run: () => (url ? void pg.copy() : pg.focusControl(needs?.focus ?? "riotId")),
    });
    out.push({
      id: "format",
      group: "Actions",
      label: format === "vertical" ? "Preview a landscape canvas" : "Preview a vertical canvas",
      detail: format === "vertical" ? "1920 × 1080" : "1080 × 1920, for TikTok-style streams",
      words: "tiktok portrait 9:16 16:9 orientation stream format",
      run: () => pg.setFormat(format === "vertical" ? "landscape" : "vertical"),
    });
    if (String(config.apiKey ?? "") !== "") {
      out.push({
        id: "forget-key",
        group: "Actions",
        label: "Remove my API key from this browser",
        detail: "Your OBS links keep working",
        words: "forget delete clear secret token henrik",
        run: () => pg.set("apiKey", ""),
      });
    }
    out.push({
      id: "sample",
      group: "Actions",
      label: sample ? "Use live data" : "Use sample data",
      words: "demo fake preview",
      run: () => pg.setSample(!sample),
    });
    const tryouts = widget.tryouts;
    if (tryouts) {
      const blocked = tryouts.blocked(config);
      for (const option of tryouts.options) {
        out.push({
          id: `try-${option.kind}`,
          group: "Actions",
          label: `${tryouts.label}: ${option.label}`,
          detail: blocked ? `${blocked.message}. Turn it on first` : "Plays on sample data",
          words: "preview reaction animation game result win loss lose promote demote derank celebrate",
          run: () => (blocked ? pg.focusControl(blocked.focus) : pg.tryout(option.kind)),
        });
      }
    }
    out.push({
      id: "view",
      group: "Actions",
      label: view === "phone" ? "Show the full preview" : "Show phone view",
      detail: view === "phone" ? undefined : "How it reads on a small screen",
      words: "mobile legibility small fit",
      run: () => pg.setView(view === "phone" ? "fit" : "phone"),
    });
    for (const b of ["dark", "bright", "busy", "clear"] as const) {
      if (b === backdrop) continue;
      out.push({
        id: `backdrop-${b}`,
        group: "Actions",
        label: `Backdrop: ${b[0].toUpperCase()}${b.slice(1)}`,
        words: "scene background test",
        run: () => pg.setBackdrop(b),
      });
    }
    out.push({
      id: "reset",
      group: "Actions",
      label: "Reset look and layout",
      detail: "Keeps your account. You can undo it.",
      words: "defaults start over",
      run: () => pg.reset(),
    });

    for (const section of widget.schema.sections) {
      for (const control of section.controls) {
        if (control.showWhen && !control.showWhen(config)) continue;
        const words = (control.keywords ?? []).join(" ");

        if (control.kind === "flags") {
          for (const option of control.options) {
            out.push({
              id: `${control.key}:${option.value}`,
              group: "Settings",
              label: option.label,
              detail: `${section.label} · ${control.label}`,
              words,
              run: () => pg.focusControl(control.key, option.value),
            });
          }
        } else {
          out.push({
            id: control.key,
            group: "Settings",
            label: control.label,
            detail: section.label,
            words,
            run: () => pg.focusControl(control.key),
          });
        }
      }
    }
    return out;
    // pg's methods are stable enough; the values below are what change the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widget, config, url, sample, view, backdrop, format, needs]);

  usePaletteItems(items);
}
