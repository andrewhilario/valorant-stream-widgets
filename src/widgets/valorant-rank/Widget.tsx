"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { actRecord, type CurrentAct } from "@/lib/act-record";
import type { KdSummary, RankData } from "@/lib/rank-types";
import { computeSession, currentStreak } from "@/lib/session";
import { progressFor, tierFamily, tierStep } from "@/lib/tiers";
import { flagVisible, type RankConfig } from "./definition";
import { REACTION_MS, type Reaction, type ReactionKind } from "./reactions";
import { resolveTheme, tierColor, tierTone } from "./themes";
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
  /** The K/D over the last ranked games and the Act that is running: what the Full layout adds to the rank (null while unknown). */
  kd?: KdSummary | null;
  act?: CurrentAct | null;
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

type IconName = "kd" | "wl" | "wr" | "streak";

/** Small drawn icons for the Full layout's stat labels: crossed swords, a trophy, a rising line and a flame. */
function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, string[]> = {
    kd: ["M14.5 17.5 3 6V3h3l11.5 11.5", "M13 19l6-6", "M16 16l4 4", "M19 21l2-2", "M14.5 6.5 18 3h3v3l-3.5 3.5", "M5 14l4 4", "M7 17l-3 3", "M3 19l2 2"],
    wl: ["M6 9H4.5a2.5 2.5 0 0 1 0-5H6", "M18 9h1.5a2.5 2.5 0 0 0 0-5H18", "M4 22h16", "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22", "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22", "M18 2H6v7a6 6 0 0 0 12 0V2Z"],
    wr: ["M22 7 13.5 15.5l-5-5L2 17", "M16 7h6v6"],
    streak: ["M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5Z"],
  };
  return (
    <svg className="w__icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {paths[name].map((d) => (
        <path key={d} d={d} />
      ))}
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
  size: "hero" | "xl" | "lg" | "md" | "sm";
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

type Stat = { key: string; label: string; lead?: boolean; value: ReactNode; sub?: string; icon?: IconName };

export function RankWidget({ config, data, icons, now, ready, reaction = null, kd = null, act = null }: WidgetProps) {
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

  const full = config.layout === "full" || config.layout === "fullstack";
  const record = useMemo(() => actRecord(data?.seasons, act), [data, act]);
  const streak = useMemo(() => currentStreak(data?.history ?? []), [data]);

  const style = {
    ...theme.vars,
    "--w-scale": config.scale / 100,
    "--w-tier": tierColor(family, theme.surface),
    ...(full ? { "--w-tier-glow": tierTone(family, theme.surface, 0.5), "--w-tier-soft": tierTone(family, theme.surface, 0.2) } : {}),
  } as CSSProperties;

  const show = (flag: string) => flagVisible(config, flag);
  const progress = current ? progressFor(tierId, current.rr) : ({ kind: "none" } as const);
  const badgeSize = full ? "hero" : config.layout === "card" ? "lg" : config.layout === "stack" ? "xl" : "md";

  // ── Stats row ──────────────────────────────────────────────────────────
  const stats: Stat[] = [];
  const dash = "—";
  if (full) {
    // The Full layout's tiles: K/D from the last ranked games, and the record and win rate of the Act that is running.
    if (show("kd")) {
      stats.push({
        key: "kd",
        label: "K/D",
        icon: "kd",
        value: (
          <span className="w__num" data-tone="tier">
            {kd?.value != null ? kd.value.toFixed(2) : dash}
          </span>
        ),
        sub: kd && kd.games > 0 ? `last ${kd.games} ${kd.games === 1 ? "game" : "games"}` : undefined,
      });
    }
    if (show("rec")) {
      stats.push({
        key: "rec",
        label: "W / L",
        icon: "wl",
        value: record ? (
          <>
            <span className="w__num">{count(record.wins)}</span>
            <span className="w__slash"> / </span>
            <span className="w__dim">{count(record.losses)}</span>
          </>
        ) : (
          dash
        ),
        sub: record ? "this Act" : undefined,
      });
    }
    if (show("wr")) {
      stats.push({
        key: "wr",
        label: "Winrate",
        icon: "wr",
        value: record?.winRate != null ? `${Math.round(record.winRate)}%` : dash,
        sub: record && record.games > 0 ? `${count(record.games)} games` : undefined,
      });
    }
  } else if (show("net")) {
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
  if (!full && show("gl")) {
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
  if (!full && show("rec")) {
    stats.push({
      key: "rec",
      label: "Record",
      value: rankKnown ? `${session.wins}W${NBSP}${EN_DASH}${NBSP}${session.losses}L` : dash,
    });
  }
  if (!full && show("wr")) {
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
          {full && (
            <p className="w__pmeta w__pmeta--top">
              <span>Rank rating</span>
              <span>
                <b>{progress.rr}</b>
                {NBSP}/{NBSP}100{NBSP}RR
              </span>
            </p>
          )}
          <div className="w__track" role="img" aria-label={`${progress.rr} of 100 RR`}>
            {/* Keyed by tier: a new rank starts the bar over, so it appears at its new length instead of sliding back. */}
            <div key={tierId} className="w__fill" style={{ "--p": progress.rr / 100 } as CSSProperties} />
          </div>
          {config.layout !== "strip" && !full && (
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
        <p className={full ? "w__pmeta w__pmeta--top" : "w__pmeta w__pmeta--solo"}>
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

  // The Full layout's footer: a win streak of two or more, else the last game's RR.
  let foot: ReactNode = null;
  if (full && show("streak") && streak.kind === "win" && streak.length >= 2) {
    foot = (
      <>
        <Icon name="streak" />
        <span>{streak.length} win streak</span>
      </>
    );
  } else if (full && show("last") && delta !== null) {
    foot = (
      <span>
        Last game{NBSP}
        <b className="w__num" data-tone={delta > 0 ? "gain" : "loss"}>
          {signed(delta)}
          {NBSP}RR
        </b>
      </span>
    );
  }

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

        {full && (
          <div className="w__top">
            <span className="w__live">
              <i className="w__dot" aria-hidden="true" />
              Live · Ranked
            </span>
            {act && <span className="w__act">{act.label}</span>}
          </div>
        )}

        <header className="w__head">
          <Badge tierId={tierId} icons={icons} size={badgeSize} />
          <div className="w__rank">
            {full && <p className="w__kicker">Current rank</p>}
            <p className="w__tier">{current?.tier ?? dash}</p>
            {full && progressBlock}
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

        {!full && progressBlock}

        {stats.length > 0 && (
          <dl className="w__stats">
            {stats.map((s) => (
              <div key={s.key} className="w__stat" data-lead={s.lead ? "true" : "false"}>
                <dt>
                  {s.icon && <Icon name={s.icon} />}
                  {s.label}
                </dt>
                <dd>
                  {s.value}
                  {s.sub && <span className="w__sub">{s.sub}</span>}
                </dd>
              </div>
            ))}
          </dl>
        )}

        {foot && <p className="w__foot">{foot}</p>}

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
