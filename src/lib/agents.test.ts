import { afterEach, describe, expect, it, vi } from "vitest";

const MEDIA = "https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95";

// Shaped after https://valorant-api.com/v1/agents?isPlayableCharacter=true. `displayIcon` and `displayIconSmall` are
// the same 1024 px, 400 to 570 KiB file; `minimapPortrait` is the 64 px, 6 KiB one.
const agent = (overrides: Record<string, unknown> = {}) => ({
  uuid: "add6443a-41bd-e414-f6ad-e58d267f4e95",
  displayName: "Jett",
  isPlayableCharacter: true,
  displayIcon: `${MEDIA}/displayicon.png`,
  displayIconSmall: `${MEDIA}/displayicon.png`,
  minimapPortrait: `${MEDIA}/minimapportrait.png`,
  killfeedPortrait: `${MEDIA}/killfeedportrait.png`,
  role: { displayName: "Duelist" },
  ...overrides,
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe("parseAgents", () => {
  it("reads id, name, icon and role, sorted by name", async () => {
    const { parseAgents } = await import("./agents");
    const out = parseAgents({
      data: [agent({ uuid: "b", displayName: "Sage", role: { displayName: "Sentinel" } }), agent({ uuid: "a", displayName: "Astra", role: { displayName: "Controller" } })],
    });
    expect(out.map((a) => a.name)).toEqual(["Astra", "Sage"]);
    expect(out[0]).toMatchObject({ id: "a", role: "Controller" });
  });

  it("drops non-playable entries and entries missing an id or a name", async () => {
    const { parseAgents } = await import("./agents");
    const out = parseAgents({
      data: [agent(), agent({ isPlayableCharacter: false, displayName: "Sova (Hunter's Fury)" }), agent({ uuid: undefined }), agent({ displayName: 5 }), null, "x"],
    });
    expect(out.map((a) => a.name)).toEqual(["Jett"]);
  });

  it("uses the small round portrait, never the 400 KiB-plus display icon", async () => {
    const { parseAgents } = await import("./agents");
    const [jett] = parseAgents({ data: [agent()] });
    expect(jett.icon).toBe(`${MEDIA}/minimapportrait.png`);
    expect(jett.icon).not.toMatch(/displayicon/i);
  });

  it("has no icon, rather than the big file, when the API has no small portrait", async () => {
    const { parseAgents } = await import("./agents");
    const out = parseAgents({ data: [agent({ minimapPortrait: undefined }), agent({ uuid: "b", minimapPortrait: null })] });
    expect(out.map((a) => a.icon)).toEqual([null, null]);
  });

  it("only trusts icons from valorant-api's own media host", async () => {
    const { parseAgents } = await import("./agents");
    const out = parseAgents({
      data: [
        agent({ uuid: "ok" }),
        agent({ uuid: "evil", minimapPortrait: "https://evil.example/minimapportrait.png" }),
        agent({ uuid: "lookalike", minimapPortrait: "https://media.valorant-api.com.evil.example/x.png" }),
        agent({ uuid: "insecure", minimapPortrait: "http://media.valorant-api.com/agents/x/minimapportrait.png" }),
        agent({ uuid: "none", minimapPortrait: null }),
      ],
    });
    expect(Object.fromEntries(out.map((a) => [a.id, a.icon !== null]))).toEqual({ ok: true, evil: false, lookalike: false, insecure: false, none: false });
  });

  it("returns an empty list for anything that isn't the expected shape", async () => {
    const { parseAgents } = await import("./agents");
    for (const junk of [null, undefined, "x", 3, {}, { data: null }, { data: {} }]) expect(parseAgents(junk)).toEqual([]);
  });
});

describe("fetchAgents", () => {
  it("fetches once per page load and shares the result", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ data: [agent()] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAgents } = await import("./agents");

    const [a, b] = await Promise.all([fetchAgents(), fetchAgents()]);
    expect(a).toHaveLength(1);
    expect(b).toBe(a);
    expect(await fetchAgents()).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("resolves to an empty list on failure, and tries again next time", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [agent()] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAgents } = await import("./agents");

    expect(await fetchAgents()).toEqual([]);
    expect(await fetchAgents()).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("treats an HTTP error as no agents, and doesn't remember it", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("nope", { status: 503 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [agent()] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const { fetchAgents } = await import("./agents");
    expect(await fetchAgents()).toEqual([]);
    expect(await fetchAgents()).toHaveLength(1);
  });
});
