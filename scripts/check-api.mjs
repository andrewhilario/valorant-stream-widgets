// Checks a HenrikDev key and Riot ID against the real API and reports what came back.
// Use it once after getting a key, to confirm the shapes this app reads still match.
//
//   PowerShell:  $env:HENRIK_API_KEY = "HDEV-…"; npm run check:api -- ainz und3d ap
//   bash:        HENRIK_API_KEY=HDEV-… npm run check:api -- ainz und3d ap
//
// The key is read from the environment, not the command line, so it stays out of shell history.

const [name, tag, region = "na", platform = "pc"] = process.argv.slice(2);
const key = process.env.HENRIK_API_KEY?.trim();

if (!name || !tag || !key) {
  console.error("Usage: HENRIK_API_KEY=… npm run check:api -- <name> <tag> [region=na] [platform=pc]");
  process.exit(1);
}

const base = "https://api.henrikdev.xyz/valorant";
const who = `${region}/${platform}/${encodeURIComponent(name)}/${encodeURIComponent(tag)}`;

async function call(path) {
  const res = await fetch(`${base}${path}`, { headers: { Authorization: key, Accept: "application/json" } });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // non-JSON body
  }
  return { res, json };
}

const has = (obj, path) => path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
let failed = false;

function check(label, ok, detail = "") {
  if (!ok) failed = true;
  console.log(`  ${ok ? "ok  " : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
}

const mmr = await call(`/v3/mmr/${who}`);
console.log(`\nGET /v3/mmr/${region}/${platform}/…  →  HTTP ${mmr.res.status}`);
for (const h of ["ratelimit-limit", "ratelimit-remaining", "ratelimit-reset", "x-ratelimit-limit", "x-ratelimit-remaining"]) {
  const v = mmr.res.headers.get(h);
  if (v) console.log(`  ${h}: ${v}`);
}
check("status 200", mmr.res.status === 200, mmr.res.status === 401 ? "the key was rejected" : mmr.res.status === 404 ? "account not found" : "");
check("data.current.tier.id is a number", typeof has(mmr.json, "data.current.tier.id") === "number");
check("data.current.tier.name is a string", typeof has(mmr.json, "data.current.tier.name") === "string", String(has(mmr.json, "data.current.tier.name") ?? ""));
check("data.current.rr is a number", typeof has(mmr.json, "data.current.rr") === "number", String(has(mmr.json, "data.current.rr") ?? ""));
check("data.current.last_change is a number", typeof has(mmr.json, "data.current.last_change") === "number");

const history = await call(`/v2/mmr-history/${who}`);
console.log(`\nGET /v2/mmr-history/${region}/${platform}/…  →  HTTP ${history.res.status}`);
const list = has(history.json, "data.history");
check("status 200", history.res.status === 200);
check("data.history is an array", Array.isArray(list), Array.isArray(list) ? `${list.length} games` : "");
if (Array.isArray(list) && list[0]) {
  const first = list[0];
  check("entries have date, last_change and match_id", first.date !== undefined && typeof first.last_change === "number" && typeof first.match_id === "string");
  console.log(`  newest game: ${first.date} · ${first.last_change >= 0 ? "+" : ""}${first.last_change} RR`);
}

// The calculators' "Use my recent ranked games" button also reads recent matches, for the per-agent numbers.
// That request (and the query it sends) has only been tested against fixtures, so this is the check that matters most.
const puuid = has(mmr.json, "data.account.puuid");
const matches = await call(`/v4/matches/${who}?mode=competitive&size=10`);
console.log(`\nGET /v4/matches/${region}/${platform}/…?mode=competitive&size=10  →  HTTP ${matches.res.status}`);
const games = has(matches.json, "data");
check("status 200", matches.res.status === 200, matches.res.status === 400 ? "HenrikDev rejected the query (mode or size): see src/lib/henrik-client.ts" : "");
check("data is an array", Array.isArray(games), Array.isArray(games) ? `${games.length} matches` : "");
if (Array.isArray(games) && games[0]) {
  const m = games[0];
  check("metadata.match_id is a string", typeof has(m, "metadata.match_id") === "string");
  check("metadata.game_length_in_ms is a number", typeof has(m, "metadata.game_length_in_ms") === "number", String(has(m, "metadata.game_length_in_ms") ?? ""));
  check("teams[] have team_id and won", Array.isArray(m.teams) && m.teams.every((t) => t.team_id !== undefined && typeof t.won === "boolean"));
  const me = Array.isArray(m.players) ? m.players.find((p) => (puuid && p.puuid === puuid) || (String(p.name).toLowerCase() === name.toLowerCase() && String(p.tag).toLowerCase() === tag.toLowerCase())) : null;
  check("you are in players[] (matched by puuid, else by name and tag)", Boolean(me));
  check("your player has agent.id, agent.name and team_id", Boolean(me) && typeof me.agent?.id === "string" && typeof me.agent?.name === "string" && me.team_id !== undefined, me ? `${me.agent?.name}` : "");
  const inHistory = Array.isArray(list) && list.some((h) => h.match_id === m.metadata?.match_id);
  check("the newest match also appears in the RR history (they are joined on match_id)", inHistory, inHistory ? "" : "per-agent RR averages will be empty");
}

console.log(failed ? "\nSomething didn't match. Compare with https://docs.henrikdev.xyz and src/lib/henrik-normalize.ts and src/lib/matches.ts.\n" : "\nAll good: the shapes match what the app reads.\n");
process.exit(failed ? 1 : 0);
