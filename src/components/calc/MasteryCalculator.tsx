"use client";

import { useEffect, useMemo, useState } from "react";
import { daysText, dec, hoursText, int, list } from "@/lib/format";
import { creditRange, mpForLevel } from "@/lib/mastery";
import {
  evaluateMastery,
  MASTERY_EXAMPLE,
  type MasteryErrors,
  type MasteryField,
  type MasteryForm,
} from "@/lib/mastery-tool";
import { defaultMinutes, GAME_MODES, lengthLabel, modeById } from "@/lib/modes";
import type { AgentStat, Snapshot } from "@/lib/snapshot";
import { AccountPanel } from "./AccountPanel";
import { AgentIcon } from "./AgentIcon";
import { AgentPicker } from "./AgentPicker";
import { NumberField } from "./NumberField";
import { Facts, Figure, Gauge, MiniTable, StatusLine } from "./ResultParts";
import { SelectField } from "./SelectField";
import { StickyResult } from "./StickyResult";
import { useAgents } from "./useAgents";
import { useDebounced } from "./useDebounced";

type Source = { kind: "example" } | { kind: "games"; text: string } | { kind: "edited" };

const FIELD_LABELS: Record<MasteryField, string> = {
  level: "Act Level",
  mpInto: "MP into this level",
  target: "Target Act Level",
  lifetime: "Lifetime Level",
  minutes: "Match length",
  winRate: "Win rate",
  bonus: "Performance bonus",
  hours: "Hours per day",
};

const round1 = (n: number) => String(Math.round(n * 10) / 10);

/**
 * What your ranked games can fill in. They are first-to-13 games, so they say how long Competitive, Unrated and
 * Premier matches run; in Swiftplay and the other short modes the match length stays as chosen. Win rate is yours
 * whatever the mode, so it always applies.
 */
function patchFrom(form: MasteryForm, minutes: number | null, winRate: number | null): Partial<MasteryForm> {
  return {
    ...(minutes !== null && modeById(form.mode).standard ? { minutes: round1(minutes) } : {}),
    ...(winRate !== null ? { winRate: round1(winRate) } : {}),
  };
}

function Errors({ errors }: { errors: MasteryErrors }) {
  const entries = Object.entries(errors) as Array<[MasteryField, string]>;
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

export function MasteryCalculator() {
  const [form, setForm] = useState<MasteryForm>(MASTERY_EXAMPLE);
  const [agentId, setAgentId] = useState("");
  const [source, setSource] = useState<Source>({ kind: "example" });
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);

  // The agent list is a 20 KiB download that isn't needed to show the first result, so it waits: until you first
  // touch the form, or your games load, or a few seconds pass, whichever comes first.
  const [wantAgents, setWantAgents] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setWantAgents(true), 3000);
    return () => clearTimeout(id);
  }, []);
  const { agents, status: agentsStatus, retry: retryAgents } = useAgents(wantAgents || snapshot !== null);

  const view = useMemo(() => evaluateMastery(form), [form]);
  const edited = <K extends keyof MasteryForm>(key: K) => (value: MasteryForm[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setSource({ kind: "edited" });
  };

  const agent = agents.find((a) => a.id === agentId) ?? null;
  const agentName = agent?.name ?? null;
  const agentStat: AgentStat | null = snapshot?.agents.find((a) => a.id === agentId) ?? null;

  // Your own ranked average, if you've loaded it: the better guess for how long a first-to-13 match runs.
  const rankedAverage = agentStat?.avgMinutes ?? snapshot?.avgMinutes ?? null;

  function pickMode(id: string) {
    const mode = modeById(id);
    setForm((f) => ({ ...f, mode: mode.id, minutes: round1(defaultMinutes(mode, rankedAverage)) }));
    setSource({ kind: "edited" });
  }

  function fromGames(s: Snapshot, chosen: string): string | null {
    const stat = s.agents.find((a) => a.id === chosen) ?? null;
    const minutes = stat ? stat.avgMinutes : s.avgMinutes;
    const winRate = stat ? stat.winRate : s.winRate;
    let note: string | null = null;

    if (minutes === null) note = "Match lengths weren’t available, so the match length was left as it was.";
    else if (!modeById(form.mode).standard) note = "Your ranked games only fill in the match length for Competitive, Unrated and Premier.";
    if (chosen && !stat && s.agentsAvailable) note = `${note ? `${note} ` : ""}No recent ranked games on that agent, so these are your overall numbers.`;

    setSnapshot(s);
    setForm((f) => ({ ...f, ...patchFrom(f, minutes, winRate) }));
    setSource({
      kind: "games",
      text: stat ? `From your ${stat.games} recent ranked ${stat.games === 1 ? "game" : "games"} on ${stat.name}` : `From your last ${s.games} ranked ${s.games === 1 ? "game" : "games"}`,
    });
    return note;
  }

  const errors = view.kind === "invalid" ? view.errors : {};
  const target = view.kind === "ok" ? view.input.targetLevel : Number(form.target);
  const from = view.kind === "ok" ? view.input.currentLevel : Number(form.level);
  const onAgent = agentName ? ` on ${agentName}` : "";

  const spoken = useDebounced(
    view.kind === "ok"
      ? `About ${int(view.forecast.matches)} ${view.mode.name} ${view.forecast.matches === 1 ? "match" : "matches"} to reach Act Level ${target}${onAgent}, roughly ${hoursText(view.forecast.hours)} of play. ${int(view.forecast.remainingMp)} Mastery Points to go.`
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
      <div className="calc__form" onFocusCapture={() => setWantAgents(true)} onPointerDownCapture={() => setWantAgents(true)}>
        <AccountPanel summary="Use my recent ranked games" onLoaded={(s) => fromGames(s, agentId)} />

        <div className="calc__group" role="group" aria-labelledby="level-title">
          <h2 className="calc__title" id="level-title">
            Where you are
          </h2>
          <div className="calc__grid">
            <NumberField label="Act Level" help="0 to 29" integer value={form.level} error={errors.level} onChange={edited("level")} ctl="level" />
            <NumberField
              label="MP into this level"
              help="Toward the next one"
              integer
              value={form.mpInto}
              error={errors.mpInto}
              onChange={edited("mpInto")}
              ctl="mpInto"
            />
            <NumberField
              label="Target Act Level"
              help="Up to 30"
              integer
              value={form.target}
              error={errors.target}
              onChange={edited("target")}
              ctl="target"
            />
            <NumberField
              label="Lifetime Level"
              help="Optional"
              integer
              placeholder={view.kind === "ok" ? String(view.lifetime.from) : ""}
              value={form.lifetime}
              error={errors.lifetime}
              onChange={edited("lifetime")}
              ctl="lifetime"
            />
          </div>
        </div>

        <div className="calc__group" role="group" aria-labelledby="play-title">
          <h2 className="calc__title" id="play-title">
            How you play
          </h2>
          <div className="calc__grid">
            <div className="calc__span">
              <SelectField
                label="Game mode"
                help="Fills in a typical match length below. Change it if yours differs."
                value={modeById(form.mode).id}
                options={GAME_MODES.map((m) => ({ value: m.id, label: `${m.name} (${lengthLabel(m)})` }))}
                onChange={pickMode}
                ctl="mode"
              />
            </div>
            <div className="calc__span">
              <AgentPicker
                agents={agents}
                status={agentsStatus}
                value={agentId}
                onChange={setAgentId}
                onRetry={retryAgents}
                help="Names your result. Load your games to use this agent’s numbers."
              />
            </div>
            {snapshot && agentId && agentStat && (
              <p className="calc__note calc__span">
                Your last ranked games on {agentStat.name}: {int(agentStat.games)} {agentStat.games === 1 ? "game" : "games"}
                {agentStat.winRate !== null && `, ${dec(agentStat.winRate)}% wins`}, {dec(agentStat.avgMinutes)} min a match.{" "}
                <button
                  type="button"
                  className="linkbtn linkbtn--inline"
                  onClick={() => {
                    setForm((f) => ({ ...f, ...patchFrom(f, agentStat.avgMinutes, agentStat.winRate) }));
                    setSource({ kind: "games", text: `From your ${agentStat.games} recent ranked ${agentStat.games === 1 ? "game" : "games"} on ${agentStat.name}` });
                  }}
                >
                  Use these numbers
                </button>
              </p>
            )}
            {snapshot && agentId && !agentStat && snapshot.agentsAvailable && (
              <p className="calc__note calc__span">None of your last ranked games were on {agentName ?? "that agent"}.</p>
            )}
            <NumberField
              label="Match length (min)"
              help="One match, start to end"
              value={form.minutes}
              error={errors.minutes}
              onChange={edited("minutes")}
              ctl="minutes"
            />
            <NumberField label="Win rate (%)" help="Matches you win" value={form.winRate} error={errors.winRate} onChange={edited("winRate")} ctl="winRate" />
            <NumberField
              label="Performance bonus (%)"
              help="Riot hasn’t published it"
              value={form.bonus}
              error={errors.bonus}
              onChange={edited("bonus")}
              ctl="bonus"
            />
            <NumberField
              label="Hours per day"
              help="Optional"
              value={form.hours}
              error={errors.hours}
              onChange={edited("hours")}
              ctl="hours"
            />
          </div>
        </div>
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
              value={int(view.forecast.matches)}
              unit={`${view.mode.name} ${view.forecast.matches === 1 ? "match" : "matches"}`}
              headline={
                <>
                  to reach <strong>Act Level {target}</strong>
                  {agent && (
                    <>
                      {" on "}
                      <AgentIcon agent={agent} size={24} className="agenticon--inline" />
                      {" "}
                      {agent.name}
                    </>
                  )}
                  , from {from === 0 ? "the start" : `Level ${from}`}
                </>
              }
            />
            <p className="result__note">
              About {hoursText(view.forecast.hours)} of play
              {view.forecast.days !== null &&
                `, or ${daysText(view.forecast.days)} at ${dec(view.input.hoursPerDay)} ${view.input.hoursPerDay === 1 ? "hour" : "hours"} a day`}
              .
            </p>
            <Gauge
              low={view.bestCase}
              mid={view.forecast.matches}
              high={view.worstCase}
              labels={["All wins", "Typical", "All losses"]}
              unit="matches"
            />
            <MiniTable
              caption={`Matches to Act Level ${target}, by game mode`}
              head={["Mode", "Length", "Matches"]}
              rows={view.modes.map((row) => ({
                key: row.mode.id,
                current: row.picked,
                cells: [
                  `${row.mode.name}${row.picked ? " · your pick" : ""}`,
                  <span className="nowrap">{row.picked ? `${dec(row.minutes)} min` : lengthLabel(row.mode)}</span>,
                  <>
                    <strong>{int(row.matches)}</strong>
                    {row.fewest !== row.most && (
                      <span className="mini__range">
                        {int(row.fewest)}–{int(row.most)}
                      </span>
                    )}
                  </>,
                ],
              }))}
            />
            <p className="result__fine">
              Your pick uses the match length you entered; the other modes use the middle of Riot’s Estimated Game Time, and the smaller
              figure under each count is the spread across that range. Mastery Points come from minutes played, so it’s about{" "}
              {hoursText(view.forecast.hours)} in any mode: shorter modes just take more matches.
            </p>
            <Facts
              rows={[
                { label: "MP still to earn", value: int(view.forecast.remainingMp) },
                { label: "MP for a win", value: int(view.forecast.perMatch.win) },
                { label: "MP for a loss", value: int(view.forecast.perMatch.loss) },
                { label: "MP per match, on average", value: int(view.forecast.perMatch.average) },
                { label: "Act Levels to earn", value: int(view.forecast.levelsGained) },
              ]}
            />
            {view.input.bonusPct === 0 && (
              <p className="result__fine">
                Performance Score isn’t included. Riot hasn’t said how much it adds, so real matches may earn a little more and get you there
                sooner. Put your own figure in the bonus box if you know it.
              </p>
            )}
            {view.input.targetLevel > 10 && (
              <p className="result__fine">
                Levels past 10 are Overleveling, and they’re much steeper: Level 11 alone costs {int(mpForLevel(11))} MP.
              </p>
            )}

            {(view.accents.length > 0 || view.milestones.length > 0) && (
              <div className="rewards">
                <h3 className="rewards__title">On the way</h3>
                {view.accents.length > 0 && (
                  <p className="rewards__line">
                    <strong>Portrait Accents</strong> at Act {view.accents.length === 1 ? "Level" : "Levels"} {list(view.accents.map(String))}.
                  </p>
                )}
                {view.milestones.length > 0 && (
                  <ul className="rewards__list">
                    {view.milestones.map((m) => (
                      <li key={m.level}>
                        <strong>Lifetime Level {m.level}</strong>: {list(m.rewards.map((r) => r.name))}.{" "}
                        <span className="rewards__cost">{creditRange(m)} Kingdom Credits each.</span>
                      </li>
                    ))}
                  </ul>
                )}
                {view.lifetime.assumed && view.milestones.length > 0 && (
                  <p className="result__fine">Assumes your Lifetime Level is {view.lifetime.from}, the same as your Act Level. Fill in Lifetime Level if it isn’t.</p>
                )}
              </div>
            )}
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
              <strong>{int(view.forecast.matches)}</strong> {view.forecast.matches === 1 ? "match" : "matches"} to Level {target}
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
