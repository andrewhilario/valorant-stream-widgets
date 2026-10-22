import { afterEach, describe, expect, it, vi } from "vitest";
import { actNumber, fetchCurrentAct, parseCurrentAct, resetSeasonsCache } from "./seasons";

// Entries as valorant-api.com/v1/seasons gives them (read 2026-10-22): a year's season ("V26", no type) and its Acts.
const V26 = "3737c391-497a-6e82-aeb5-cc9f701f72e2";
const list = {
  data: [
    { uuid: V26, type: null, displayName: "V26", startTime: "2026-06-24T00:00:00Z", endTime: "2027-01-06T00:00:00Z", parentUuid: null },
    { uuid: "4f0864e2-40af-28a4-de2c-0e9e64e75f23", type: "EAresSeasonType::Act", displayName: "ACT IV", startTime: "2026-06-24T00:00:00Z", endTime: "2026-08-19T00:00:00Z", parentUuid: V26 },
    { uuid: "8102cd81-43a0-d0d7-bd59-47b8fe9bed1b", type: "EAresSeasonType::Act", displayName: "ACT V", startTime: "2026-08-19T00:00:00Z", endTime: "2026-10-14T00:00:00Z", parentUuid: V26 },
    { uuid: "d816f426-48ea-f052-117f-9697a155b319", type: "EAresSeasonType::Act", displayName: "ACT VI", startTime: "2026-10-14T00:00:00Z", endTime: "2027-01-06T00:00:00Z", parentUuid: V26 },
  ],
};

describe("actNumber", () => {
  it("reads Roman numerals and plain numbers, and nothing else", () => {
    expect([actNumber("I"), actNumber("IV"), actNumber("VI"), actNumber("IX"), actNumber("12"), actNumber(" iii ")]).toEqual([1, 4, 6, 9, 12, 3]);
    expect(actNumber("")).toBeNull();
    expect(actNumber("Act")).toBeNull();
  });
});

describe("parseCurrentAct", () => {
  it("is the Act whose dates include now, with its season's name in front", () => {
    expect(parseCurrentAct(list, Date.parse("2026-10-22T12:00:00Z"))).toEqual({ id: "d816f426-48ea-f052-117f-9697a155b319", label: "V26 · ACT VI", short: "v26a6" });
    expect(parseCurrentAct(list, Date.parse("2026-09-01T00:00:00Z"))?.label).toBe("V26 · ACT V");
  });

  it("switches at the instant an Act starts, and is null when no Act is running", () => {
    expect(parseCurrentAct(list, Date.parse("2026-10-14T00:00:00Z"))?.label).toBe("V26 · ACT VI");
    expect(parseCurrentAct(list, Date.parse("2026-10-13T23:59:59Z"))?.label).toBe("V26 · ACT V");
    expect(parseCurrentAct(list, Date.parse("2028-01-01T00:00:00Z"))).toBeNull();
  });

  it("uses just the Act's name when it has no season, and survives junk", () => {
    const lone = { data: [{ uuid: "a1", type: "EAresSeasonType::Act", displayName: "ACT II", startTime: "2020-01-01T00:00:00Z", endTime: "2030-01-01T00:00:00Z", parentUuid: null }] };
    expect(parseCurrentAct(lone, Date.parse("2026-01-01T00:00:00Z"))).toEqual({ id: "a1", label: "ACT II", short: null });
    for (const junk of [null, "x", {}, { data: "no" }, { data: [null, 3, { uuid: 1 }] }]) expect(parseCurrentAct(junk)).toBeNull();
  });
});

describe("fetchCurrentAct", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    resetSeasonsCache();
  });

  it("asks once, and keeps the answer", async () => {
    const fn = vi.fn(async () => new Response(JSON.stringify(list), { status: 200 }));
    vi.stubGlobal("fetch", fn);
    const now = Date.parse("2026-10-22T12:00:00Z");
    expect((await fetchCurrentAct(now))?.label).toBe("V26 · ACT VI");
    expect((await fetchCurrentAct(now + 60_000))?.label).toBe("V26 · ACT VI");
    expect(fn).toHaveBeenCalledTimes(1);
    expect(String((fn.mock.calls as unknown as Array<[string]>)[0][0])).toBe("https://valorant-api.com/v1/seasons");
  });

  it("is null when the list cannot be had, and tries again next time", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("no", { status: 500 })));
    expect(await fetchCurrentAct()).toBeNull();
    const ok = vi.fn(async () => new Response(JSON.stringify(list), { status: 200 }));
    vi.stubGlobal("fetch", ok);
    expect((await fetchCurrentAct(Date.parse("2026-10-22T12:00:00Z")))?.label).toBe("V26 · ACT VI");
    expect(ok).toHaveBeenCalledTimes(1);
  });
});
