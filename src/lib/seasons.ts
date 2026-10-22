// The Act that is running now, from valorant-api.com's season list (public, no key, allows browser requests). Riot now names a year's
// seasons like "V26" with Acts "ACT I" to "ACT VI" (the older "Episode 9 · Act 3" is gone), so the words are taken as the list gives them.

import type { CurrentAct } from "./act-record";

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);

const ROMAN: Record<string, number> = { I: 1, V: 5, X: 10, L: 50 };

/** "VI" -> 6, "3" -> 3; null when it is neither. */
export function actNumber(word: string): number | null {
  const text = word.trim().toUpperCase();
  if (/^\d{1,2}$/.test(text)) return Number(text);
  if (!/^[IVXL]+$/.test(text)) return null;
  let total = 0;
  for (let i = 0; i < text.length; i++) {
    const here = ROMAN[text[i]];
    const next = ROMAN[text[i + 1]] ?? 0;
    total += here < next ? -here : here;
  }
  return total > 0 ? total : null;
}

/**
 * The Act whose dates include `now`, with its season's name in front ("V26 · ACT VI"). `short` is a guess at how HenrikDev writes it ("v26a6")
 * for matching when ids differ; the id is what is trusted first. Null when the list has no Act running.
 */
export function parseCurrentAct(json: unknown, now = Date.now()): CurrentAct | null {
  const list = isObj(json) && Array.isArray(json.data) ? json.data.filter(isObj) : [];
  const byId = new Map(list.map((s) => [str(s.uuid), s] as const));
  let best: { act: Obj; start: number } | null = null;
  for (const s of list) {
    if (!/::Act$/i.test(str(s.type) ?? "")) continue;
    const start = Date.parse(str(s.startTime) ?? "");
    const end = Date.parse(str(s.endTime) ?? "");
    if (Number.isNaN(start) || Number.isNaN(end) || now < start || now >= end) continue;
    if (!best || start > best.start) best = { act: s, start };
  }
  if (!best) return null;
  const id = str(best.act.uuid);
  const name = str(best.act.displayName);
  if (!id || !name) return null;
  const parent = byId.get(str(best.act.parentUuid)) ?? null;
  const parentName = parent ? str(parent.displayName) : null;
  const n = actNumber(name.replace(/^act\s+/i, ""));
  return {
    id: id.toLowerCase(),
    label: parentName ? `${parentName} · ${name}` : name,
    short: parentName && n ? `${parentName.toLowerCase().replace(/\s+/g, "")}a${n}` : null,
  };
}

const MAX_AGE_MS = 6 * 60 * 60 * 1000; // an Act changes about every two months; a stream can run for hours
let cached: { at: number; promise: Promise<CurrentAct | null> } | null = null;

/** Fetched once per page load, again after six hours. Null on failure (the header then shows no Act and the record is left out). */
export function fetchCurrentAct(now = Date.now()): Promise<CurrentAct | null> {
  if (cached && now - cached.at < MAX_AGE_MS) return cached.promise;
  const promise = fetch("https://valorant-api.com/v1/seasons")
    .then((res) => {
      if (!res.ok) throw new Error(`valorant-api answered ${res.status}`);
      return res.json();
    })
    .then((json) => parseCurrentAct(json, now))
    .catch(() => {
      if (cached?.promise === promise) cached = null;
      return null;
    });
  cached = { at: now, promise };
  return promise;
}

/** For tests: forget what was fetched. */
export function resetSeasonsCache() {
  cached = null;
}
