"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchAgents, type Agent } from "@/lib/agents";

export type AgentsStatus = "idle" | "loading" | "ready" | "failed";

/**
 * The playable agents, for names and icons. The list is a 20 KiB download, so it is only fetched once `enabled`:
 * a page that needs it straight away passes true, one that might never need it waits for a reason. "Failed" means
 * valorant-api.com couldn't be reached; `retry` tries again.
 */
export function useAgents(enabled = true) {
  const [state, setState] = useState<{ agents: Agent[]; status: AgentsStatus }>({ agents: [], status: "idle" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let current = true;
    setState((s) => (s.status === "ready" ? s : { agents: [], status: "loading" }));
    void fetchAgents().then((list) => {
      if (current) setState(list.length > 0 ? { agents: list, status: "ready" } : { agents: [], status: "failed" });
    });
    return () => {
      current = false;
    };
  }, [enabled, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { agents: state.agents, status: state.status, retry };
}
