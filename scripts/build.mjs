import { execSync } from "node:child_process";

if (process.env.NEXT_PRIVATE_STANDALONE === "true") {
  // Inside OpenNext: run actual Next.js build
  execSync("next build", { stdio: "inherit" });
} else {
  // Invoked directly by Cloudflare CI or local `npm run build`:
  // Run OpenNext adapter build, which will invoke `next build` with NEXT_PRIVATE_STANDALONE="true"
  execSync("npx opennextjs-cloudflare build", { stdio: "inherit" });
}
