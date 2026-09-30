import { looksLikeKey } from "@/lib/henrik-client";
import { guessRegion, parseRiotId } from "@/lib/riot";
import type { Config, WidgetSchema } from "@/lib/schema";
import * as valorantRank from "./valorant-rank/definition";

export type WidgetMeta = {
  id: string;
  name: string;
  /** One sentence, shown under the page title. */
  tagline: string;
  schema: WidgetSchema;
  defaults: Config;
  /** Adjust the defaults the first time someone opens the editor (e.g. guess a region). */
  firstRun?: (defaults: Config, env: { timeZone?: string }) => Config;
  /** What's still missing for a working OBS link, and which control to send the user to; null when complete. */
  needs: (config: Config) => { message: string; focus: string } | null;
};

// Adding a widget: write its definition (schema + defaults), its renderer and
// runtime, then register the metadata here and the runtime in WidgetRuntime.tsx.
export const widgets: Record<string, WidgetMeta> = {
  [valorantRank.WIDGET_ID]: {
    id: valorantRank.WIDGET_ID,
    name: valorantRank.WIDGET_NAME,
    tagline: "Live rank, RR and session stats.",
    schema: valorantRank.schema,
    defaults: valorantRank.defaults,
    firstRun: (defaults, env) => ({ ...defaults, region: guessRegion(env.timeZone) }),
    needs: (config) => {
      if (parseRiotId(String(config.riotId ?? "")) === null) return { message: "Add your Riot ID", focus: "riotId" };
      if (!looksLikeKey(String(config.apiKey ?? ""))) return { message: "Add your HenrikDev key", focus: "apiKey" };
      return null;
    },
  },
};

export const defaultWidgetId = valorantRank.WIDGET_ID;

export function getWidget(id: string): WidgetMeta | undefined {
  return widgets[id];
}
