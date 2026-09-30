// The one Valorant account this browser remembers. The overlay editor keeps it with its other saved
// settings, and the calculators read and write the same four fields in that entry, so a streamer
// enters their Riot ID and key once for every tool. Nothing here leaves the browser.

import { WIDGET_ID } from "@/widgets/valorant-rank/definition";
import { isPlatform, isRegion, type Platform, type Region } from "./riot";
import { widgetStorageKey } from "./storage-keys";

export type Account = { riotId: string; region: Region; platform: Platform; key: string };

export const EDITOR_STORAGE_KEY = widgetStorageKey(WIDGET_ID);

type StorageLike = Pick<Storage, "getItem" | "setItem">;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/g;
const text = (value: unknown, max: number) => (typeof value === "string" ? value.replace(CONTROL_CHARS, "").slice(0, max) : "");

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    // Storage can be blocked outright.
    return null;
  }
}

function readEntry(storage: StorageLike): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(EDITOR_STORAGE_KEY) ?? "null");
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** What the editor has saved, or null when nothing has been saved yet or storage is unavailable. */
export function loadAccount(fallbackRegion: Region = "na", storage: StorageLike | null = browserStorage()): Account | null {
  if (!storage) return null;
  const entry = readEntry(storage);
  if (!entry) return null;

  return {
    riotId: text(entry.riotId, 24),
    region: isRegion(entry.region) ? entry.region : fallbackRegion,
    platform: isPlatform(entry.platform) ? entry.platform : "pc",
    key: text(entry.apiKey, 64).trim(),
  };
}

/**
 * Writes the four account fields into the editor's saved entry, leaving its other settings alone. The
 * editor fills anything missing with its defaults when it next loads, so this is safe to call first.
 */
export function saveAccount(account: Account, storage: StorageLike | null = browserStorage()): boolean {
  if (!storage) return false;
  try {
    const next = { ...readEntry(storage), riotId: account.riotId, region: account.region, platform: account.platform, apiKey: account.key };
    storage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}
