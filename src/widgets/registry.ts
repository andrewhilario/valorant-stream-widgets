import { looksLikeKey } from "@/lib/henrik-client";
import { guessRegion, parseRiotId } from "@/lib/riot";
import type { Config, WidgetSchema } from "@/lib/schema";
import * as valorantMastery from "./valorant-mastery/definition";
import { MASTERY_REACTION_KINDS, MASTERY_REACTION_LABELS } from "./valorant-mastery/reactions";
import * as valorantRank from "./valorant-rank/definition";
import { REACTION_KINDS, REACTION_LABELS } from "./valorant-rank/reactions";

/** Buttons under the preview that make the widget play something once, without waiting for it to happen for real. */
export type Tryouts = {
  /** The group's name, e.g. "Try a game". */
  label: string;
  options: Array<{ kind: string; label: string }>;
  /** What stops them working right now, and which control fixes it; null when they work. */
  blocked: (config: Config) => { message: string; focus: string } | null;
};

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
  tryouts?: Tryouts;
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
    tryouts: {
      label: "Try a game",
      options: REACTION_KINDS.map((kind) => ({ kind, label: REACTION_LABELS[kind] })),
      blocked: (config) => {
        if (config.animate === false) return { message: "Animate changes is off", focus: "animate" };
        if (config.reactions === false) return { message: "React to games is off", focus: "reactions" };
        return null;
      },
    },
  },
  [valorantMastery.WIDGET_ID]: {
    id: valorantMastery.WIDGET_ID,
    name: valorantMastery.WIDGET_NAME,
    tagline: "Track Act Level, Mastery Points and match progress.",
    schema: valorantMastery.schema,
    defaults: valorantMastery.defaults,
    firstRun: (defaults, env) => ({ ...defaults, region: guessRegion(env.timeZone) }),
    needs: (config) => {
      if (!config.agentName && !config.agentId) return { message: "Choose an agent", focus: "agentName" };
      return null;
    },
    tryouts: {
      label: "Try a match",
      options: MASTERY_REACTION_KINDS.map((kind) => ({ kind, label: MASTERY_REACTION_LABELS[kind] })),
      blocked: (config) => {
        if (config.animate === false) return { message: "Animate changes is off", focus: "animate" };
        if (config.reactions === false) return { message: "React to matches is off", focus: "reactions" };
        return null;
      },
    },
  },
};

export const defaultWidgetId = valorantRank.WIDGET_ID;

export function getWidget(id: string): WidgetMeta | undefined {
  return widgets[id];
}

