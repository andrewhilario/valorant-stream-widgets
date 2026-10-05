import { describe, expect, it } from "vitest";
import { pageOf, referrerOf } from "./visit";

describe("pageOf", () => {
  it("names the site's pages by the ids in config/pages.ts, and everything else other", () => {
    expect(pageOf("/")).toBe("overlay");
    expect(pageOf("/valorant-rank-calculator")).toBe("rank");
    expect(pageOf("/valorant-rank-calculator/")).toBe("rank");
    expect(pageOf("/valorant-agent-mastery-calculator")).toBe("mastery");
    expect(pageOf("/w/valorant-rank")).toBe("other");
    expect(pageOf("/nowhere")).toBe("other");
  });
});

describe("referrerOf", () => {
  const from = (referrer: string, own = "valwidgets.live") => referrerOf(referrer, own);

  it("groups the places visits come from, and keeps nothing else about them", () => {
    expect(from("https://www.reddit.com/r/SideProject/comments/abc/post/")).toBe("reddit");
    expect(from("https://old.reddit.com/")).toBe("reddit");
    expect(from("https://redd.it/abc")).toBe("reddit");
    expect(from("https://www.tiktok.com/@someone")).toBe("tiktok");
    expect(from("https://vm.tiktok.com/abc")).toBe("tiktok");
    expect(from("https://www.google.com/")).toBe("search");
    expect(from("https://www.google.com.ph/")).toBe("search");
    expect(from("https://www.bing.com/search?q=valorant+overlay")).toBe("search");
    expect(from("https://duckduckgo.com/")).toBe("search");
    expect(from("https://search.brave.com/search?q=x")).toBe("search");
    expect(from("https://example.com/post")).toBe("other");
  });

  it("calls no referrer, an unreadable one and the site's own pages direct", () => {
    expect(from("")).toBe("direct");
    expect(from("not an address")).toBe("direct");
    expect(from("https://valwidgets.live/")).toBe("direct");
    expect(from("https://www.valwidgets.live/valorant-rank-calculator")).toBe("direct");
    expect(from("http://localhost:3010/x", "localhost:3010")).toBe("direct");
  });

  it("isn't fooled by a host that only ends or starts like a known one", () => {
    expect(from("https://notreddit.com/")).toBe("other");
    expect(from("https://reddit.com.example.org/")).toBe("other");
    expect(from("https://tiktok.example/")).toBe("other");
    expect(from("https://google.evil.example/")).toBe("other");
  });
});
