// Official rank badge art from valorant-api.com: public, no key, allows browser
// requests. Latest season wins. Badge art is decoration; callers fall back to a
// drawn glyph when this returns nothing.

const ICON_HOST = "https://media.valorant-api.com/";

type TiersResponse = { data?: Array<{ tiers?: Array<{ tier?: unknown; largeIcon?: unknown }> }> };

/** Tier id → icon URL. Only URLs on valorant-api's media host are accepted. */
export function parseTierIcons(json: unknown): Record<string, string> {
  const seasons = Array.isArray((json as TiersResponse)?.data) ? (json as TiersResponse).data! : [];
  const tiers = seasons[seasons.length - 1]?.tiers ?? [];

  const icons: Record<string, string> = {};
  for (const t of tiers) {
    if (typeof t.tier === "number" && typeof t.largeIcon === "string" && t.largeIcon.startsWith(ICON_HOST)) {
      icons[String(t.tier)] = t.largeIcon;
    }
  }
  return icons;
}

export async function fetchTierIcons(): Promise<Record<string, string>> {
  const res = await fetch("https://valorant-api.com/v1/competitivetiers");
  if (!res.ok) throw new Error(`tier icons: ${res.status}`);
  return parseTierIcons(await res.json());
}
