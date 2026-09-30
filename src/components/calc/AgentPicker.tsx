"use client";

import { Users } from "lucide-react";
import { useId, useRef, useState, type CSSProperties, type KeyboardEvent, type MouseEvent } from "react";
import type { Agent } from "@/lib/agents";
import { AgentIcon } from "./AgentIcon";
import type { AgentsStatus } from "./useAgents";

/** The "no particular agent" choice. It needs an icon of its own so it sits in the grid like the others. */
function AnyIcon({ size }: { size: number }) {
  return (
    <span className="agenticon agenticon--any" style={{ width: size, height: size } as CSSProperties} aria-hidden="true">
      <Users />
    </span>
  );
}

/**
 * Choose an agent from their portraits. A native <select> can't show images, so this is a disclosure that shows the
 * current choice (portrait and name) and opens a grid of radio buttons. Being real radios, arrow keys move along the
 * grid, Tab leaves it, and each one has the agent's name for a screen reader.
 */
export function AgentPicker({
  agents,
  status,
  value,
  onChange,
  onRetry,
  help,
}: {
  agents: Agent[];
  status: AgentsStatus;
  /** An agent's id, or "" for any agent. */
  value: string;
  onChange: (id: string) => void;
  onRetry: () => void;
  help?: string;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const summary = useRef<HTMLElement>(null);
  const selected = agents.find((a) => a.id === value) ?? null;

  // Closing hides the focused radio, so focus goes back to the summary rather than being lost.
  const close = () => {
    setOpen(false);
    summary.current?.focus();
  };

  // A click or tap chooses and closes. Arrow keys move the choice with the list still open: the browser sends those a
  // click too, but with a detail of 0, so they are left alone. Escape closes from the keyboard.
  const choose = (event: MouseEvent<HTMLInputElement>) => {
    if (event.detail > 0) close();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === "Escape" && open) {
      event.stopPropagation();
      close();
    }
  };

  return (
    <div className="agentpick">
      <span className="field__label" id={`${id}-label`}>
        Agent
      </span>

      <details className="agentpick__box" open={open} onToggle={(event) => setOpen(event.currentTarget.open)} onKeyDown={onKeyDown}>
        <summary className="agentpick__summary" ref={summary} aria-labelledby={`${id}-label ${id}-value`} aria-describedby={help ? `${id}-help` : undefined}>
          {selected ? <AgentIcon agent={selected} size={28} /> : <AnyIcon size={28} />}
          <span className="agentpick__name" id={`${id}-value`}>
            {selected ? selected.name : "Any agent"}
          </span>
        </summary>

        {/* Only built while open, so the 29 portraits (about 190 KiB) are fetched when someone asks to see them, not before. */}
        <div className="agentpick__panel">
          {!open ? null : status === "ready" ? (
            <div className="agentpick__grid" role="radiogroup" aria-labelledby={`${id}-label`}>
              <label className="agentpick__opt" title="Any agent">
                <input type="radio" name={id} value="" checked={value === ""} onChange={() => onChange("")} onClick={choose} />
                <AnyIcon size={40} />
                <span className="sr-only">Any agent</span>
              </label>
              {agents.map((agent) => (
                <label className="agentpick__opt" key={agent.id} title={agent.name}>
                  <input type="radio" name={id} value={agent.id} checked={value === agent.id} onChange={() => onChange(agent.id)} onClick={choose} />
                  <AgentIcon agent={agent} size={40} eager />
                  <span className="sr-only">{agent.name}</span>
                </label>
              ))}
            </div>
          ) : status === "failed" ? (
            <p className="agentpick__note" role="status">
              Couldn’t load the agent list.{" "}
              <button type="button" className="linkbtn linkbtn--inline" onClick={onRetry}>
                Try again
              </button>
            </p>
          ) : (
            <p className="agentpick__note" role="status">
              Loading agents…
            </p>
          )}
        </div>
      </details>

      {help && (
        <p className="field__help" id={`${id}-help`}>
          {help}
        </p>
      )}
    </div>
  );
}
