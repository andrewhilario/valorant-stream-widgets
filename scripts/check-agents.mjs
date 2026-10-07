// Does the Mastery overlay's agent picker list every playable agent?
//
// The picker has a fixed list (VALORANT_AGENTS in src/widgets/valorant-mastery/definition.ts) because the editor and the check that
// reads a link both need it at once, so a new agent has to be added there by hand. This compares that list with valorant-api.com,
// the same source the portraits come from, and says what is missing. Run it when Riot releases an agent:
//
//   npm run check:agents

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const file = fileURLToPath(new URL("../src/widgets/valorant-mastery/definition.ts", import.meta.url));
const block = /export const VALORANT_AGENTS = \[([\s\S]*?)\];/.exec(readFileSync(file, "utf8"));
if (!block) throw new Error("Couldn't find VALORANT_AGENTS in definition.ts");
const listed = [...block[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);

const response = await fetch("https://valorant-api.com/v1/agents?isPlayableCharacter=true");
if (!response.ok) throw new Error(`valorant-api.com answered ${response.status}`);
const live = (await response.json()).data.map((agent) => agent.displayName);

const missing = live.filter((name) => !listed.includes(name)).sort();
const extra = listed.filter((name) => !live.includes(name)).sort();

console.log(`The game has ${live.length} playable agents; the picker lists ${listed.length}.`);
if (missing.length) console.log(`Missing from the picker (add them to VALORANT_AGENTS): ${missing.join(", ")}`);
if (extra.length) console.log(`In the picker but not in the game's list (renamed, or removed?): ${extra.join(", ")}`);
if (!missing.length && !extra.length) console.log("They match.");
process.exit(missing.length ? 1 : 0);
