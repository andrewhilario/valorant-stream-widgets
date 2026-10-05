// Reads the site's anonymous counts from Cloudflare and prints a report: visits, how many finish a setup, how many copy
// their link, how many overlays open, what people pick, and how many click the Pro link.
//
//   PowerShell:  $env:CLOUDFLARE_ACCOUNT_ID = "…"; $env:CLOUDFLARE_API_TOKEN = "…"; npm run stats
//   bash:        CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… npm run stats
//
// The account ID is on the Cloudflare dashboard's Workers & Pages overview. The token needs one permission: Account, Account
// Analytics, Read (My Profile, API Tokens, Create Token). Both come from the environment, not the command line, so they stay out of
// shell history, and neither is ever printed. `npm run stats -- --json` prints the raw rows instead of the report.

import { QUERY, formatReport } from "../src/lib/stats.ts";

const account = process.env.CLOUDFLARE_ACCOUNT_ID?.trim();
const token = process.env.CLOUDFLARE_API_TOKEN?.trim();

if (!account || !token) {
  console.error("Usage: CLOUDFLARE_ACCOUNT_ID=… CLOUDFLARE_API_TOKEN=… npm run stats");
  console.error("The token needs Account > Account Analytics > Read. See the top of scripts/stats.mjs.");
  process.exit(1);
}

const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(account)}/analytics_engine/sql`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}` },
  body: QUERY,
});

const text = await response.text();
if (!response.ok) {
  console.error(`Cloudflare answered HTTP ${response.status}.`);
  console.error(text.slice(0, 600));
  if (response.status === 401 || response.status === 403) console.error("Check the token, and that it has Account Analytics: Read.");
  process.exit(1);
}

let rows;
try {
  rows = JSON.parse(text).data ?? [];
} catch {
  console.error("Cloudflare's answer wasn't JSON:");
  console.error(text.slice(0, 600));
  process.exit(1);
}

console.log(process.argv.includes("--json") ? JSON.stringify(rows, null, 2) : formatReport(rows));
