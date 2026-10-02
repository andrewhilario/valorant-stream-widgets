"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { RankData } from "@/lib/rank-types";
import { computeSession } from "@/lib/session";
import { progressFor, tierFamily, tierStep } from "@/lib/tiers";
import { flagVisible, type RankConfig } from "./definition";
import { REACTION_MS, type Reaction, type ReactionKind } from "./reactions";
import { resolveTheme, tierColor } from "./themes";
import "./widget.css";

const MINUS = "−";
const EN_DASH = "–";
const NBSP = " ";

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `${MINUS}${Math.abs(n)}` : "0");
const count = (n: number) => n.toLocaleString("en-US");

export type WidgetProps = {
  config: RankConfig;
  data: RankData | null;
  /** Official badge art keyed by tier id; a drawn glyph stands in until it loads. */
  icons: Record<string, string>;
  now: number;
  /** Fonts and first data are in — fade the widget in. */
  ready: boolean;
  /** The latest thing a game did (see reactions.ts). Played once per `n`, and only if the settings allow it. */
  reaction?: Reaction | null;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Which reaction is playing right now, or null. Each new `reaction.n` plays once, for the length of its animation.
 * A reaction that arrives while reactions are off, or when the viewer asked for less motion, is dropped rather than
 * saved up for later.
 *
 * A new reaction is picked up while rendering, not in an effect, so its marker is in the same frame as the numbers that
 * caused it and the animations start with them. (An effect would run a frame late: the new rank would show for a blink,
 * then be hidden by the animation's first keyframe.) If one is still playing, the marker comes off for a frame first, so
 * the animations start over instead of carrying on.
 */
function useReaction(reaction: Reaction | null | undefined, enabled: boolean): ReactionKind | null {
  const [playing, setPlaying] = useState<ReactionKind | null>(null);
  const [again, setAgain] = useState<ReactionKind | null>(null);
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
    const stop = setTimeout(() => setPlaying(null), REACTION_MS[playing]);
    return () => clearTimeout(stop);
  }, [playing]);

  return enabled ? playing : null;
}

/** Counts to a new value over 400 ms. The final value is what the DOM holds. */
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

  return <>{count(shown)}</>;
}

/** Drawn stand-in for the official badge: a hex frame with one to three chevrons. */
function TierGlyph({ tierId }: { tierId: number }) {
  const step = tierStep(tierId);
  const chevrons = step === 0 ? 0 : step;
  return (
    <svg className="w__glyph" viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <path className="w__glyph-frame" d="M24 4 41 14v20L24 44 7 34V14Z" />
      {Array.from({ length: chevrons }, (_, i) => (
        <path key={i} className="w__glyph-chev" d={`M16 ${27 - i * 6} 24 ${21 - i * 6} 32 ${27 - i * 6}`} />
      ))}
      {chevrons === 0 && <path className="w__glyph-chev" d="M17 24h14" />}
    </svg>
  );
}

function Badge({
  tierId,
  icons,
  size,
}: {
  tierId: number;
  icons: Record<string, string>;
  size: "xl" | "lg" | "md" | "sm";
}) {
  const src = icons[String(tierId)];
  return (
    <span className={`w__badge w__badge--${size}`}>
      {src ? (
        // Official art, decorative: the tier name sits beside it.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" width={64} height={64} decoding="async" referrerPolicy="no-referrer" />
      ) : (
        <TierGlyph tierId={tierId} />
      )}
    </span>
  );
}

type Stat = { key: string; label: string; lead?: boolean; value: ReactNode; sub?: string };

export function RankWidget({ config, data, icons, now, ready, reaction = null }: WidgetProps) {
  const theme = useMemo(
    () => resolveTheme({ preset: config.preset, accent: config.accent, opacity: config.opacity, signals: config.signals }),
    [config.preset, config.accent, config.opacity, config.signals],
  );
  const reacting = useReaction(reaction, config.animate && config.reactions);

  const current = data?.current ?? null;
  const tierId = current?.tierId ?? 0;
  const family = tierFamily(tierId);
  const rankKnown = current !== null;

  const session = useMemo(
    () =>
      computeSession(data?.history ?? [], {
        mode: config.sessionMode,
        gapHours: config.gap,
        windowHours: config.windowHours,
        now,
      }),
    [data, config.sessionMode, config.gap, config.windowHours, now],
  );

  const style = {
    ...theme.vars,
    "--w-scale": config.scale / 100,
    "--w-tier": tierColor(family, theme.surface),
  } as CSSProperties;

  const show = (flag: string) => flagVisible(config, flag);
  const progress = current ? progressFor(tierId, current.rr) : ({ kind: "none" } as const);
  const badgeSize = config.layout === "card" ? "lg" : config.layout === "stack" ? "xl" : "md";

  // ── Stats row ──────────────────────────────────────────────────────────
  const stats: Stat[] = [];
  const dash = "—";
  if (show("net")) {
    stats.push({
      key: "net",
      label: "Net RR",
      lead: true,
      value: (
        <span className="w__num" data-tone={session.net > 0 ? "gain" : session.net < 0 ? "loss" : "flat"}>
          {rankKnown ? signed(session.net) : dash}
        </span>
      ),
    });
  }
  if (show("gl")) {
    stats.push({
      key: "gl",
      label: "Gained / lost",
      value: rankKnown ? (
        <>
          <span className="w__num" data-tone="gain">
            +{session.gained}
          </span>
          <span className="w__slash"> / </span>
          <span className="w__num" data-tone="loss">
            {MINUS}
            {session.lost}
          </span>
        </>
      ) : (
        dash
      ),
    });
  }
  if (show("rec")) {
    stats.push({
      key: "rec",
      label: "Record",
      value: rankKnown ? `${session.wins}W${NBSP}${EN_DASH}${NBSP}${session.losses}L` : dash,
    });
  }
  if (show("wr")) {
    stats.push({
      key: "wr",
      label: "Win rate",
      value: session.winRate === null ? dash : `${Math.round(session.winRate)}%`,
      sub: rankKnown ? `${session.games} ${session.games === 1 ? "game" : "games"}` : undefined,
    });
  }

  // ── Progress ───────────────────────────────────────────────────────────
  let progressBlock: ReactNode = null;
  if (show("progress")) {
    if (progress.kind === "bar") {
      progressBlock = (
        <div className="w__progress">
          <div className="w__track" role="img" aria-label={`${progress.rr} of 100 RR`}>
            {/* Keyed by tier: a new rank starts the bar over, so it appears at its new length instead of sliding back. */}
            <div key={tierId} className="w__fill" style={{ "--p": progress.rr / 100 } as CSSProperties} />
          </div>
          {config.layout !== "strip" && (
            <p className="w__pmeta">
              <span>
                <b>{progress.rr}</b>
                {NBSP}/{NBSP}100
              </span>
              <span>
                {progress.toNext}
                {NBSP}RR to {progress.next}
              </span>
            </p>
          )}
        </div>
      );
    } else if (progress.kind === "open" && current) {
      progressBlock = (
        <p className="w__pmeta w__pmeta--solo">
          <span>
            <b>{count(current.rr)}</b>
            {NBSP}RR
          </span>
          {current.leaderboardRank !== null && <span>Leaderboard #{count(current.leaderboardRank)}</span>}
        </p>
      );
    } else if (current && current.gamesNeeded > 0) {
      progressBlock = (
        <p className="w__pmeta w__pmeta--solo">
          <span>
            {current.gamesNeeded} {current.gamesNeeded === 1 ? "game" : "games"} to a rank
          </span>
        </p>
      );
    }
  }

  const delta = current && tierId >= 3 && current.lastChange !== 0 ? current.lastChange : null;

  return (
    <div
      className="w"
      data-layout={config.layout}
      data-corners={config.corners}
      data-font={config.font}
      data-progress={config.progress}
      data-animate={config.animate ? "on" : "off"}
      data-ready={ready ? "true" : "false"}
      data-light={theme.light ? "true" : "false"}
      data-react={reacting ?? undefined}
      style={style}
    >
      <div className="w__panel">
        {config.marks && (
          <>
            <span className="w__mark w__mark--tl" aria-hidden="true" />
            <span className="w__mark w__mark--br" aria-hidden="true" />
          </>
        )}

        <header className="w__head">
          <Badge tierId={tierId} icons={icons} size={badgeSize} />
          <div className="w__rank">
            <p className="w__tier">{current?.tier ?? dash}</p>
            <p className="w__rr">
              {current && tierId >= 3 ? (
                <>
                  <span className="w__rr-n">
                    {/* Keyed by tier for the same reason: RR starts over in a new rank, so it shows the new number at once. */}
                    <Tick key={tierId} value={current.rr} animate={config.animate} />
                  </span>
                  <span className="w__rr-u">RR</span>
                </>
              ) : (
                <span className="w__rr-u">{rankKnown ? "Unrated" : `${dash} RR`}</span>
              )}
              {show("last") && delta !== null && (
                <span className="w__delta" data-tone={delta > 0 ? "gain" : "loss"}>
                  {signed(delta)}
                </span>
              )}
            </p>
          </div>
          {show("peak") && data?.peak && (
            <div className="w__peak">
              <span className="w__peak-l">Peak</span>
              <span className="w__peak-v">
                <Badge tierId={data.peak.tierId} icons={icons} size="sm" />
                {data.peak.tier}
              </span>
            </div>
          )}
        </header>

        {progressBlock}

        {stats.length > 0 && (
          <dl className="w__stats">
            {stats.map((s) => (
              <div key={s.key} className="w__stat" data-lead={s.lead ? "true" : "false"}>
                <dt>{s.label}</dt>
                <dd>
                  {s.value}
                  {s.sub && <span className="w__sub">{s.sub}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <p className="w__sr">
          Valorant rank {current?.tier ?? "loading"}
          {current && tierId >= 3 ? `, ${current.rr} RR` : ""}
        </p>

        {reacting && (
          <span className="w__fx" aria-hidden="true">
            <span className="w__fx-glow" />
            <span className="w__fx-sheen" />
          </span>
        )}
      </div>
    </div>
  );
}
