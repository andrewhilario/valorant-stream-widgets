// Agent Mastery overlay widget definition. Parallels valorant-rank/definition.ts:
// one schema drives the inspector, the link format, validation and the palette.

import { looksLikeKey } from "@/lib/henrik-client";
import {
  cumulativeMp,
  MAX_LEVEL,
  PORTRAIT_ACCENT_LEVELS,
  mpForLevel,
  MASTERY_SOURCE,
} from "@/lib/mastery";
import { defaultsOf, type Config, type Section, type WidgetSchema } from "@/lib/schema";
import { parseRiotId, type Platform, type Region } from "@/lib/riot";
import {
  ACCENT_SWATCHES,
  PRESETS,
  noteFor,
  swatchFor,
  type Corners,
  type FontSet,
  type PresetId,
  type Signals,
} from "../valorant-rank/themes";

export const WIDGET_ID = "valorant-mastery";
export const WIDGET_NAME = "Valorant Agent Mastery overlay";

export type MasteryLayout = "card" | "strip" | "badge" | "stack";

export type MasteryConfig = {
  riotId: string;
  region: Region;
  apiKey: string;
  platform: Platform;
  agentId: string;
  agentName: string;
  currentLevel: string | number;
  mpIntoLevel: string | number;
  targetLevel: string | number;
  bonusPct: number;
  layout: MasteryLayout;
  show: string;
  scale: number;
  preset: PresetId;
  accent: string;
  opacity: number;
  corners: Corners;
  font: FontSet;
  signals: Signals;
  marks: boolean;
  animate: boolean;
  reactions: boolean;
  refresh: number;
};

const LAYOUT_LABELS: Record<MasteryLayout, string> = {
  card: "Card",
  strip: "Strip",
  badge: "Badge",
  stack: "Stack",
};
export const layoutLabel = (layout: string) =>
  LAYOUT_LABELS[layout as MasteryLayout] ?? "Card";

/** Which layouts draw each module. */
const FLAG_LAYOUTS: Record<string, MasteryLayout[]> = {
  progress: ["card", "strip", "badge", "stack"],
  remaining: ["card", "strip", "stack"],
  session: ["card", "strip", "stack"],
  milestones: ["card", "stack"],
};

const appliesTo =
  (flag: string) =>
  (config: Config) =>
    FLAG_LAYOUTS[flag].includes(config.layout as MasteryLayout);

export function flagVisible(config: MasteryConfig, flag: string): boolean {
  return (
    typeof config.show === "string" &&
    config.show.split(",").includes(flag) &&
    FLAG_LAYOUTS[flag].includes(config.layout)
  );
}

const presetBundle = (id: string): Config => {
  const preset = PRESETS[id as PresetId];
  if (!preset) return {};
  return { ...preset.bundle, accent: "" };
};

const SHOW_ALL = "progress,remaining,session,milestones";

export const VALORANT_AGENTS = [
  "Astra",
  "Breach",
  "Brimstone",
  "Chamber",
  "Clove",
  "Cypher",
  "Deadlock",
  "Fade",
  "Gekko",
  "Harbor",
  "Iso",
  "Jett",
  "KAY/O",
  "Killjoy",
  "Miks",
  "Neon",
  "Omen",
  "Phoenix",
  "Raze",
  "Reyna",
  "Sage",
  "Skye",
  "Sova",
  "Tejo",
  "Veto",
  "Viper",
  "Vyse",
  "Waylay",
  "Yoru",
];

const agentOptions = () => VALORANT_AGENTS.map((name) => ({ value: name, label: name }));

const levelOptions = () => {
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 0; i <= MAX_LEVEL; i++) {
    const isAccent = PORTRAIT_ACCENT_LEVELS.includes(i as 4 | 7 | 10);
    const suffix = isAccent ? " ★ (Portrait Accent)" : "";
    out.push({ value: String(i), label: `Level ${i}${suffix}` });
  }
  return out;
};

const targetOptions = () => {
  const out: Array<{ value: string; label: string }> = [];
  for (let i = 1; i <= MAX_LEVEL; i++) {
    const isAccent = PORTRAIT_ACCENT_LEVELS.includes(i as 4 | 7 | 10);
    const suffix = i === 10 ? " ★ (Max Track & Accent)" : isAccent ? " ★ (Portrait Accent)" : "";
    out.push({ value: String(i), label: `Level ${i}${suffix}` });
  }
  return out;
};

/**
 * What to know before trusting the numbers, shown in the editor under the title. It says what the overlay does, as the code does it:
 * keep it in step with session.ts and useMasteryData.ts, and with the Mastery FAQ and the ad.
 */
export const NOTES = {
  summary: "Estimates, close enough to track your levels.",
  heading: "How this counts",
  points: [
    "Type your Act Level and the MP the game shows right before you play, then open the overlay. It adds every match that finishes after that, on the agent you picked.",
    "A match is added once it has finished and HenrikDev lists it, usually a minute or two later. Nothing changes during a match.",
    `The MP are estimated from Riot's published rate (patch ${MASTERY_SOURCE.patch}): 80 a minute, 1.3 times that for a win, plus the bonus % you set under Advanced. Riot hasn't published how Performance Score counts, so your in-game total may differ a little.`,
    "Riot counts the seconds you actually played. The overlay uses the whole match length, so if you leave early or disconnect, the numbers will differ.",
    "It can't tell which game mode a match was, so it also counts modes that don't earn Mastery Points (like Deathmatch) if you play them on that agent.",
    "It can't read your real Mastery from the game. If it drifts, type your numbers in again: that starts a new count.",
    "It needs your Riot ID and HenrikDev key to see your matches. Without them it only shows the numbers you typed.",
    "It remembers what it has counted in the browser that runs it, so a reload keeps your total. Clearing that browser source's cache starts the count again from your typed numbers.",
  ],
};

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
        help: "Your in-game name and tag. Needed to detect finished matches.",
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
    id: "agent",
    label: "Agent",
    controls: [
      {
        kind: "text",
        key: "agentId",
        param: "ag",
        label: "Agent ID",
        help: "The UUID of the agent you are tracking. Set by the agent picker.",
        keywords: ["agent", "character", "uuid"],
        maxLength: 64,
        default: "",
        advanced: true,
      },
      {
        kind: "choice",
        key: "agentName",
        param: "an",
        label: "Agent",
        display: "select",
        help: "The agent you are playing and tracking on stream.",
        keywords: ["agent", "character", "jett", "clove", "reyna", "omen", "sage"],
        options: agentOptions(),
        default: "Clove",
      },
      {
        kind: "choice",
        key: "currentLevel",
        param: "cl",
        label: "Current Act Level",
        display: "select",
        help: "Your current Act Level for this agent. Check your in-game Agent Mastery screen. ★ marks levels that unlock a Portrait Accent.",
        keywords: ["level", "act", "start", "progress"],
        options: levelOptions(),
        default: "0",
      },
      {
        kind: "text",
        key: "mpIntoLevel",
        param: "mp",
        label: "MP into this level",
        placeholder: "0",
        help: "How many Mastery Points you've earned toward the next level (e.g. 4200). Check the in-game progress bar.",
        keywords: ["mastery", "points", "progress", "current", "mp"],
        maxLength: 7,
        default: "0",
        validate: (value) =>
          !value.trim() || /^\d+$/.test(value.trim())
            ? null
            : "Enter a valid positive number for MP (e.g. 4200).",
      },
      {
        kind: "choice",
        key: "targetLevel",
        param: "tl",
        label: "Target Act Level",
        display: "select",
        help: "The Act Level you want to reach. ★ marks Portrait Accent levels (4, 7, 10).",
        keywords: ["target", "goal", "level", "portrait", "accent"],
        options: targetOptions(),
        default: "10",
      },
      {
        kind: "range",
        key: "bonusPct",
        param: "bp",
        label: "Performance bonus",
        help: "Estimated extra MP from Performance Score. Riot hasn't published the formula, so this is your best guess.",
        keywords: ["performance", "bonus", "score", "combat", "extra"],
        advanced: true,
        min: 0,
        max: 50,
        step: 5,
        unit: "%",
        default: 0,
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
        help: "Card shows everything. Strip is one line. Badge is agent and level only. Stack is tall and narrow, for vertical streams.",
        keywords: [
          "card",
          "strip",
          "badge",
          "stack",
          "vertical",
          "tiktok",
          "portrait",
          "compact",
          "shape",
        ],
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
          { value: "progress", label: "Progress bar", appliesTo: appliesTo("progress") },
          { value: "remaining", label: "Remaining", appliesTo: appliesTo("remaining") },
          { value: "session", label: "Session stats", appliesTo: appliesTo("session") },
          { value: "milestones", label: "Milestones", appliesTo: appliesTo("milestones") },
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
        key: "signals",
        param: "wc",
        label: "Win and loss colours",
        help: "Blue and orange stay distinct with red–green colour blindness.",
        keywords: ["colour blind", "color blind", "accessibility"],
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
        param: "am",
        label: "Animate changes",
        help: "MP counts up and the bar slides. Off for a fully static overlay.",
        keywords: ["motion", "animation", "static", "transition"],
        default: true,
      },
      {
        kind: "toggle",
        key: "reactions",
        param: "rx",
        label: "React to matches",
        help: "A pop and glow when MP is gained or your level goes up. Try one with the buttons under the preview.",
        keywords: [
          "mp",
          "gain",
          "level up",
          "celebration",
          "effects",
          "animation",
          "glow",
        ],
        showWhen: (c) => c.animate === true,
        default: true,
      },
    ],
  },
  {
    id: "data",
    label: "Data",
    controls: [
      {
        kind: "range",
        key: "refresh",
        param: "rf",
        label: "Refresh every",
        help: "Polls for new matches. Match data usually appears 30–90 s after the game ends.",
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
export function readConfig(config: Config): MasteryConfig {
  return config as unknown as MasteryConfig;
}
