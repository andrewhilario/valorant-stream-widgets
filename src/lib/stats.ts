// Turns the anonymous counts (see events.ts) into a plain-text report. It is pure, so it is tested; scripts/stats.mjs fetches the
// rows from Cloudflare and prints what this makes. It has no imports because Node runs this file directly.

/** The Workers Analytics Engine dataset, as named in wrangler.jsonc. */
export const DATASET = "tally_events";

/** One day's count for one event and its labels. Cloudflare returns the counts as numbers or as text. */
export type Row = { ev: string; a: string; b: string; d: string; n: number | string };

/** The question asked of Analytics Engine: counts per day, per event and label, over the three months it keeps. */
export const QUERY = `SELECT
  blob1 AS ev,
  blob2 AS a,
  blob3 AS b,
  toStartOfInterval(timestamp, INTERVAL '1' DAY) AS d,
  SUM(_sample_interval) AS n
FROM ${DATASET}
WHERE timestamp > NOW() - INTERVAL '90' DAY
GROUP BY ev, a, b, d
ORDER BY d`;

const DAY = 86_400_000;
const WEEKS = 13;

/** The widgets' ids, as short names. */
const WIDGET_NAMES: Record<string, string> = { "valorant-rank": "rank overlay", "valorant-mastery": "mastery overlay" };

const midnight = (when: Date) => Date.UTC(when.getUTCFullYear(), when.getUTCMonth(), when.getUTCDate());
const isoDay = (ms: number) => new Date(ms).toISOString().slice(0, 10);

const percent = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "-");
const whole = (value: number) => String(Math.round(value));

type Counter = {
  /** The total for an event, in the last `days` days, optionally for one first or second label. */
  total(event: string, days: number, first?: string, second?: string): number;
  /** The totals per first or second label, biggest first. */
  split(event: string, days: number, by: "a" | "b"): Array<[string, number]>;
  /** A week's total for an event; week 0 is the latest seven days, week 1 the seven before. */
  week(event: string, week: number, first?: string, second?: string): number;
};

function counter(rows: Row[], today: number): Counter {
  const items = rows
    .map((row) => ({ ev: row.ev, a: row.a, b: row.b, n: Number(row.n), age: Math.floor((today - Date.parse(`${String(row.d).slice(0, 10)}T00:00:00Z`)) / DAY) }))
    .filter((item) => Number.isFinite(item.n) && Number.isFinite(item.age) && item.age >= 0);

  const match = (event: string, first?: string, second?: string) => (item: (typeof items)[number]) =>
    item.ev === event && (first === undefined || item.a === first) && (second === undefined || item.b === second);

  return {
    total: (event, days, first, second) =>
      items.filter((item) => item.age < days && match(event, first, second)(item)).reduce((sum, item) => sum + item.n, 0),
    split: (event, days, by) => {
      const sums = new Map<string, number>();
      for (const item of items) if (item.age < days && item.ev === event) sums.set(item[by], (sums.get(item[by]) ?? 0) + item.n);
      return [...sums].filter(([label]) => label !== "").sort((x, y) => y[1] - x[1]);
    },
    week: (event, week, first, second) =>
      items.filter((item) => item.age >= week * 7 && item.age < week * 7 + 7 && match(event, first, second)(item)).reduce((sum, item) => sum + item.n, 0),
  };
}

function line(label: string, value: string, note = ""): string {
  return `  ${label.padEnd(36)}${value.padStart(6)}${note ? `   ${note}` : ""}`;
}

function listOf(pairs: Array<[string, number]>): string {
  return pairs.length ? pairs.map(([label, n]) => `${WIDGET_NAMES[label] ?? label} ${whole(n)}`).join(", ") : "none yet";
}

export function formatReport(rows: Row[], now: Date = new Date()): string {
  const today = midnight(now);
  const count = counter(rows, today);
  const days = rows.map((row) => Date.parse(`${String(row.d).slice(0, 10)}T00:00:00Z`)).filter(Number.isFinite);
  if (days.length === 0) {
    return "No counts yet.\nCheck that the site has been deployed with the counter, then visit it once and run this again.\n";
  }

  const out: string[] = [];
  out.push(`Tally usage: anonymous counts from ${isoDay(Math.min(...days))} to ${isoDay(today)} (UTC)`);
  out.push("Cloudflare keeps three months of them. A visit is one browser tab session; an overlay open is one load of an overlay page.");

  const D = 28;
  const visits = count.total("visit", D);
  const editorVisits = count.total("visit", D, "overlay");
  const setups = count.total("setup_ready", D);
  const copies = count.total("link_copied", D);
  const liveOpens = count.total("overlay_load", D, undefined, "live");
  const demoOpens = count.total("overlay_load", D, undefined, "demo");
  const keySteps = count.total("key_help", D, "steps");
  const keyDashboard = count.total("key_help", D, "dashboard");

  out.push("", "THE LAST 28 DAYS");
  out.push(line("Visits", whole(visits)));
  out.push(line("  that started on the editor", whole(editorVisits), percent(editorVisits, visits) + " of visits"));
  out.push(line("Opened the key steps", whole(keySteps), percent(keySteps, editorVisits) + " of editor visits"));
  out.push(line("  went on to the HenrikDev dashboard", whole(keyDashboard)));
  out.push(line("Finished a setup", whole(setups), percent(setups, editorVisits) + " of editor visits"));
  out.push(line("Copied their link", whole(copies), percent(copies, setups) + " of finished setups"));
  out.push(line("Overlay opens, real", whole(liveOpens), `about ${(liveOpens / D).toFixed(1)} a day`));
  out.push(line("Overlay opens, sample data", whole(demoOpens)));
  out.push(`  Setups finished: ${listOf(count.split("setup_ready", D, "a"))}`);

  out.push("", `WEEK BY WEEK (the latest ${WEEKS} weeks, oldest first; each column starts on the date shown)`);
  const starts = Array.from({ length: WEEKS }, (_, i) => isoDay(today - (WEEKS - 1 - i) * 7 * DAY - 6 * DAY).slice(5));
  const series: Array<[string, (week: number) => number]> = [
    ["Visits", (w) => count.week("visit", w)],
    ["Finished setups", (w) => count.week("setup_ready", w)],
    ["Links copied", (w) => count.week("link_copied", w)],
    ["Overlay opens, real", (w) => count.week("overlay_load", w, undefined, "live")],
    ["Pro link clicks", (w) => count.week("pro_click", w)],
  ];
  out.push(`  ${"".padEnd(20)}${starts.map((s) => s.padStart(6)).join("")}`);
  for (const [label, valueOf] of series) {
    const cells = Array.from({ length: WEEKS }, (_, i) => whole(valueOf(WEEKS - 1 - i)).padStart(6));
    out.push(`  ${label.padEnd(20)}${cells.join("")}`);
  }

  out.push("", "WHERE VISITS COME FROM (last 28 days)");
  out.push(`  Coming from:   ${listOf(count.split("visit", D, "b"))}`);
  out.push(`  Landing on:    ${listOf(count.split("visit", D, "a"))}`);

  out.push("", "WHAT PEOPLE PICK (last 28 days)");
  out.push(`  Themes:        ${listOf(count.split("theme_picked", D, "a"))}`);
  out.push(`  Layouts:       ${listOf(count.split("layout_picked", D, "a"))}`);
  out.push(`  Tried:         ${listOf(count.split("try_game", D, "a"))}`);

  const proClicks = count.total("pro_click", 90);
  const setups90 = count.total("setup_ready", 90);
  out.push("", "INTEREST IN PRO (all 90 days)");
  out.push(line("Clicks on the Pro link", whole(proClicks), `${percent(proClicks, setups90)} of finished setups (${whole(setups90)})`));
  out.push(`  Where:         ${listOf(count.split("pro_click", 90, "a"))}`);
  out.push("");
  return out.join("\n");
}
