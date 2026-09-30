"use client";

import { useEffect, useState } from "react";
import { usePlayground, type Playground } from "./usePlayground";

export type StatusTone = "live" | "idle" | "busy" | "error" | "sample";

export function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 10) return "just now";
  if (s < 60) return `${s} s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

export function describeStatus(pg: Playground, now: number): { tone: StatusTone; label: string; detail?: string } {
  const { status } = pg.preview;

  // The button beside this line says what to do next, so the line itself only says what you're looking at.
  if (pg.sample) return { tone: "sample", label: "Sample data" };

  switch (status.state) {
    case "idle":
      return {
        tone: "idle",
        label: "Not connected",
        detail: pg.needs ? `${pg.needs.message} to look up your rank.` : undefined,
      };
    case "loading":
      return { tone: "busy", label: "Looking up your account…" };
    case "live": {
      const notes = [`Updated ${ago(now - status.updatedAt)}`];
      if (status.partial) notes.push("session stats unavailable");
      return { tone: "live", label: "Live", detail: notes.join(" · ") };
    }
    case "sample":
      return { tone: "sample", label: "Sample data" };
    case "error":
      return { tone: "error", label: status.message };
  }
}

/** The data-source readout: a tally dot and one line. Always words, never colour alone. */
export function Status() {
  const pg = usePlayground();
  const now = useNow(5000);
  const { tone, label, detail } = describeStatus(pg, now);

  return (
    <div className="status" data-tone={tone}>
      <span className="status__dot" aria-hidden="true" />
      <p className="status__text">
        <span className="status__label">{label}</span>
        {detail && <span className="status__detail"> · {detail}</span>}
      </p>
      {/* Announces state changes only, not the ticking "updated" time. */}
      <span className="sr-only" role="status" aria-live="polite">
        {label}
      </span>
    </div>
  );
}
