import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

if (process.env.NEXT_PRIVATE_STANDALONE === "true") {
  // Inside OpenNext: run actual Next.js build
  execSync("next build", { stdio: "inherit" });
} else {
  // Invoked directly by Cloudflare CI or local `npm run build`:
  // Run OpenNext adapter build, which will invoke `next build` with NEXT_PRIVATE_STANDALONE="true"
  execSync("npx opennextjs-cloudflare build", { stdio: "inherit" });

  // A deploy whose canonical links, sitemap and social cards all point at localhost is worse than no deploy, so a build that runs
  // on a build server refuses to finish if that is what it made (the previous deployment then stays live). It happens when
  // NEXT_PUBLIC_SITE_URL is missing and wrangler.jsonc has no `vars` to fall back on; see next.config.ts.
  if (process.env.CI || process.env.WORKERS_CI || process.env.VERCEL) {
    const home = join(process.cwd(), ".next", "server", "app", "index.html");
    if (existsSync(home) && /<link rel="canonical" href="http:\/\/localhost/.test(readFileSync(home, "utf8"))) {
      console.error(
        "\nThe pages were built for http://localhost:3000, so every canonical link, the sitemap and the social cards would point there.\n" +
          "Set NEXT_PUBLIC_SITE_URL (a build variable) or `vars.NEXT_PUBLIC_SITE_URL` in wrangler.jsonc to the public address.\n",
      );
      process.exit(1);
    }
  }

  // Put the prerendered pages, manifest and social cards where the Worker reads them from (see open-next.config.ts). Without this
  // step they are missing at runtime and the manifest, the social cards and the home-screen icon answer 500. `opennextjs-cloudflare
  // deploy` does it too; doing it here as well means a plain `wrangler deploy` after this build is enough.
  execSync("npx opennextjs-cloudflare populateCache local", { stdio: "inherit" });
}
