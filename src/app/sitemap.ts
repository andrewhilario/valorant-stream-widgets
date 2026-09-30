import type { MetadataRoute } from "next";
import { pageList } from "@/config/pages";
import { absoluteUrl } from "@/lib/seo";

// Every public page, straight from the page list. The widget pages under /w/ are for OBS and stay out.
// Only the two fields search engines actually read: the address and when the content last changed.
export default function sitemap(): MetadataRoute.Sitemap {
  return pageList.map((page) => ({
    url: absoluteUrl(page.path),
    lastModified: page.lastModified,
  }));
}
