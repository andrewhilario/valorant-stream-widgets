"use client";

import type { ReactNode } from "react";
import { getWidget } from "@/widgets/registry";
import { SiteHeader } from "../site/SiteHeader";
import { StickyBar, UndoBar } from "./Bars";
import { CopyButton } from "./CopyButton";
import { Inspector } from "./Inspector";
import { OutputBar } from "./OutputBar";
import { Stage, StageToolbar, Title } from "./Stage";
import { PlaygroundContext, usePlaygroundState, type Playground as PlaygroundState } from "./usePlayground";
import { usePlaygroundPalette } from "./usePlaygroundPalette";
import type { WidgetMeta } from "@/widgets/registry";

/** Registers the editor's settings with the ⌘K palette. Renders nothing. */
function PaletteBridge({ state }: { state: PlaygroundState }) {
  usePlaygroundPalette(state);
  return null;
}

function Editor({ widget, below, footer }: { widget: WidgetMeta; below: ReactNode; footer: ReactNode }) {
  const state = usePlaygroundState(widget);

  return (
    <PlaygroundContext.Provider value={state}>
      <PaletteBridge state={state} />
      <SiteHeader actions={<CopyButton className="nav__cta" />} />
      <main id="main">
        <div className="workbench" id="workbench">
          <section className="stagecol" aria-labelledby="page-title">
            <Title />
            <StageToolbar />
            <Stage />
            <OutputBar />
          </section>
          <Inspector />
        </div>
        {below}
      </main>
      {footer}
      <StickyBar />
      <UndoBar />
    </PlaygroundContext.Provider>
  );
}

/**
 * The whole editor. `below` and `footer` are server-rendered sections passed in
 * from the page; they render inside this provider, so the ones that need the
 * live settings (e.g. the OBS fields table) can read them.
 */
export function Playground({ widgetId, below, footer }: { widgetId: string; below: ReactNode; footer: ReactNode }) {
  const widget = getWidget(widgetId);
  if (!widget) throw new Error(`Unknown widget: ${widgetId}`);
  return <Editor widget={widget} below={below} footer={footer} />;
}
