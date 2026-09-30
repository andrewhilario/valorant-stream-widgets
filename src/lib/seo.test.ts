import { describe, expect, it } from "vitest";
import { pageList, pages } from "@/config/pages";
import { absoluteUrl, breadcrumbLd, faqLd, pageMetadata, serializeLd, webApplicationLd } from "./seo";

describe("the page list", () => {
  it("has one entry per page, with clean, unique, lowercase paths", () => {
    expect(new Set(pageList.map((p) => p.id)).size).toBe(pageList.length);
    expect(new Set(pageList.map((p) => p.path)).size).toBe(pageList.length);
    for (const page of pageList) expect(page.path).toMatch(/^\/([a-z0-9]+(-[a-z0-9]+)*)?$/);
  });

  it.each(pageList.map((p) => [p.id, p] as const))("%s: title is 50–60 characters and ends with the brand", (_id, page) => {
    expect(page.title.length).toBeGreaterThanOrEqual(50);
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(page.title.endsWith("| Tally")).toBe(true);
  });

  it.each(pageList.map((p) => [p.id, p] as const))("%s: description is 150–160 characters", (_id, page) => {
    expect(page.description.length).toBeGreaterThanOrEqual(150);
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it("never repeats a title, description or heading across pages", () => {
    for (const key of ["title", "description", "h1", "navLabel"] as const) {
      expect(new Set(pageList.map((p) => p[key])).size).toBe(pageList.length);
    }
  });

  it("puts the page's own subject first in the title", () => {
    expect(pages.rank.title.toLowerCase().startsWith("valorant rank calculator")).toBe(true);
    expect(pages.mastery.title.toLowerCase().startsWith("valorant agent mastery calculator")).toBe(true);
  });

  it("dates changes in ISO form", () => {
    for (const page of pageList) expect(Number.isNaN(Date.parse(page.lastModified))).toBe(false);
  });
});

describe("pageMetadata", () => {
  it("spells the canonical and the social URL exactly as the sitemap does", () => {
    for (const page of pageList) {
      const meta = pageMetadata(page);
      expect(meta.alternates?.canonical).toBe(absoluteUrl(page.path));
      expect(meta.openGraph?.url).toBe(absoluteUrl(page.path));
    }
  });

  it("uses the page's title as written, without the layout adding a second brand", () => {
    expect(pageMetadata(pages.rank).title).toEqual({ absolute: pages.rank.title });
  });

  it("asks for a large social card and repeats the title and description there", () => {
    const meta = pageMetadata(pages.mastery);
    expect(meta.twitter).toMatchObject({ card: "summary_large_image", title: pages.mastery.title, description: pages.mastery.description });
    expect(meta.openGraph).toMatchObject({ title: pages.mastery.title, description: pages.mastery.description, siteName: "Tally" });
  });

  it("leaves the image to the opengraph-image files, which take priority over anything set here", () => {
    const meta = pageMetadata(pages.overlay);
    expect(meta.openGraph).not.toHaveProperty("images");
    expect(meta.twitter).not.toHaveProperty("images");
  });
});

describe("absoluteUrl", () => {
  it("puts paths under the site address", () => {
    expect(absoluteUrl("/valorant-rank-calculator")).toMatch(/^https?:\/\/[^/]+\/valorant-rank-calculator$/);
  });

  it("writes the home page without a trailing slash, as Next does in its own tags", () => {
    expect(absoluteUrl("/")).toMatch(/^https?:\/\/[^/]+$/);
  });
});

describe("structured data", () => {
  it("describes a free web app without inventing ratings or reviews", () => {
    const app = webApplicationLd(pages.rank);
    expect(app["@type"]).toBe("WebApplication");
    expect(app.url).toBe(absoluteUrl(pages.rank.path));
    expect(app.isAccessibleForFree).toBe(true);
    expect(app.offers).toMatchObject({ price: "0", priceCurrency: "USD" });
    expect(app.dateModified).toBe(pages.rank.lastModified);
    expect(app).not.toHaveProperty("aggregateRating");
    expect(app).not.toHaveProperty("review");
  });

  it("lets a page add its own fields without losing the basics", () => {
    const app = webApplicationLd(pages.mastery, { featureList: ["a", "b"] });
    expect(app.featureList).toEqual(["a", "b"]);
    expect(app.name).toBe(pages.mastery.h1);
  });

  it("builds a FAQPage from question and answer pairs", () => {
    const faq = faqLd([
      { q: "One?", a: "Yes." },
      { q: "Two?", a: "No." },
    ]) as { mainEntity: Array<{ name: string; acceptedAnswer: { text: string } }> };
    expect(faq["@type" as never]).toBe("FAQPage");
    expect(faq.mainEntity.map((e) => e.name)).toEqual(["One?", "Two?"]);
    expect(faq.mainEntity[1].acceptedAnswer.text).toBe("No.");
  });

  it("numbers a breadcrumb trail from 1 with absolute URLs", () => {
    const trail = breadcrumbLd([
      { name: "Tally", path: "/" },
      { name: "Rank calculator", path: "/valorant-rank-calculator" },
    ]) as { itemListElement: Array<{ position: number; item: string; name: string }> };
    expect(trail.itemListElement.map((i) => i.position)).toEqual([1, 2]);
    expect(trail.itemListElement[1].item).toBe(absoluteUrl("/valorant-rank-calculator"));
  });
});

describe("serializeLd", () => {
  it("cannot be used to close the script tag it sits in", () => {
    const text = serializeLd({ name: "</script><script>alert(1)</script>" });
    expect(text).not.toContain("<");
    expect(text).toContain("\\u003c/script>");
  });

  it("still parses back to the same data", () => {
    const data = { "@type": "Thing", name: "a < b & c > d", list: [1, 2, { x: "<y>" }] };
    expect(JSON.parse(serializeLd(data))).toEqual(data);
  });
});
