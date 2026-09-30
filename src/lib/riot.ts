export const REGIONS = ["na", "eu", "ap", "kr"] as const;
export type Region = (typeof REGIONS)[number];

export const PLATFORMS = ["pc", "console"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type RiotId = { name: string; tag: string };

const TAG = /^[A-Za-z0-9]{3,5}$/;
// Riot IDs are free-form Unicode; only block what would break a URL path or
// smuggle control characters through.
const NAME_FORBIDDEN = /[\u0000-\u001f\u007f/\\?#%]/;

/** "Name#TAG" → { name, tag }, or null when it can't be a Riot ID. */
export function parseRiotId(input: string): RiotId | null {
  const raw = input.trim();
  const at = raw.lastIndexOf("#");
  if (at < 1) return null;

  const name = raw.slice(0, at).trim();
  const tag = raw.slice(at + 1).trim();

  const length = Array.from(name).length;
  if (length < 3 || length > 16) return null;
  if (NAME_FORBIDDEN.test(name)) return null;
  if (!TAG.test(tag)) return null;

  return { name, tag };
}

export function formatRiotId(id: RiotId): string {
  return `${id.name}#${id.tag}`;
}

export function isRegion(value: unknown): value is Region {
  return typeof value === "string" && (REGIONS as readonly string[]).includes(value);
}

export function isPlatform(value: unknown): value is Platform {
  return typeof value === "string" && (PLATFORMS as readonly string[]).includes(value);
}

/** Best-effort first guess from the browser's time zone. Only a default. */
export function guessRegion(timeZone: string | undefined): Region {
  if (!timeZone) return "na";
  if (timeZone === "Asia/Seoul") return "kr";
  if (timeZone.startsWith("Asia/") || timeZone.startsWith("Australia/") || timeZone.startsWith("Pacific/")) return "ap";
  if (timeZone.startsWith("Europe/") || timeZone.startsWith("Africa/")) return "eu";
  return "na";
}
