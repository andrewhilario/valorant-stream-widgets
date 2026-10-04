"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Agent } from "@/lib/agents";
import { int } from "@/lib/format";
import { PORTRAIT_ACCENT_LEVELS } from "@/lib/mastery";
import { resolveTheme } from "../valorant-rank/themes";
import { flagVisible, type MasteryConfig } from "./definition";
import type { MasteryData, MasteryReaction, MasteryReactionKind } from "./mastery-types";
import { MASTERY_REACTION_MS } from "./reactions";
import "./widget.css";

export type MasteryWidgetProps = {
  config: MasteryConfig;
  data: MasteryData | null;
  agent: Agent | null;
  ready: boolean;
  reaction?: MasteryReaction | null;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function useMasteryReaction(reaction: MasteryReaction | null | undefined, enabled: boolean): MasteryReactionKind | null {
  const [playing, setPlaying] = useState<MasteryReactionKind | null>(null);
  const [again, setAgain] = useState<MasteryReactionKind | null>(null);
  const [seen, setSeen] = useState<number | null>(reaction?.n ?? null);

  if (reaction && reaction.n !== seen) {
    setSeen(reaction.n);
    if (enabled && !prefersReducedMotion()) {
      if (playing === null) {
        setPlaying(reaction.kind);
        setAgain(null);
      } else {
        setPlaying(null);
        setAgain(reaction.kind);
      }
    }
  }

  useEffect(() => {
    if (again === null) return;
    const frame = requestAnimationFrame(() => {
      setPlaying(again);
      setAgain(null);
    });
    return () => cancelAnimationFrame(frame);
  }, [again]);

  useEffect(() => {
    if (playing === null) return;
    const stop = setTimeout(() => setPlaying(null), MASTERY_REACTION_MS[playing]);
    return () => clearTimeout(stop);
  }, [playing]);

  return enabled ? playing : null;
}

function Tick({ value, animate }: { value: number; animate: boolean }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    if (!animate || prefersReducedMotion() || from.current === value) {
      from.current = value;
      setShown(value);
      return;
    }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / 400);
      const eased = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      setShown(Math.round(origin + (value - origin) * eased));
      if (p < 1) frame = requestAnimationFrame(step);
      else from.current = value;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [value, animate]);

  return <>{int(shown)}</>;
}

export function MasteryWidget({ config, data, agent, ready, reaction = null }: MasteryWidgetProps) {
  const theme = useMemo(
    () =>
      resolveTheme({
        preset: config.preset,
        accent: config.accent,
        opacity: config.opacity,
        signals: config.signals,
      }),
    [config.preset, config.accent, config.opacity, config.signals],
  );

  const reacting = useMasteryReaction(reaction, config.animate && config.reactions);

  const currentLevel = data ? data.currentLevel : Number(config.currentLevel) || 0;
  const targetLevel = data ? data.start.targetLevel : Number(config.targetLevel) || 10;
  const mpInto = data ? data.mpIntoCurrentLevel : Number(config.mpIntoLevel) || 0;
  const mpForNext = data ? data.mpForNextLevel : 2000;
  const progressRatio = mpForNext > 0 ? Math.min(1, Math.max(0, mpInto / mpForNext)) : 0;
  const isAccentLevel = PORTRAIT_ACCENT_LEVELS.includes(currentLevel as 4 | 7 | 10);

  const style = {
    ...theme.vars,
    "--w-scale": config.scale / 100,
  } as CSSProperties;

  const show = (flag: string) => flagVisible(config, flag);
  const agentDisplayName = agent?.name ?? (config.agentName || "Agent");
  const avatarLetter = agentDisplayName.charAt(0).toUpperCase();

  const wins = data ? data.matches.filter((m) => m.won).length : 0;
  const losses = data ? data.matches.filter((m) => !m.won).length : 0;

  return (
    <div
      className="m"
      data-layout={config.layout}
      data-corners={config.corners}
      data-font={config.font}
      data-animate={config.animate ? "on" : "off"}
      data-ready={ready ? "true" : "false"}
      data-light={theme.light ? "true" : "false"}
      data-react={reacting ?? undefined}
      style={style}
    >
      <div className="m__panel">
        {config.marks && (
          <>
            <span className="m__mark m__mark--tl" aria-hidden="true" />
            <span className="m__mark m__mark--br" aria-hidden="true" />
          </>
        )}

        <header className="m__head">
          <div className="m__avatar-frame">
            {agent?.icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={agent.icon} alt={agentDisplayName} width={64} height={64} decoding="async" />
            ) : (
              <span className="m__avatar-fallback">{avatarLetter}</span>
            )}
          </div>

          <div className="m__info">
            <h2 className="m__agent-name">{agentDisplayName}</h2>
            <div className="m__level-row">
              <span className="m__level-tag">Act Level</span>
              <span className="m__level-val">
                <Tick key={currentLevel} value={currentLevel} animate={config.animate} />
              </span>
              {isAccentLevel && <span className="m__star-badge" title="Portrait Accent Unlocked">★</span>}
            </div>
          </div>

          <div className="m__target-panel">
            <span className="m__target-label">Target</span>
            <span className="m__target-val">
              Level {targetLevel} {PORTRAIT_ACCENT_LEVELS.includes(targetLevel as 4 | 7 | 10) && <span>★</span>}
            </span>
          </div>
        </header>

        {show("progress") && (
          <div className="m__progress-section">
            <div className="m__track" role="progressbar" aria-valuenow={Math.round(progressRatio * 100)} aria-valuemin={0} aria-valuemax={100}>
              <div key={currentLevel} className="m__fill" style={{ "--p": progressRatio } as CSSProperties} />
            </div>
            <div className="m__meta">
              <span>
                <b><Tick value={mpInto} animate={config.animate} /></b> / {int(mpForNext)} MP ({Math.round(progressRatio * 100)}%)
              </span>
              <span className="m__meta-next">
                {int(Math.max(0, mpForNext - mpInto))} MP to Level {currentLevel + 1}
              </span>
            </div>
          </div>
        )}

        {show("milestones") && config.layout !== "strip" && (
          <div className="m__milestones">
            {PORTRAIT_ACCENT_LEVELS.map((lvl) => {
              const active = currentLevel >= lvl;
              return (
                <div
                  key={lvl}
                  className="m__milestone-card"
                  data-active={active ? "true" : "false"}
                >
                  <span>★</span>
                  <span>Level {lvl}</span>
                </div>
              );
            })}
          </div>
        )}

        {config.layout !== "badge" && (show("remaining") || show("session")) && (
          <dl className="m__stats">
            {show("remaining") && (
              <div className="m__stat">
                <dt>To Target</dt>
                <dd>
                  {data?.targetReached ? (
                    <span data-tone="reached">REACHED!</span>
                  ) : data?.matchesRemaining !== null && data?.matchesRemaining !== undefined ? (
                    `${data.matchesRemaining} ${data.matchesRemaining === 1 ? "match" : "matches"}`
                  ) : (
                    "—"
                  )}
                </dd>
              </div>
            )}
            {show("session") && (
              <div className="m__stat">
                <dt>Session MP</dt>
                <dd>
                  <span data-tone="gain">
                    +{int(data?.sessionMp ?? 0)}
                  </span>
                </dd>
              </div>
            )}
            {show("session") && (
              <div className="m__stat">
                <dt>Record</dt>
                <dd>
                  {data?.matches.length ? `${wins}W – ${losses}L` : "0W – 0L"}
                </dd>
              </div>
            )}
          </dl>
        )}

        <p className="m__sr">
          Valorant Agent Mastery: {agentDisplayName} Act Level {currentLevel}, {mpInto} of {mpForNext} MP. Target: Level {targetLevel}.
        </p>

        {reacting && (
          <span className="m__fx" aria-hidden="true">
            <span className="m__fx-glow" />
            <span className="m__fx-banner">
              {reacting === "level_up"
                ? "LEVEL UP!"
                : reacting === "target_reached"
                ? "TARGET REACHED!"
                : "+MP GAINED!"}
            </span>
          </span>
        )}
      </div>
    </div>
  );
}
