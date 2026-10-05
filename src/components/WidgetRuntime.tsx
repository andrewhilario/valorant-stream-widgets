"use client";

import { useEffect, type ComponentType } from "react";
import { trackOnce } from "@/lib/analytics";
import { WIDGET_ID as MASTERY_WIDGET_ID } from "@/widgets/valorant-mastery/definition";
import { MasteryRuntime } from "@/widgets/valorant-mastery/Runtime";
import { WIDGET_ID } from "@/widgets/valorant-rank/definition";
import { RankRuntime } from "@/widgets/valorant-rank/Runtime";

const runtimes: Record<string, ComponentType> = {
  [WIDGET_ID]: RankRuntime,
  [MASTERY_WIDGET_ID]: MasteryRuntime,
};

/** The page OBS loads for /w/<widget>. */
export function WidgetRuntime({ widgetId }: { widgetId: string }) {
  // One anonymous count when an overlay opens as a page of its own: in OBS, TikTok LIVE Studio or a browser tab, not as the
  // editor's preview or somebody's embed. It carries the widget's name and whether it is on sample data, and nothing from the
  // link: not the Riot ID, the region, the key or anything after the "#". It is the only thing the OBS page sends to this site.
  useEffect(() => {
    if (window.self !== window.top) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("preview") === "1") return;
    trackOnce("overlay_load", widgetId, params.has("demo") ? "demo" : "live");
  }, [widgetId]);

  const Runtime = runtimes[widgetId];
  return Runtime ? <Runtime /> : null;
}
