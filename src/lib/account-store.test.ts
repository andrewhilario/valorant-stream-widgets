import { describe, expect, it } from "vitest";
import { EDITOR_STORAGE_KEY, loadAccount, saveAccount, type Account } from "./account-store";

const KEY = "HDEV-00000000-1111-2222-3333-444444444444";

function memory(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    raw: () => data.get(EDITOR_STORAGE_KEY),
  };
}

const account: Account = { riotId: "Night Owl#und3d", region: "eu", platform: "pc", key: KEY };

describe("account store", () => {
  it("shares the editor's storage entry", () => {
    expect(EDITOR_STORAGE_KEY).toBe("tally:valorant-rank:v1");
  });

  it("reads the four fields from what the editor saved", () => {
    const storage = memory({
      [EDITOR_STORAGE_KEY]: JSON.stringify({ riotId: "Night Owl#und3d", region: "eu", platform: "console", apiKey: KEY, layout: "strip" }),
    });
    expect(loadAccount("na", storage)).toEqual({ riotId: "Night Owl#und3d", region: "eu", platform: "console", key: KEY });
  });

  it("returns null when nothing has been saved, or storage is unavailable", () => {
    expect(loadAccount("na", memory())).toBeNull();
    expect(loadAccount("na", null)).toBeNull();
  });

  it("returns null for a corrupt or non-object entry instead of throwing", () => {
    expect(loadAccount("na", memory({ [EDITOR_STORAGE_KEY]: "{not json" }))).toBeNull();
    expect(loadAccount("na", memory({ [EDITOR_STORAGE_KEY]: "[1,2]" }))).toBeNull();
    expect(loadAccount("na", memory({ [EDITOR_STORAGE_KEY]: '"text"' }))).toBeNull();
  });

  it("replaces unusable values with safe ones", () => {
    const storage = memory({
      [EDITOR_STORAGE_KEY]: JSON.stringify({ riotId: 5, region: "mars", platform: "toaster", apiKey: { x: 1 } }),
    });
    expect(loadAccount("ap", storage)).toEqual({ riotId: "", region: "ap", platform: "pc", key: "" });
  });

  it("strips control characters and caps lengths", () => {
    const storage = memory({
      [EDITOR_STORAGE_KEY]: JSON.stringify({ riotId: `a\u0000b${"x".repeat(40)}`, apiKey: `  ${KEY}\n` }),
    });
    const loaded = loadAccount("na", storage);
    expect(loaded?.riotId).toHaveLength(24);
    expect(loaded?.riotId.startsWith("abxxx")).toBe(true);
    expect(loaded?.key).toBe(KEY);
  });

  it("writes into the editor's entry and keeps its other settings", () => {
    const storage = memory({ [EDITOR_STORAGE_KEY]: JSON.stringify({ layout: "strip", scale: 120, riotId: "Old#0000", apiKey: "" }) });
    expect(saveAccount(account, storage)).toBe(true);
    expect(JSON.parse(storage.raw()!)).toEqual({
      layout: "strip",
      scale: 120,
      riotId: "Night Owl#und3d",
      region: "eu",
      platform: "pc",
      apiKey: KEY,
    });
  });

  it("creates the entry when there is none, and what it writes loads back the same", () => {
    const storage = memory();
    expect(saveAccount(account, storage)).toBe(true);
    expect(loadAccount("na", storage)).toEqual(account);
  });

  it("starts over when the existing entry is corrupt", () => {
    const storage = memory({ [EDITOR_STORAGE_KEY]: "{oops" });
    expect(saveAccount(account, storage)).toBe(true);
    expect(loadAccount("na", storage)).toEqual(account);
  });

  it("reports failure when storage is unavailable or full", () => {
    expect(saveAccount(account, null)).toBe(false);
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(saveAccount(account, full)).toBe(false);
  });
});
