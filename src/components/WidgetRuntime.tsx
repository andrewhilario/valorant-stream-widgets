"use client";

import type { ComponentType } from "react";
import { WIDGET_ID } from "@/widgets/valorant-rank/definition";
import { RankRuntime } from "@/widgets/valorant-rank/Runtime";

const runtimes: Record<string, ComponentType> = {
  [WIDGET_ID]: RankRuntime,
};

/** The page OBS loads for /w/<widget>. */
export function WidgetRuntime({ widgetId }: { widgetId: string }) {
  const Runtime = runtimes[widgetId];
  return Runtime ? <Runtime /> : null;
}
