"use client";

import { useMemo, useState } from "react";
import { dec, int, signed } from "@/lib/format";
import { MAX_TARGET_TIER, MIN_TIER } from "@/lib/rank-calc";
import {
  CURRENT_TIERS,
  evaluateRank,
  RANK_EXAMPLE,
  targetTiers,
  withCurrentTier,
  type RankErrors,
  type RankField,
  type RankForm,
} from "@/lib/rank-tool";
import type { AgentStat, Snapshot } from "@/lib/snapshot";
import { tierName } from "@/lib/tiers";
import type { Agent } from "@/lib/agents";
import { AccountPanel } from "./AccountPanel";
import { AgentIcon } from "./AgentIcon";
import { NumberField } from "./NumberField";
import { Facts, Figure, Gauge, MiniTable, StatusLine } from "./ResultParts";
import { SelectField } from "./SelectField";
import { StickyResult } from "./StickyResult";
import { useAgents } from "./useAgents";
import { useDebounced } from "./useDebounced";

type Source = { kind: "example" } | { kind: "games"; text: string } | { kind: "edited" };

const FIELD_LABELS: Record<RankField, string> = {
  rr: "Current RR",
  winRate: "Win rate",
  rrWin: "RR per win",
  rrLoss: "RR per loss",
};

const tierOptions = (tiers: number[]) => tiers.map((t) => ({ value: String(t), label: tierName(t) }));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const games = (n: number) => `${int(n)} ${n === 1 ? "game" : "games"}`;

function Errors({ errors }: { errors: RankErrors }) {
  const entries = Object.entries(errors) as Array<[RankField, string]>;
  return (
    <div className="result__problem">
      <p className="result__headline">Fix these to see your estimate.</p>
      <ul>
        {entries.map(([field, message]) => (
          <li key={field}>
            <strong>{FIELD_LABELS[field]}:</strong> {message}
          </li>
        ))}
      </ul>
    </div>
  );
}

function AgentRow({ stat, agent, onUse }: { stat: AgentStat; agent: Agent | null; onUse: (stat: AgentStat) => void }) {
  const usable = stat.winRate !== null || stat.avgRrWin !== null || stat.avgRrLoss !== null;
  return (
    <li className="agent">
      <AgentIcon agent={agent} size={32} />
      <div className="agent__text">
        <p className="agent__name">{stat.name}</p>
        <p className="agent__stats">
          {games(stat.games)} · {stat.winRate === null ? "no result yet" : `${dec(stat.winRate)}% wins`}
          {stat.avgRrWin !== null && stat.avgRrLoss !== null && ` · ${signed(stat.avgRrWin, 1)} / ${signed(-stat.avgRrLoss, 1)} RR`}
        </p>
      </div>
      {usable ? (
        <button type="button" className="linkbtn" aria-label={`Use your ${stat.name} numbers`} onClick={() => onUse(stat)}>
          Use
        </button>
      ) : (
        <span className="agent__none">No numbers</span>
      )}
    </li>
  );
}

export function RankCalculator() {
  const [form, setForm] = useState<RankForm>(RANK_EXAMPLE);
  const [source, setSource] = useState<Source>({ kind: "example" });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  // Only the icons in "Your recent agents" need the list, so it waits until there are agents to show.
  const { agents } = useAgents(snapshot !== null && snapshot.agentsAvailable);

  const view = useMemo(() => evaluateRank(form), [form]);
  const edited = <K extends keyof RankForm>(key: K) => (value: RankForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSource({ kind: "edited" });
  };

  const byId = useMemo(() => new Map(agents.map((a) => [a.id, a])), [agents]);

  function fromGames(s: Snapshot): string | null {
    const patch: Partial<RankForm> = {};
    let note: string | null = null;

    if (s.rank.tierId >= MIN_TIER && s.rank.tierId < MAX_TARGET_TIER) {
      patch.tier = s.rank.tierId;
      patch.rr = String(clamp(Math.round(s.rank.rr), 0, 99));
    } else if (s.rank.tierId >= MAX_TARGET_TIER) {
      note = `You're ${s.rank.tier}, and this calculator stops at Immortal 1, so your rank was left as it was.`;
    } else {
      note = "Your account is still unranked, so your rank was left as it was.";
    }
    if (s.winRate !== null) patch.winRate = String(Math.round(s.winRate * 10) / 10);
    if (s.avgRrWin !== null) patch.rrWin = String(s.avgRrWin);
    if (s.avgRrLoss !== null) patch.rrLoss = String(s.avgRrLoss);
    if (s.games > 0 && s.games < 10) note = `${note ? `${note} ` : ""}Only ${s.games} ranked ${s.games === 1 ? "game" : "games"} to go on, so treat these as a rough guide.`;

    setSnapshot(s);
    // Loading your rank means you want the next one, so that is the target until you pick another.
    setForm((f) => (patch.tier === undefined ? { ...f, ...patch } : { ...f, ...patch, tier: patch.tier, target: Math.min(MAX_TARGET_TIER, patch.tier + 1) }));
    setSource({ kind: "games", text: `From your last ${s.games} ranked ${s.games === 1 ? "game" : "games"}` });
    return note;
  }

  function applyAgent(stat: AgentStat) {
    setForm((f) => ({
      ...f,
      ...(stat.winRate !== null ? { winRate: String(Math.round(stat.winRate * 10) / 10) } : {}),
      ...(stat.avgRrWin !== null ? { rrWin: String(stat.avgRrWin) } : {}),
      ...(stat.avgRrLoss !== null ? { rrLoss: String(stat.avgRrLoss) } : {}),
    }));
    setSource({ kind: "games", text: `From your ${games(stat.games)} on ${stat.name}` });
  }

  const errors = view.kind === "invalid" ? view.errors : {};
  const target = tierName(form.target);
  const from = tierName(form.tier);

  // What a screen reader hears. Held back until typing pauses, so it doesn't chatter on every keystroke.
  const spoken = useDebounced(
    view.kind === "ok"
      ? `About ${games(view.expected)} of ranked to reach ${target} from ${from}. Eight in ten runs take between ${int(view.fast)} and ${int(view.slow)} games.`
      : view.kind === "losing"
        ? `At a ${dec(view.plan.winRate)} percent win rate you lose RR on average, so the climb does not finish. Break-even is ${dec(view.breakEven)} percent.`
        : "Some numbers need fixing before there is an estimate.",
    600,
  );

  const status =
    source.kind === "example" ? (
      <StatusLine tone="example">Example values. Replace them with yours.</StatusLine>
    ) : source.kind === "games" ? (
      <StatusLine tone="live">{source.text}.</StatusLine>
    ) : (
      <StatusLine tone="none" />
    );

  return (
    <div className="calc" id="calculator">
      <div className="calc__form">
        <AccountPanel summary="Use my recent ranked games" onLoaded={fromGames} />

        <div className="calc__group" role="group" aria-labelledby="where-title">
          <h2 className="calc__title" id="where-title">
            Where you are
          </h2>
          <div className="calc__grid">
            <SelectField
              label="Current rank"
              help="Iron 1 to Ascendant 3"
              value={String(form.tier)}
              options={tierOptions(CURRENT_TIERS)}
              onChange={(v) => {
                setForm((f) => withCurrentTier(f, Number(v)));
                setSource({ kind: "edited" });
              }}
              ctl="tier"
            />
            <NumberField label="Current RR" help="0 to 99" integer value={form.rr} error={errors.rr} onChange={edited("rr")} ctl="rr" />
            <div className="calc__span">
              <SelectField
                label="Target rank"
                help="Up to Immortal 1"
                value={String(form.target)}
                options={tierOptions(targetTiers(form.tier))}
                onChange={(v) => edited("target")(Number(v))}
                ctl="target"
              />
            </div>
          </div>
        </div>

        <div className="calc__group" role="group" aria-labelledby="play-title">
          <h2 className="calc__title" id="play-title">
            How you play
          </h2>
          <div className="calc__grid">
            <div className="calc__span">
              <NumberField
                label="Win rate (%)"
                help="Share of your games you win"
                value={form.winRate}
                error={errors.winRate}
                onChange={edited("winRate")}
                ctl="winRate"
              />
            </div>
            <NumberField label="RR per win" help="Average gain" value={form.rrWin} error={errors.rrWin} onChange={edited("rrWin")} ctl="rrWin" />
            <NumberField
              label="RR per loss"
              help="Average loss, no minus"
              value={form.rrLoss}
              error={errors.rrLoss}
              onChange={edited("rrLoss")}
              ctl="rrLoss"
            />
          </div>
        </div>

        {snapshot && snapshot.agentsAvailable && snapshot.agents.length > 0 && (
          <div className="calc__group" role="group" aria-labelledby="agents-title">
            <h2 className="calc__title" id="agents-title">
              Your recent agents
            </h2>
            <p className="calc__note">
              From your last ranked games. Small samples swing a lot, so read these as hints. “Use” copies an agent’s win rate and RR into the
              numbers above.
            </p>
            <ul className="agents">
              {snapshot.agents.map((stat) => (
                <AgentRow key={stat.id} stat={stat} agent={byId.get(stat.id) ?? null} onUse={applyAgent} />
              ))}
            </ul>
          </div>
        )}
        {snapshot && !snapshot.agentsAvailable && (
          <p className="calc__note">Your per-agent numbers couldn’t be loaded this time. Your rank and averages above are still from your games.</p>
        )}
      </div>

      <section className="result" id="estimate" aria-labelledby="estimate-title">
        <h2 className="sr-only" id="estimate-title">
          Your estimate
        </h2>
        {status}

        {view.kind === "invalid" && <Errors errors={view.errors} />}

        {view.kind === "ok" && (
          <>
            <Figure
              value={int(view.expected)}
              unit={view.expected === 1 ? "ranked game" : "ranked games"}
              headline={
                <>
                  to reach <strong>{target}</strong> from {from} at {int(view.plan.currentRr)} RR
                </>
              }
            />
            <p className="result__note">
              {view.fast === view.slow
                ? "At this win rate every run takes about the same number of games."
                : `8 in 10 runs take between ${int(view.fast)} and ${games(view.slow)}.`}
            </p>
            {view.fast !== view.slow && <Gauge low={view.fast} mid={view.expected} high={view.slow} labels={["Quick run", "Typical", "Slow run"]} unit="games" />}
            <Facts
              rows={[
                { label: "RR to go", value: int(view.gap) },
                { label: "Average RR per game", value: signed(view.meanPerGame) },
                { label: "Break-even win rate", value: `${dec(view.breakEven)}%` },
              ]}
            />
            <MiniTable
              caption={`Games to ${target} at other win rates`}
              head={["Win rate", "Games"]}
              rows={view.sweep.map((row) => ({
                key: String(row.winRate),
                current: row.current,
                cells: [`${dec(row.winRate)}%${row.current ? " · yours" : ""}`, row.games === null ? "Doesn’t finish" : int(row.games)],
              }))}
            />
            <MiniTable
              caption="Win rate needed, on average, to finish in"
              head={["Games", "Win rate"]}
              rows={view.goals.map((goal) => ({
                key: String(goal.games),
                cells: [int(goal.games), goal.winRate === null ? "Out of reach" : `${dec(goal.winRate)}%`],
              }))}
            />
          </>
        )}

        {view.kind === "losing" && (
          <>
            <Figure
              value={`${dec(view.breakEven)}%`}
              unit="win rate to break even"
              headline={
                <>
                  At {dec(view.plan.winRate)}% you lose about {dec(Math.abs(view.meanPerGame), 2)} RR a game on average, so the climb to <strong>{target}</strong>{" "}
                  doesn’t finish.
                </>
              }
            />
            <p className="result__note">Win more than that, or gain more per win than you lose per loss, and the estimate appears.</p>
            <Facts
              rows={[
                { label: "RR to go", value: int(view.gap) },
                { label: "Average RR per game", value: signed(view.meanPerGame) },
              ]}
            />
            <MiniTable
              caption={`Win rates that would get you to ${target}`}
              head={["Win rate", "Games"]}
              rows={view.sweep.map((row) => ({
                key: String(row.winRate),
                current: row.current,
                cells: [`${dec(row.winRate)}%${row.current ? " · yours" : ""}`, row.games === null ? "Doesn’t finish" : int(row.games)],
              }))}
            />
          </>
        )}

        <p className="sr-only" role="status">
          {spoken}
        </p>
      </section>

      <StickyResult calculatorId="calculator" resultId="estimate">
        <p className="stickybar__result">
          {view.kind === "ok" ? (
            <>
              <strong>{int(view.expected)}</strong> ranked {view.expected === 1 ? "game" : "games"} to {target}
            </>
          ) : view.kind === "losing" ? (
            <>
              <strong>{dec(view.breakEven)}%</strong> wins to break even
            </>
          ) : (
            <>Some numbers need fixing</>
          )}
        </p>
        <a className="linkbtn" href="#estimate">
          Details
        </a>
      </StickyResult>
    </div>
  );
}
