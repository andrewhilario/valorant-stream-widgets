import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/seo";

// Everything public is open to every crawler, AI search ones included. The widget pages are for OBS and the
// editor's preview, not search, so they're kept out here and also carry noindex (see next.config.ts).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/w/"] },
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
