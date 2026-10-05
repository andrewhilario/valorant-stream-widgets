import { describe, expect, it } from "vitest";
import { DATASET, QUERY, formatReport, type Row } from "./stats";

const NOW = new Date("2026-10-04T12:00:00Z");
const row = (ev: string, a: string, b: string, d: string, n: number | string): Row => ({ ev, a, b, d: `${d} 00:00:00`, n });

// The last 28 days run from 2026-09-07 to 2026-10-04.
const rows: Row[] = [
  row("visit", "overlay", "reddit", "2026-10-03", 6),
  row("visit", "overlay", "direct", "2026-10-02", "2"),
  row("visit", "rank", "search", "2026-10-01", 2),
  row("visit", "overlay", "tiktok", "2026-08-01", 40), // too old for the 28-day lines
  row("key_help", "steps", "", "2026-10-03", 4),
  row("key_help", "dashboard", "", "2026-10-03", 2),
  row("setup_ready", "valorant-rank", "", "2026-10-03", 3),
  row("setup_ready", "valorant-mastery", "", "2026-10-02", 1),
  row("link_copied", "valorant-rank", "", "2026-10-03", 3),
  row("overlay_load", "valorant-rank", "live", "2026-10-03", 10),
  row("overlay_load", "valorant-rank", "live", "2026-09-20", 4),
  row("overlay_load", "valorant-rank", "demo", "2026-10-03", 5),
  row("theme_picked", "paper", "", "2026-10-03", 5),
  row("theme_picked", "clean", "", "2026-10-02", 2),
  row("layout_picked", "stack", "", "2026-10-03", 3),
  row("try_game", "win", "", "2026-10-03", 7),
  row("pro_click", "editor", "", "2026-10-03", 2),
  row("pro_click", "footer", "", "2026-09-01", 1),
];

describe("formatReport", () => {
  const report = formatReport(rows, NOW);

  it("counts the last 28 days, and leaves older counts out of them", () => {
    expect(report).toMatch(/Visits\s+10\b/);
    expect(report).toMatch(/that started on the editor\s+8\b.*80% of visits/);
  });

  it("works out the setup funnel from what happened", () => {
    expect(report).toMatch(/Opened the key steps\s+4\b.*50% of editor visits/);
    expect(report).toMatch(/went on to the HenrikDev dashboard\s+2\b/);
    expect(report).toMatch(/Finished a setup\s+4\b.*50% of editor visits/);
    expect(report).toMatch(/Copied their link\s+3\b.*75% of finished setups/);
    expect(report).toContain("Setups finished: rank overlay 3, mastery overlay 1");
  });

  it("separates real overlay opens from sample ones, and says how many a day", () => {
    expect(report).toMatch(/Overlay opens, real\s+14\b.*about 0\.5 a day/);
    expect(report).toMatch(/Overlay opens, sample data\s+5\b/);
  });

  it("lists where visits come from, and what people pick, biggest first", () => {
    expect(report).toContain("Coming from:   reddit 6, direct 2, search 2");
    expect(report).toContain("Landing on:    overlay 8, rank 2");
    expect(report).toContain("Themes:        paper 5, clean 2");
    expect(report).toContain("Layouts:       stack 3");
    expect(report).toContain("Tried:         win 7");
  });

  it("counts the Pro link over all 90 days, against finished setups", () => {
    expect(report).toMatch(/Clicks on the Pro link\s+3\b.*75% of finished setups \(4\)/);
    expect(report).toContain("Where:         editor 2, footer 1");
  });

  it("shows thirteen weeks, oldest first, the last one starting six days before today", () => {
    const header = report.split("\n").find((l) => l.includes("07-06"))!;
    const dates = header.trim().split(/\s+/);
    expect(dates).toHaveLength(13);
    expect(dates[0]).toBe("07-06");
    expect(dates[12]).toBe("09-28");
    const visits = report.split("\n").find((l) => /^\s+Visits\s+(\d+\s+){12}\d+\s*$/.test(l))!;
    const cells = visits.trim().split(/\s+/).slice(1).map(Number);
    expect(cells.at(-1)).toBe(10); // 2026-09-28 to 2026-10-04
    expect(cells.reduce((a, b) => a + b, 0)).toBe(50); // all four visit rows
  });

  it("says what to do when there is nothing yet", () => {
    expect(formatReport([], NOW)).toMatch(/No counts yet/);
  });

  it("copes with ISO dates and counts that arrive as text", () => {
    const text = formatReport([{ ev: "visit", a: "overlay", b: "direct", d: "2026-10-04T00:00:00Z", n: "3" }], NOW);
    expect(text).toMatch(/Visits\s+3\b/);
  });

  it("ignores rows it can't read rather than failing", () => {
    const text = formatReport([{ ev: "visit", a: "overlay", b: "direct", d: "yesterday", n: "x" }, ...rows], NOW);
    expect(text).toMatch(/Visits\s+10\b/);
  });
});

describe("QUERY", () => {
  it("asks the dataset the endpoint writes to, over the three months it is kept", () => {
    expect(QUERY).toContain(`FROM ${DATASET}`);
    expect(QUERY).toContain("INTERVAL '90' DAY");
    expect(QUERY).toContain("SUM(_sample_interval)");
  });
});
