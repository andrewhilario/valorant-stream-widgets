import { describe, expect, it } from "vitest";
import { DEFAULT_SITE_URL, resolveSiteAddress } from "./site-url";

const url = (configured: string | undefined, vercelHost?: string) => resolveSiteAddress(configured, vercelHost).url;

describe("resolveSiteAddress: what people actually type", () => {
  // These two are the values that used to crash every page with "Invalid URL".
  it("adds http:// to a local address, so `localhost:3000` works", () => {
    expect(url("localhost:3000")).toBe("http://localhost:3000");
    expect(url("127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(url("app.localhost:3000")).toBe("http://app.localhost:3000");
    expect(url("tally.test")).toBe("http://tally.test");
    expect(url("localhost")).toBe("http://localhost");
  });

  it("adds https:// to anything else, so a bare `tally.example` works", () => {
    expect(url("tally.example")).toBe("https://tally.example");
    expect(url("www.tally.example")).toBe("https://www.tally.example");
    expect(url("tally.example:8443")).toBe("https://tally.example:8443");
  });

  it("leaves a scheme that is there alone, including http", () => {
    expect(url("https://tally.example")).toBe("https://tally.example");
    expect(url("http://tally.example")).toBe("http://tally.example");
    expect(url("http://localhost:3000")).toBe("http://localhost:3000");
  });

  it("keeps only the origin: no trailing slash, path, query or fragment, and a lower-case host", () => {
    expect(url("https://tally.example/")).toBe("https://tally.example");
    expect(url("https://Tally.Example/some/page?x=1#top")).toBe("https://tally.example");
    expect(url("  https://tally.example  ")).toBe("https://tally.example");
    expect(url("tally.example/")).toBe("https://tally.example");
  });

  it("drops a port that is the scheme's default", () => {
    expect(url("https://tally.example:443")).toBe("https://tally.example");
    expect(url("http://tally.example:80")).toBe("http://tally.example");
  });
});

describe("resolveSiteAddress: not set, or not usable", () => {
  it("uses localhost when nothing is configured, and that isn't a problem", () => {
    for (const unset of [undefined, "", "   "]) {
      expect(resolveSiteAddress(unset)).toEqual({ url: DEFAULT_SITE_URL, problem: null });
    }
  });

  it("uses the host Vercel provides when nothing is configured", () => {
    expect(resolveSiteAddress(undefined, "tally.vercel.app")).toEqual({ url: "https://tally.vercel.app", problem: null });
    expect(resolveSiteAddress("", "tally.vercel.app").url).toBe("https://tally.vercel.app");
  });

  it("lets what was configured win over Vercel's host", () => {
    expect(url("https://tally.example", "tally.vercel.app")).toBe("https://tally.example");
  });

  it("falls back to localhost, and says why, instead of crashing, when the value isn't an address", () => {
    for (const junk of ["not a url!!", "https://", "ftp://tally.example", "http://", "://x", "javascript:alert(1)", "https://exa mple.com"]) {
      const result = resolveSiteAddress(junk);
      expect(result.url).toBe(DEFAULT_SITE_URL);
      expect(result.problem).toContain(junk);
    }
  });

  it("ignores an unusable Vercel host rather than crashing on it", () => {
    expect(resolveSiteAddress(undefined, "not a host!!").url).toBe(DEFAULT_SITE_URL);
  });
});

describe("whatever it is given, the result works as the base for the site's links", () => {
  it.each(["localhost:3000", "tally.example", "https://tally.example/", "nonsense!!", "", undefined])("%j", (input) => {
    const { url: base } = resolveSiteAddress(input);
    expect(() => new URL("/valorant-rank-calculator", base)).not.toThrow();
    expect(base.endsWith("/")).toBe(false);
  });
});
