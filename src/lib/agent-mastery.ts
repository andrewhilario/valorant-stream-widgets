// A player's Agent Mastery as HenrikDev reports it (the v1 agent-mastery endpoints, added in its v4.10.0, still marked BETA). Kept free of I/O
// so it is unit-tested against the schema in https://api.henrikdev.xyz/openapi.json (AgentMasteryV1*), written 2026-10-22.
//
// What the endpoint gives, per agent: its `tracks` (an id, an optional name and a `level` for each), the `flourish` levels (short and long),
// the equipped `customization`, and, on the single-agent endpoint only, numeric `modules` (stat id, name and value). What it does NOT give is
// Mastery Points or how far through a level the player is, so the calculators still need those typed. The schema does not say which track is
// the Act Level and which the Lifetime Level, and a track's `name` may be null: nothing here guesses, it passes the tracks on as they came.

import { ShapeError } from "./henrik-normalize";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

export type MasteryTrack = { id: string; name: string | null; level: number | null };

export type MasteryModule = { id: string | null; name: string | null; statId: string; statName: string | null; value: number };

export type AgentMastery = {
  /** The agent's id, lower case, the same one valorant-api.com uses. */
  agentId: string;
  agentName: string | null;
  tracks: MasteryTrack[];
  flourish: { short: number | null; long: number | null };
  /** Only on the single-agent lookup, and only when Riot sent them; null otherwise. */
  modules: MasteryModule[] | null;
};

export type MasteryAccount = { name: string; tag: string; puuid: string };

function account(raw: unknown): MasteryAccount {
  if (!isObj(raw)) throw new ShapeError("Mastery response has no account");
  const name = str(raw.name);
  const tag = str(raw.tag);
  const puuid = str(raw.puuid);
  if (!name || !tag || !puuid) throw new ShapeError("Mastery account is missing its name, tag or puuid");
  return { name, tag, puuid };
}

function module(raw: unknown): MasteryModule | null {
  if (!isObj(raw) || !isObj(raw.stat)) return null;
  const statId = str(raw.stat.id);
  const value = num(raw.value);
  if (!statId || value === null) return null;
  return { id: str(raw.id), name: str(raw.name), statId, statName: str(raw.stat.name), value };
}

/** One agent's entry, or null when it has no usable id (it is then left out rather than failing the whole lookup). */
function entry(raw: unknown): AgentMastery | null {
  if (!isObj(raw) || !isObj(raw.agent)) return null;
  const id = str(raw.agent.id);
  if (!id) return null;
  const tracks = Array.isArray(raw.tracks)
    ? raw.tracks.flatMap((t): MasteryTrack[] => (isObj(t) && str(t.id) ? [{ id: str(t.id)!, name: str(t.name), level: num(t.level) }] : []))
    : [];
  const flourish = isObj(raw.flourish) ? raw.flourish : {};
  const modules = Array.isArray(raw.modules) ? raw.modules.flatMap((m): MasteryModule[] => { const made = module(m); return made ? [made] : []; }) : null;
  return {
    agentId: id.toLowerCase(),
    agentName: str(raw.agent.name),
    tracks,
    flourish: { short: num(flourish.short_level), long: num(flourish.long_level) },
    modules,
  };
}

/** `GET /valorant/v1/agent-mastery/{region}/{platform}/{name}/{tag}`: every agent the account has an entry for. */
export function normalizeAgentMastery(json: unknown): { account: MasteryAccount; agents: AgentMastery[] } {
  if (!isObj(json) || !isObj(json.data)) throw new ShapeError("Mastery response has no data object");
  if (!Array.isArray(json.data.agents)) throw new ShapeError("Mastery response has no list of agents");
  return {
    account: account(json.data.account),
    agents: json.data.agents.flatMap((a): AgentMastery[] => { const made = entry(a); return made ? [made] : []; }),
  };
}

/** `GET …/agent-mastery/{region}/{platform}/{name}/{tag}/{agent_id}`: one agent, with its stat modules when there are any. */
export function normalizeAgentMasteryDetail(json: unknown): { account: MasteryAccount; agent: AgentMastery } {
  if (!isObj(json) || !isObj(json.data)) throw new ShapeError("Mastery response has no data object");
  const agent = entry(json.data.mastery);
  if (!agent) throw new ShapeError("Mastery response has no agent");
  return { account: account(json.data.account), agent };
}

/** The agents the player has actually levelled (some track above 0), highest level first: what a "your agents" list would show. */
export function playedAgents(agents: AgentMastery[]): AgentMastery[] {
  const top = (a: AgentMastery) => Math.max(0, ...a.tracks.map((t) => t.level ?? 0));
  return agents.filter((a) => top(a) > 0).sort((x, y) => top(y) - top(x) || (x.agentName ?? x.agentId).localeCompare(y.agentName ?? y.agentId));
}
