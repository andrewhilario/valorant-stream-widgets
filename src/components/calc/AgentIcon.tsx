import type { CSSProperties } from "react";
import type { Agent } from "@/lib/agents";

/**
 * An agent's round portrait. It is decoration beside the agent's name, so it has no alt text of its own; the size is
 * set on the element so the page doesn't shift as it loads. With no portrait, an empty ring keeps the layout.
 */
export function AgentIcon({
  agent,
  size = 32,
  className = "",
  eager = false,
}: {
  agent: Pick<Agent, "icon"> | null;
  size?: number;
  className?: string;
  /** Load now rather than when scrolled near. For things that only exist once someone has asked to see them. */
  eager?: boolean;
}) {
  const classes = `agenticon${className ? ` ${className}` : ""}`;
  if (!agent?.icon) {
    return <span className={`${classes} agenticon--blank`} style={{ width: size, height: size } as CSSProperties} aria-hidden="true" />;
  }
  return (
    <img className={classes} src={agent.icon} alt="" width={size} height={size} loading={eager ? "eager" : "lazy"} decoding="async" referrerPolicy="no-referrer" />
  );
}
