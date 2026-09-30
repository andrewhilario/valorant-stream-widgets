// Match summaries from HenrikDev's v4 matches endpoint, reduced to what the calculators need:
// which agent you played, how long the match ran, and whether you won.

export type Me = { name: string; tag: string; puuid?: string | null };

export type MatchSummary = {
  id: string;
  /** ms since the epoch, or null when the payload had no usable start time. */
  startedAt: number | null;
  lengthMs: number;
  agent: { id: string; name: string };
  /** From the team result; null when the payload didn't say. */
  won: boolean | null;
};

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** Finds you among the ten players, by puuid when we have it, otherwise by Riot ID. */
function findMe(players: unknown[], me: Me): Obj | null {
  const objects = players.filter(isObj);
  if (me.puuid) {
    const byId = objects.find((p) => p.puuid === me.puuid);
    if (byId) return byId;
  }
  const name = me.name.toLowerCase();
  const tag = me.tag.toLowerCase();
  return objects.find((p) => String(p.name ?? "").toLowerCase() === name && String(p.tag ?? "").toLowerCase() === tag) ?? null;
}

/** Bad or incomplete matches are skipped, not fatal. */
export function normalizeMatches(json: unknown, me: Me): MatchSummary[] {
  const data = isObj(json) ? json.data : null;
  if (!Array.isArray(data)) return [];

  const out: MatchSummary[] = [];
  for (const match of data) {
    if (!isObj(match) || !isObj(match.metadata) || !Array.isArray(match.players)) continue;

    const { metadata } = match;
    if (metadata.is_completed === false) continue;

    const id = str(metadata.match_id);
    const lengthMs = num(metadata.game_length_in_ms);
    if (id === null || lengthMs === null || lengthMs <= 0) continue;

    const player = findMe(match.players, me);
    if (!player || !isObj(player.agent)) continue;
    const agentId = str(player.agent.id);
    const agentName = str(player.agent.name);
    if (agentId === null || agentName === null) continue;

    let won: boolean | null = null;
    if (Array.isArray(match.teams)) {
      const team = match.teams.filter(isObj).find((t) => t.team_id === player.team_id);
      if (team && typeof team.won === "boolean") won = team.won;
    }

    const started = typeof metadata.started_at === "string" ? Date.parse(metadata.started_at) : NaN;
    out.push({
      id,
      startedAt: Number.isNaN(started) ? null : started,
      lengthMs,
      agent: { id: agentId, name: agentName },
      won,
    });
  }
  return out;
}
