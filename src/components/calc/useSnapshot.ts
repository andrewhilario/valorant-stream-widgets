"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { fetchSnapshot, type Lookup } from "@/lib/henrik-client";
import type { PreviewStatus } from "@/lib/preview";
import type { RankErrorCode } from "@/lib/rank-types";
import type { Snapshot } from "@/lib/snapshot";

export type SnapshotState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; snapshot: Snapshot }
  | { phase: "error"; code: RankErrorCode | "network"; message: string; retryAfter?: number };

// The lookup's own messages talk about "the widget"; these are about a button the person just pressed.
const OWN_MESSAGES: Partial<Record<RankErrorCode | "network", string>> = {
  rate_limited: "Your key has reached its rate limit. Wait a moment and try again.",
  upstream: "The data service didn't answer. Try again in a moment.",
  network: "Couldn't reach the data service. Check your connection and try again.",
};

function describe(code: RankErrorCode | "network", message: string, retryAfter?: number): string {
  const text = OWN_MESSAGES[code] ?? message;
  return code === "rate_limited" && retryAfter ? `${text} It resets in about ${retryAfter} seconds.` : text;
}

/** What the editor's field helpers expect, so the same Riot ID and key fields can show "Found …" and "Key accepted". */
export function toPreviewStatus(state: SnapshotState): PreviewStatus {
  switch (state.phase) {
    case "idle":
      return { state: "idle" };
    case "loading":
      return { state: "loading" };
    case "ready":
      return { state: "live", updatedAt: state.snapshot.fetchedAt, partial: false };
    case "error":
      return { state: "error", code: state.code, message: state.message, retryAfter: state.retryAfter };
  }
}

/** One lookup at a time: a new one cancels the last, and leaving the page cancels whatever is running. */
export function useSnapshot() {
  const [state, setState] = useState<SnapshotState>({ phase: "idle" });
  const running = useRef<AbortController | null>(null);

  useEffect(() => () => running.current?.abort(), []);

  const reset = useCallback(() => {
    running.current?.abort();
    running.current = null;
    setState({ phase: "idle" });
  }, []);

  /** Resolves with the snapshot, or null when it failed or was replaced. The reason is in `state`. */
  const load = useCallback(async (lookup: Lookup): Promise<Snapshot | null> => {
    running.current?.abort();
    const controller = new AbortController();
    running.current = controller;
    setState({ phase: "loading" });

    try {
      const result = await fetchSnapshot(lookup, controller.signal);
      if (controller.signal.aborted) return null;
      if (!result.ok) {
        setState({ phase: "error", code: result.code, message: describe(result.code, result.message, result.retryAfter), retryAfter: result.retryAfter });
        return null;
      }
      setState({ phase: "ready", snapshot: result.snapshot });
      return result.snapshot;
    } catch {
      if (controller.signal.aborted) return null;
      setState({ phase: "error", code: "network", message: describe("network", "") });
      return null;
    }
  }, []);

  return { state, load, reset };
}
