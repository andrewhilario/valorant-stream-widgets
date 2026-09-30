// Valorant competitive tiers. Ids follow Riot's numbering:
// 0 unrated · 3–5 Iron · 6–8 Bronze · 9–11 Silver · 12–14 Gold ·
// 15–17 Platinum · 18–20 Diamond · 21–23 Ascendant · 24–26 Immortal · 27 Radiant.

export type TierFamily =
  | "unrated"
  | "iron"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "ascendant"
  | "immortal"
  | "radiant";

const FAMILIES: Array<{ family: TierFamily; label: string; first: number }> = [
  { family: "iron", label: "Iron", first: 3 },
  { family: "bronze", label: "Bronze", first: 6 },
  { family: "silver", label: "Silver", first: 9 },
  { family: "gold", label: "Gold", first: 12 },
  { family: "platinum", label: "Platinum", first: 15 },
  { family: "diamond", label: "Diamond", first: 18 },
  { family: "ascendant", label: "Ascendant", first: 21 },
  { family: "immortal", label: "Immortal", first: 24 },
];

export const RADIANT = 27;

export function tierFamily(id: number): TierFamily {
  if (id >= RADIANT) return "radiant";
  if (id < 3) return "unrated";
  for (let i = FAMILIES.length - 1; i >= 0; i--) {
    if (id >= FAMILIES[i].first) return FAMILIES[i].family;
  }
  return "unrated";
}

/** 1–3 within a family, 0 for Unrated and Radiant. */
export function tierStep(id: number): 0 | 1 | 2 | 3 {
  if (id < 3 || id >= RADIANT) return 0;
  const family = FAMILIES.find((f) => f.family === tierFamily(id));
  return family ? ((id - family.first + 1) as 1 | 2 | 3) : 0;
}

export function tierName(id: number): string {
  if (id >= RADIANT) return "Radiant";
  if (id < 3) return "Unrated";
  const family = FAMILIES.find((f) => f.family === tierFamily(id));
  return family ? `${family.label} ${tierStep(id)}` : "Unrated";
}

export type Progress =
  | { kind: "bar"; rr: number; toNext: number; next: string }
  | { kind: "open" } // Immortal and up: RR has no 100-point ceiling
  | { kind: "none" }; // Unrated, or nothing sensible to show

/** Progress toward the next rank. Iron 1 through Ascendant 3 are 100 RR per step. */
export function progressFor(tierId: number, rr: number): Progress {
  if (tierId < 3) return { kind: "none" };
  if (tierId >= 24) return { kind: "open" };
  const clamped = Math.min(100, Math.max(0, Math.round(rr)));
  return { kind: "bar", rr: clamped, toNext: 100 - clamped, next: tierName(tierId + 1) };
}
