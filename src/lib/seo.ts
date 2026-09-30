import type { Metadata } from "next";
import { site } from "@/config/site";
import type { PageMeta } from "@/config/pages";

/**
 * A full address for a path on this site. The home page has no trailing slash, because Next prints it that way in
 * its own canonical and social tags, and the sitemap and structured data have to spell it identically.
 */
export function absoluteUrl(path: string): string {
  const url = new URL(path, site.url).toString();
  return path === "/" ? url.replace(/\/$/, "") : url;
}

/**
 * Title, description, canonical and social tags for one page. The canonical is always the clean path, never a
 * ?settings variant, and it is spelled exactly as the sitemap and structured data spell it (from absoluteUrl).
 */
export function pageMetadata(page: PageMeta): Metadata {
  const url = absoluteUrl(page.path);
  return {
    title: { absolute: page.title },
    description: page.description,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      siteName: site.name,
      locale: "en_US",
      url,
      title: page.title,
      description: page.description,
    },
    twitter: { card: "summary_large_image", title: page.title, description: page.description },
  };
}

type Json = Record<string, unknown>;

/** A free web tool. No ratings and no review counts: nothing here is made up. */
export function webApplicationLd(page: PageMeta, extra: Json = {}): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: page.h1,
    url: absoluteUrl(page.path),
    description: page.description,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Any (runs in a web browser)",
    inLanguage: "en",
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    dateModified: page.lastModified,
    ...extra,
  };
}

export function faqLd(items: Array<{ q: string; a: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}

export function breadcrumbLd(trail: Array<{ name: string; path: string }>): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((step, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: step.name,
      item: absoluteUrl(step.path),
    })),
  };
}

/** Safe to drop inside a <script> tag: a "<" in any string can't close it. */
export function serializeLd(data: Json | Json[]): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
