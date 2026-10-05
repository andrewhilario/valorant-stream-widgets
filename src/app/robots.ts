import type { MetadataRoute } from "next";
import { TRAINING_CRAWLERS } from "@/config/crawlers";
import { absoluteUrl } from "@/lib/seo";

// Everything public is open to every crawler, search engines and AI assistants included. Three things are kept out: the widget
// pages, which are for OBS and the editor's preview (they also carry noindex, see next.config.ts); the event counter, which only
// the site's own pages post to; and the crawlers that collect pages to train AI models (src/config/crawlers.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/w/", "/api/"] },
      { userAgent: [...TRAINING_CRAWLERS], disallow: "/" },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
