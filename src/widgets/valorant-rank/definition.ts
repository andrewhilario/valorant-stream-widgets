import { looksLikeKey } from "@/lib/henrik-client";
import { defaultsOf, hasFlag, type Config, type Section, type WidgetSchema } from "@/lib/schema";
import { parseRiotId, type Platform, type Region } from "@/lib/riot";
import type { SessionMode } from "@/lib/session";
import {
  ACCENT_SWATCHES,
  PRESETS,
  noteFor,
  swatchFor,
  type Corners,
  type FontSet,
  type PresetId,
  type ProgressColor,
  type Signals,
} from "./themes";

export const WIDGET_ID = "valorant-rank";
export const WIDGET_NAME = "Valorant rank overlay";

export type Layout = "card" | "strip" | "badge" | "stack";

export type RankConfig = {
  riotId: string;
  region: Region;
  apiKey: string;
  platform: Platform;
  layout: Layout;
  show: string;
  scale: number;
  preset: PresetId;
  accent: string;
  opacity: number;
  corners: Corners;
  font: FontSet;
  progress: ProgressColor;
  signals: Signals;
  marks: boolean;
  animate: boolean;
  reactions: boolean;
  sessionMode: SessionMode;
  gap: number;
  windowHours: number;
  refresh: number;
};

const LAYOUT_LABELS: Record<Layout, string> = { card: "Card", strip: "Strip", badge: "Badge", stack: "Stack" };
export const layoutLabel = (layout: string) => LAYOUT_LABELS[layout as Layout] ?? "Card";

/** Which layouts draw each module. The inspector greys out the rest, with a reason. */
const FLAG_LAYOUTS: Record<string, Layout[]> = {
  peak: ["card", "stack"],
  progress: ["card", "strip", "badge", "stack"],
  last: ["card", "strip", "badge", "stack"],
  net: ["card", "strip", "stack"],
  gl: ["card", "stack"],
  rec: ["card", "strip", "stack"],
  wr: ["card", "strip", "stack"],
};

const appliesTo = (flag: string) => (config: Config) => FLAG_LAYOUTS[flag].includes(config.layout as Layout);

/** True when the module is switched on and the current layout draws it. */
export function flagVisible(config: RankConfig, flag: string): boolean {
  return hasFlag(config.show, flag) && FLAG_LAYOUTS[flag].includes(config.layout);
}

const presetBundle = (id: string): Config => {
  const preset = PRESETS[id as PresetId];
  if (!preset) return {};
  return { ...preset.bundle, accent: "" };
};

const SHOW_ALL = "peak,progress,last,net,gl,rec,wr";

export const sections: Section[] = [
  {
    id: "account",
    label: "Account",
    controls: [
      {
        kind: "text",
        key: "riotId",
        param: "id",
        label: "Riot ID",
        placeholder: "Name#TAG",
        help: "Your in-game name and tag. No password needed.",
        keywords: ["account", "name", "tag", "username", "player"],
        maxLength: 24,
        default: "",
        liveFor: "account",
        validate: (value) =>
          value.trim() === "" || parseRiotId(value)
            ? null
            : "That isn't a Riot ID. Use Name#TAG, where the tag is 3–5 letters or numbers.",
      },
      {
        kind: "choice",
        key: "region",
        param: "r",
        label: "Region",
        help: "Where your account plays. Latin America and Brazil use NA.",
        keywords: ["server", "na", "eu", "ap", "kr", "asia", "europe"],
        options: [
          { value: "na", label: "NA" },
          { value: "eu", label: "EU" },
          { value: "ap", label: "AP" },
          { value: "kr", label: "KR" },
        ],
        default: "na",
      },
      {
        kind: "text",
        key: "apiKey",
        param: "k",
        label: "HenrikDev API key",
        placeholder: "HDEV-…",
        help: "Free, and yours alone: no shared rate limit. Saved in this browser.",
        keywords: ["key", "token", "henrik", "hdev", "api", "secret", "credential"],
        maxLength: 64,
        default: "",
        secret: true,
        liveFor: "key",
        validate: (value) =>
          value.trim() === "" || looksLikeKey(value)
            ? null
            : "That doesn't look like a HenrikDev key. It starts with HDEV- and has no spaces.",
        learnMore: {
          summary: "How to get a free key",
          steps: [
            "Open the HenrikDev dashboard and sign in.",
            "Create a Basic key under API Keys.",
            "Paste it above.",
          ],
          href: "https://api.henrikdev.xyz/dashboard/",
          hrefLabel: "Open the dashboard",
        },
      },
      {
        kind: "choice",
        key: "platform",
        param: "p",
        label: "Platform",
        keywords: ["pc", "console", "xbox", "playstation"],
        advanced: true,
        options: [
          { value: "pc", label: "PC" },
          { value: "console", label: "Console" },
        ],
        default: "pc",
      },
    ],
  },
  {
    id: "layout",
    label: "Layout",
    controls: [
      {
        kind: "choice",
        key: "layout",
        param: "l",
        label: "Layout",
        help: "Card shows everything. Strip is one line. Badge is rank and RR only. Stack is tall and narrow, for vertical streams.",
        keywords: ["card", "strip", "badge", "stack", "vertical", "tiktok", "portrait", "compact", "shape", "arrangement"],
        options: [
          { value: "card", label: "Card" },
          { value: "strip", label: "Strip" },
          { value: "badge", label: "Badge" },
          { value: "stack", label: "Stack" },
        ],
        default: "card",
      },
      {
        kind: "flags",
        key: "show",
        param: "sh",
        label: "Show",
        keywords: ["modules", "hide", "stats", "visible"],
        options: [
          { value: "peak", label: "Peak rank", appliesTo: appliesTo("peak") },
          { value: "progress", label: "Progress bar", appliesTo: appliesTo("progress") },
          { value: "last", label: "Last game", appliesTo: appliesTo("last") },
          { value: "net", label: "Net RR", appliesTo: appliesTo("net") },
          { value: "gl", label: "Gained / lost", appliesTo: appliesTo("gl") },
          { value: "rec", label: "Record", appliesTo: appliesTo("rec") },
          { value: "wr", label: "Win rate", appliesTo: appliesTo("wr") },
        ],
        default: SHOW_ALL,
      },
      {
        kind: "range",
        key: "scale",
        param: "s",
        label: "Size",
        help: "Scales the whole widget, so it stays sharp in OBS. The size boxes under the preview update.",
        keywords: ["scale", "bigger", "smaller", "zoom", "resize"],
        min: 60,
        max: 200,
        step: 5,
        unit: "%",
        default: 100,
      },
    ],
  },
  {
    id: "look",
    label: "Look",
    controls: [
      {
        kind: "choice",
        key: "preset",
        param: "t",
        label: "Theme",
        help: "Point at one to try it on the preview, then pick it. Everything below still changes.",
        keywords: ["preset", "tactical", "clean", "paper", "light", "dark", "style", "gallery"],
        options: (Object.keys(PRESETS) as PresetId[]).map((id) => ({
          value: id,
          label: PRESETS[id].label,
          note: noteFor(id),
          swatch: swatchFor(id),
        })),
        display: "gallery",
        default: "tactical",
        onSelect: presetBundle,
      },
      {
        kind: "color",
        key: "accent",
        param: "a",
        label: "Accent colour",
        keywords: ["color", "brand", "hex", "red", "blue", "green", "custom"],
        swatches: ACCENT_SWATCHES,
        emptyLabel: "Theme",
        default: "",
      },
      {
        kind: "range",
        key: "opacity",
        param: "o",
        label: "Panel opacity",
        help: "Below 60% the text can get hard to read over bright scenes.",
        keywords: ["transparent", "transparency", "see-through", "background"],
        min: 0,
        max: 100,
        step: 5,
        unit: "%",
        default: 90,
      },
      {
        kind: "choice",
        key: "corners",
        param: "c",
        label: "Corners",
        keywords: ["sharp", "chamfer", "round", "radius", "shape"],
        options: [
          { value: "sharp", label: "Sharp" },
          { value: "chamfer", label: "Chamfer" },
          { value: "round", label: "Round" },
        ],
        default: "chamfer",
      },
      {
        kind: "choice",
        key: "font",
        param: "f",
        label: "Type",
        keywords: ["font", "typeface", "teko", "mono", "grotesk"],
        options: [
          { value: "tactical", label: "Tactical" },
          { value: "grotesk", label: "Grotesk" },
          { value: "mono", label: "Mono" },
        ],
        default: "tactical",
      },
      {
        kind: "choice",
        key: "progress",
        param: "pr",
        label: "Progress bar",
        help: "Rank colour follows your tier. Accent uses the colour above.",
        keywords: ["bar", "fill", "tier colour"],
        options: [
          { value: "rank", label: "Rank colour" },
          { value: "accent", label: "Accent" },
        ],
        default: "rank",
      },
      {
        kind: "choice",
        key: "signals",
        // Not "sig": log scrubbers and link tools treat that name as a secret and mask it.
        param: "wc",
        label: "Win and loss colours",
        help: "Blue and orange stay distinct with red–green colour blindness. Every change also carries a + or − sign.",
        keywords: ["colour blind", "color blind", "accessibility", "green", "red", "gain", "loss"],
        options: [
          { value: "standard", label: "Green / red" },
          { value: "safe", label: "Blue / orange" },
        ],
        default: "standard",
      },
      {
        kind: "toggle",
        key: "marks",
        param: "mk",
        label: "Corner marks",
        keywords: ["brackets", "decoration", "accent"],
        default: true,
      },
      {
        kind: "toggle",
        key: "animate",
        param: "an",
        label: "Animate changes",
        help: "RR counts up and the bar slides. Off for a fully static overlay.",
        keywords: ["motion", "animation", "static", "transition"],
        default: true,
      },
      {
        kind: "toggle",
        key: "reactions",
        param: "rx",
        label: "React to games",
        help: "A soft glow and pop when a game ends or your rank changes. Try one with the buttons under the preview.",
        keywords: ["win", "loss", "rank up", "promotion", "demotion", "celebrate", "effects", "animation", "glow"],
        showWhen: (c) => c.animate === true,
        default: true,
      },
    ],
  },
  {
    id: "session",
    label: "Session",
    controls: [
      {
        kind: "choice",
        key: "sessionMode",
        param: "sm",
        label: "Session",
        help: "Nothing to reset. The widget works the session out from your match history.",
        keywords: ["stats", "reset", "today", "games", "record", "net rr"],
        options: [
          { value: "auto", label: "Auto" },
          { value: "today", label: "Today" },
          { value: "window", label: "Last hours" },
        ],
        default: "auto",
      },
      {
        kind: "range",
        key: "gap",
        param: "gp",
        label: "New session after a gap of",
        help: "Your latest run of games. A longer break starts a fresh session.",
        keywords: ["break", "idle", "new session"],
        showWhen: (c) => c.sessionMode === "auto",
        min: 1,
        max: 12,
        step: 1,
        unit: "h",
        default: 4,
      },
      {
        kind: "range",
        key: "windowHours",
        param: "sw",
        label: "Count games from the last",
        help: "A rolling window. Older games drop out as time passes.",
        keywords: ["window", "hours", "lookback"],
        showWhen: (c) => c.sessionMode === "window",
        min: 1,
        max: 24,
        step: 1,
        unit: "h",
        default: 6,
      },
      {
        kind: "range",
        key: "refresh",
        param: "rf",
        label: "Refresh every",
        help: "Ranked data only changes when a game ends, so faster than 60 s rarely helps.",
        keywords: ["poll", "update", "interval", "speed"],
        advanced: true,
        min: 30,
        max: 300,
        step: 15,
        unit: "s",
        default: 60,
      },
    ],
  },
];

export const schema: WidgetSchema = { sections };
export const defaults: Config = defaultsOf(schema);

/** Safe only after the config has been through sanitize()/fromParams(). */
export function readConfig(config: Config): RankConfig {
  return config as unknown as RankConfig;
}

export { hasFlag };
