// Everything this site is allowed to count, and nothing else.
//
// An event is a name plus up to two short labels, each picked from a fixed list below. There is no free text and no
// number anyone typed, so a count cannot carry a Riot ID, a region, a key, or any part of an address. The same lists
// guard both ends: the browser refuses to send anything outside them (analytics.ts) and the endpoint refuses to store
// anything outside them (event-endpoint.ts). events.test.ts checks them against the real pages, widgets, themes, layouts
// and try-a-game buttons, so a new one can't be added without being added here.

/** The pages in config/pages.ts, plus anything else a visit might start on. */
export const PAGES = ["overlay", "rank", "mastery", "other"] as const;
/** Where a visit came from, in coarse groups. The address itself is never kept. */
export const REFERRERS = ["direct", "reddit", "tiktok", "search", "other"] as const;
/** The ids in widgets/registry.ts. */
export const WIDGETS = ["valorant-rank", "valorant-mastery"] as const;
/** The theme ids in widgets/valorant-rank/themes.ts. */
export const THEMES = ["tactical", "clean", "paper"] as const;
/** The layout ids both widgets offer. */
export const LAYOUTS = ["card", "strip", "badge", "stack"] as const;
/** The "Try a game" and "Try a match" buttons. */
export const TRYOUTS = ["win", "loss", "up", "down", "mp_gain", "level_up", "target_reached"] as const;

type Spec = { first: readonly string[]; second?: readonly string[] };

export const EVENTS = {
  /** A new visit to the site, once per browser tab session: the page it started on, and where it came from. */
  visit: { first: PAGES, second: REFERRERS },
  /** An overlay page opened as a page of its own (OBS, TikTok LIVE Studio, a browser tab): which widget, and whether it ran on sample data. */
  overlay_load: { first: WIDGETS, second: ["live", "demo"] },
  /** An unfinished setup became a working one while the editor was open: the Riot ID and key were added, or an agent was chosen. */
  setup_ready: { first: WIDGETS },
  /** The "How to get a free key" steps were opened, or their link to the dashboard was followed. */
  key_help: { first: ["steps", "dashboard"] },
  /** The OBS link was copied. */
  link_copied: { first: WIDGETS },
  theme_picked: { first: THEMES },
  layout_picked: { first: LAYOUTS },
  try_game: { first: TRYOUTS },
  /** The "Pro (coming soon)" link, and where it was. */
  pro_click: { first: ["footer", "editor"] },
} as const satisfies Record<string, Spec>;

export type EventName = keyof typeof EVENTS;

export const EVENT_NAMES = Object.keys(EVENTS) as EventName[];

const isEventName = (event: string): event is EventName => Object.prototype.hasOwnProperty.call(EVENTS, event);

/** Whether `first` and `second` are exactly the labels this event allows. `second` is "" for events that have only one. */
export function labelsValid(event: string, first: string, second: string): boolean {
  if (!isEventName(event)) return false;
  const spec: Spec = EVENTS[event];
  if (!spec.first.includes(first)) return false;
  return spec.second ? spec.second.includes(second) : second === "";
}

/** One counted event, as the endpoint understands it. */
export type Counted = { event: EventName; first: string; second: string };

/** What goes over the wire, for example {"e":"visit","a":"overlay","b":"reddit"}. `b` is left out when there is no second label. */
export function encodeEvent(event: EventName, first: string, second = ""): string {
  return JSON.stringify(second ? { e: event, a: first, b: second } : { e: event, a: first });
}

/** Reads a request body. Anything that isn't exactly one allowed event, with exactly its allowed labels, is null. */
export function parseEvent(text: string): Counted | null {
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) return null;
  if (Object.keys(body).some((key) => key !== "e" && key !== "a" && key !== "b")) return null;

  const { e, a, b } = body as Record<string, unknown>;
  if (typeof e !== "string" || typeof a !== "string") return null;
  if (b !== undefined && typeof b !== "string") return null;

  const second = b ?? "";
  return labelsValid(e, a, second) ? { event: e as EventName, first: a, second } : null;
}

/** What is written to Workers Analytics Engine: the event as the index and first label, then its labels, counted as one. */
export type DataPoint = { indexes: string[]; blobs: string[]; doubles: number[] };

export function toDataPoint({ event, first, second }: Counted): DataPoint {
  return { indexes: [event], blobs: [event, first, second], doubles: [1] };
}
