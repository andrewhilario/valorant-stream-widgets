// The playable agent list from valorant-api.com: public, no key, allows browser requests.

const MEDIA_HOST = "https://media.valorant-api.com/";

export type Agent = {
  id: string;
  name: string;
  /**
   * A 64 × 64 round portrait, about 6 KiB. It is the API's `minimapPortrait`, on purpose: the field called
   * `displayIcon` (and its twin `displayIconSmall`, which is the very same file) is a 1024 px image of 400 to
   * 570 KiB, so a picker of 29 agents would be some 15 MB. Null when the API has no small portrait for an
   * agent; nothing falls back to the big file.
   */
  icon: string | null;
  role: string | null;
};

export function parseAgents(json: unknown): Agent[] {
  const list = (json as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];

  const agents: Agent[] = [];
  for (const raw of list) {
    const a = raw as Record<string, unknown>;
    if (typeof a?.uuid !== "string" || typeof a?.displayName !== "string") continue;
    if (a.isPlayableCharacter === false) continue;
    const icon = typeof a.minimapPortrait === "string" && a.minimapPortrait.startsWith(MEDIA_HOST) ? a.minimapPortrait : null;
    const role = (a.role as { displayName?: unknown } | null)?.displayName;
    agents.push({ id: a.uuid, name: a.displayName, icon, role: typeof role === "string" ? role : null });
  }
  return agents.sort((x, y) => x.name.localeCompare(y.name));
}

let cached: Promise<Agent[]> | null = null;

/** Fetched once per page load. Empty on failure; callers fall back to "any agent". */
export function fetchAgents(): Promise<Agent[]> {
  cached ??= fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true")
    .then((res) => {
      if (!res.ok) throw new Error(`valorant-api answered ${res.status}`);
      return res.json();
    })
    .then(parseAgents)
    .catch(() => {
      cached = null;
      return [];
    });
  return cached;
}
