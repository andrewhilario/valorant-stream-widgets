import { execSync } from "node:child_process";

if (process.env.NEXT_PRIVATE_STANDALONE === "true") {
  // Inside OpenNext: run actual Next.js build
  execSync("next build", { stdio: "inherit" });
} else {
  // Invoked directly by Cloudflare CI or local `npm run build`:
  // Run OpenNext adapter build, which will invoke `next build` with NEXT_PRIVATE_STANDALONE="true"
  execSync("npx opennextjs-cloudflare build", { stdio: "inherit" });

  // Put the prerendered pages, manifest and social cards where the Worker reads them from (see open-next.config.ts). Without this
  // step they are missing at runtime and the manifest, the social cards and the home-screen icon answer 500. `opennextjs-cloudflare
  // deploy` does it too; doing it here as well means a plain `wrangler deploy` after this build is enough.
  execSync("npx opennextjs-cloudflare populateCache local", { stdio: "inherit" });
}
