import { describe, expect, it } from "vitest";
import type { MatchSummary } from "@/lib/matches";
import { addMatches, countedList, isTracked, loadSession, saveSession, sessionKey, type Session, type StartPoint } from "./session";
import { calculateMatchMp, toMasteryMatches } from "./useMasteryData";

const MIN = 60_000;
const OPENED = Date.parse("2026-10-05T12:00:00Z");
const JETT = { id: "jett-id", name: "Jett" };
const REYNA = { id: "reyna-id", name: "Reyna" };
const tracked = { agentId: "jett-id", agentName: "Jett" };

/** A match that ENDED `endedMinutesFromOpen` minutes after the overlay opened (negative: before), lasting `length` minutes. */
function match(id: string, endedMinutesFromOpen: number, { length = 30, won = true, agent = JETT }: { length?: number; won?: boolean | null; agent?: typeof JETT } = {}): MatchSummary {
  const endedAt = OPENED + endedMinutesFromOpen * MIN;
  return { id, startedAt: endedAt - length * MIN, lengthMs: length * MIN, agent, won };
}

const fresh = (): Session => ({ openedAt: OPENED, matches: {} });

/** A stand-in for localStorage. */
function memoryStore(initial: Record<string, string> = {}) {
  const data = { ...initial };
  return { data, getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => void (data[k] = v) };
}

const start: StartPoint = { riotId: "Tester#1234", region: "na", platform: "pc", agentId: "jett-id", agentName: "Jett", currentLevel: 3, mpIntoLevel: 500 };

describe("which matches get added", () => {
  it("ignores matches that finished before the overlay was opened, even if they are listed late", () => {
    const { session, added } = addMatches(fresh(), [match("old1", -90), match("old2", -2), match("old3", -0.5)], tracked);
    expect(added).toBe(0);
    expect(countedList(session)).toEqual([]);
  });

  it("adds a match that finishes after the overlay was opened", () => {
    const { session, added } = addMatches(fresh(), [match("new1", 1.5, { length: 32 })], tracked);
    expect(added).toBe(1);
    expect(countedList(session)).toEqual([{ id: "new1", endedAt: OPENED + 1.5 * MIN, lengthMs: 32 * MIN, won: true }]);
  });

  it("adds the match that was still being played when the overlay opened", () => {
    // It started 20 minutes before the overlay opened and ended 12 minutes after.
    const { added } = addMatches(fresh(), [match("midgame", 12, { length: 32 })], tracked);
    expect(added).toBe(1);
  });

  it("counts a match once, however many times it is listed", () => {
    let s = fresh();
    for (let i = 0; i < 5; i++) s = addMatches(s, [match("a", 5)], tracked).session;
    expect(countedList(s)).toHaveLength(1);
    const again = addMatches(s, [match("a", 5)], tracked);
    expect(again.added).toBe(0);
    expect(again.session).toBe(s);
  });

  it("only counts the agent being tracked", () => {
    const { session } = addMatches(fresh(), [match("a", 5), match("b", 40, { agent: REYNA })], tracked);
    expect(countedList(session).map((m) => m.id)).toEqual(["a"]);
  });

  it("finds the agent by name when no agent id is set, and counts everything when neither is set", () => {
    const matches = [match("a", 5), match("b", 40, { agent: REYNA })];
    expect(addMatches(fresh(), matches, { agentId: "", agentName: "reyna" }).added).toBe(1);
    expect(addMatches(fresh(), matches, { agentId: "", agentName: "" }).added).toBe(2);
    expect(isTracked(match("x", 1), { agentId: "other-id", agentName: "Jett" })).toBe(false);
  });

  it("skips a match with no start time, since there is no telling whether it is new", () => {
    const noStart: MatchSummary = { ...match("a", 5), startedAt: null };
    expect(addMatches(fresh(), [noStart], tracked).added).toBe(0);
  });

  it("counts a match whose result is unknown as a loss (it still earned the base MP)", () => {
    const { session } = addMatches(fresh(), [match("a", 5, { won: null })], tracked);
    expect(countedList(session)[0].won).toBe(false);
  });
});

describe("a long stream", () => {
  it("keeps every match counted when HenrikDev's list of ten moves on (the total never goes down)", () => {
    // Twelve matches finish one after another; each look at HenrikDev shows only the latest ten.
    const all = Array.from({ length: 12 }, (_, i) => match(`m${i + 1}`, 35 * (i + 1)));
    let s = fresh();
    let previousTotal = 0;
    for (let seen = 1; seen <= all.length; seen++) {
      const listed = all.slice(Math.max(0, seen - 10), seen).reverse(); // the ten most recent so far
      s = addMatches(s, listed, tracked).session;
      const total = toMasteryMatches(s, 0).reduce((sum, m) => sum + m.mpEarned, 0);
      expect(total).toBeGreaterThanOrEqual(previousTotal);
      previousTotal = total;
    }
    expect(countedList(s)).toHaveLength(12);
  });
});

describe("remembering a count", () => {
  it("keeps the total across a reload and does not add anything twice", () => {
    const store = memoryStore();
    const key = sessionKey(start);

    const first = loadSession(store, key, OPENED);
    expect(first.openedAt).toBe(OPENED);
    const withMatch = addMatches(first, [match("a", 5)], tracked).session;
    saveSession(store, key, withMatch);

    // The page is reloaded a while later: same start point, so the same count comes back, with its original opening time.
    const reloaded = loadSession(store, key, OPENED + 30 * MIN);
    expect(reloaded.openedAt).toBe(OPENED);
    expect(countedList(reloaded).map((m) => m.id)).toEqual(["a"]);
    expect(addMatches(reloaded, [match("a", 5)], tracked).added).toBe(0);
  });

  it("starts a new count when the starting numbers, the agent or the account change", () => {
    const base = sessionKey(start);
    expect(sessionKey({ ...start, mpIntoLevel: 600 })).not.toBe(base);
    expect(sessionKey({ ...start, currentLevel: 4 })).not.toBe(base);
    expect(sessionKey({ ...start, agentId: "reyna-id", agentName: "Reyna" })).not.toBe(base);
    expect(sessionKey({ ...start, riotId: "Someone#9999" })).not.toBe(base);
    expect(sessionKey({ ...start, region: "eu" })).not.toBe(base);
    // Spelling of the Riot ID doesn't matter.
    expect(sessionKey({ ...start, riotId: "  tester#1234 " })).toBe(base);
  });

  it("is not affected by the target level or the bonus, which are not part of the starting point", () => {
    // They are not fields of StartPoint at all, so they cannot move the key; this documents the intent.
    expect(Object.keys(start)).not.toContain("targetLevel");
    expect(Object.keys(start)).not.toContain("bonusPct");
    expect(Object.keys(start)).not.toContain("apiKey");
  });

  it("never puts the API key in the storage key or the saved count", () => {
    const store = memoryStore();
    const key = sessionKey(start);
    saveSession(store, key, addMatches(loadSession(store, key, OPENED), [match("a", 5)], tracked).session);
    expect(key).not.toMatch(/HDEV/i);
    expect(JSON.stringify(store.data)).not.toMatch(/HDEV/i);
  });

  it("starts fresh when what is stored is broken, and when there is no storage at all", () => {
    expect(loadSession(memoryStore({ [sessionKey(start)]: "not json" }), sessionKey(start), OPENED).openedAt).toBe(OPENED);
    expect(loadSession(memoryStore({ [sessionKey(start)]: JSON.stringify({ openedAt: "x" }) }), sessionKey(start), OPENED).matches).toEqual({});
    expect(loadSession(null, sessionKey(start), OPENED)).toEqual({ openedAt: OPENED, matches: {} });
    const broken = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(loadSession(broken, sessionKey(start), OPENED).openedAt).toBe(OPENED);
    expect(() => saveSession(broken, sessionKey(start), fresh())).not.toThrow();
  });

  it("drops bad entries from a stored count but keeps the good ones", () => {
    const key = sessionKey(start);
    const stored = {
      openedAt: OPENED,
      matches: { good: { endedAt: OPENED + MIN, lengthMs: 30 * MIN, won: true }, bad: { endedAt: "x" }, worse: 5 },
    };
    expect(countedList(loadSession(memoryStore({ [key]: JSON.stringify(stored) }), key, OPENED)).map((m) => m.id)).toEqual(["good"]);
  });
});

describe("the MP a counted match is worth", () => {
  it("is worked out when shown, so changing the bonus changes it", () => {
    const { session } = addMatches(fresh(), [match("a", 5, { length: 30, won: true })], tracked);
    const [plain] = toMasteryMatches(session, 0);
    const [boosted] = toMasteryMatches(session, 10);
    expect(plain.mpEarned).toBe(calculateMatchMp(30 * MIN, true, 0));
    expect(boosted.mpEarned).toBe(calculateMatchMp(30 * MIN, true, 10));
    expect(boosted.mpEarned).toBeGreaterThan(plain.mpEarned);
    expect(plain.durationMinutes).toBe(30);
  });
});
