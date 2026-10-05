import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Every page, the manifest and the social card images are prerendered at build time and never revalidated. Without a cache
// to read them from, the Worker draws them again on every request, and the manifest, the social cards and the home-screen
// icon fail there (they read tokens.css and a font from disk, which the Worker doesn't have). This cache serves what the
// build made, from the Worker's static assets.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
});
