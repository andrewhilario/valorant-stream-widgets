// Audits the built site the way a crawler sees it: titles, descriptions, canonical links, social tags,
// structured data, headings, links, the sitemap and robots rules. It reads the prerendered HTML in .next,
// so no server needs to be running.
//
//   npm run build && npm run check:seo
//
// Exits 1 if anything fails. Warnings (for example, a missing public address) don't fail the run.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const APP = join(process.cwd(), ".next", "server", "app");
const SITE = (process.env.NEXT_PUBLIC_SITE_URL?.trim() || "http://localhost:3000").replace(/\/+$/, "");

const failures = [];
const warnings = [];
let passed = 0;

const pass = () => void passed++;
const fail = (where, message) => failures.push(`${where}: ${message}`);
const warn = (where, message) => warnings.push(`${where}: ${message}`);
const check = (condition, where, message) => (condition ? pass() : fail(where, message));

// ── A small, tolerant reader for React's HTML ────────────────────────────────

const decode = (s) =>
  s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function attrs(source) {
  const out = {};
  for (const m of source.matchAll(/([:\w-]+)(?:="([^"]*)")?/g)) out[m[1].toLowerCase()] = m[2] === undefined ? "" : decode(m[2]);
  return out;
}

const tags = (html, name) => [...html.matchAll(new RegExp(`<${name}\\b([^>]*?)/?>`, "gi"))].map((m) => attrs(m[1]));
const meta = (html, key, value) => tags(html, "meta").filter((t) => t[key] === value);
const metaContent = (html, key, value) => meta(html, key, value).map((t) => t.content ?? "");
const textOf = (fragment) => decode(fragment.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
const all = (html, re) => [...html.matchAll(re)];

function read(file) {
  const path = join(APP, file);
  return existsSync(path) ? readFileSync(path, "utf8") : null;
}

// ── Which pages to audit: whatever the sitemap lists ─────────────────────────

const sitemap = read("sitemap.xml.body");
if (!sitemap) {
  console.error("No build found. Run `npm run build` first.");
  process.exit(1);
}

const urls = all(sitemap, /<loc>([^<]+)<\/loc>/g).map((m) => decode(m[1]));
const pagePath = (url) => new URL(url).pathname;
const fileFor = (path) => (path === "/" ? "index.html" : `${path.slice(1)}.html`);

check(urls.length >= 3, "sitemap.xml", `expected at least 3 URLs, found ${urls.length}`);
check(new Set(urls).size === urls.length, "sitemap.xml", "lists the same URL twice");
for (const [i, m] of all(sitemap, /<lastmod>([^<]+)<\/lastmod>/g).entries()) {
  check(/^\d{4}-\d{2}-\d{2}/.test(m[1]) && !Number.isNaN(Date.parse(m[1])), "sitemap.xml", `lastmod #${i + 1} isn't a valid date: ${m[1]}`);
}
for (const url of urls) check(url.startsWith(`${SITE}/`) || url === SITE, "sitemap.xml", `${url} doesn't start with ${SITE}`);
if (SITE.startsWith("http://localhost")) {
  warn("site address", "NEXT_PUBLIC_SITE_URL isn't set, so canonical links and the sitemap point at localhost. Set it before deploying.");
}

const robots = read("robots.txt.body") ?? "";
check(/^Disallow:\s*\/w\/\s*$/m.test(robots), "robots.txt", "doesn't keep /w/ (the OBS widget pages) out");
check(new RegExp(`^Sitemap:\\s*${SITE.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/sitemap\\.xml\\s*$`, "m").test(robots), "robots.txt", "doesn't point at the sitemap");
check(!/^Disallow:\s*\/\s*$/m.test(robots), "robots.txt", "blocks the whole site");
check(!/GPTBot|ClaudeBot|PerplexityBot|OAI-SearchBot|Google-Extended|CCBot/i.test(robots), "robots.txt", "blocks an AI crawler; decide that per bot, not by default");

// ── Each page ────────────────────────────────────────────────────────────────

const titles = new Map();
const descriptions = new Map();
const knownPaths = new Set(urls.map(pagePath));

for (const url of urls) {
  const path = pagePath(url);
  const where = path;
  const html = read(fileFor(path));
  if (!html) {
    fail(where, `no prerendered HTML at ${fileFor(path)} (is it in the sitemap but not a static page?)`);
    continue;
  }

  check(/<html[^>]*\blang="en"/.test(html), where, 'missing <html lang="en">');
  check(tags(html, "meta").some((t) => t.name === "viewport" && /width=device-width/.test(t.content ?? "")), where, "no responsive viewport meta");
  check(meta(html, "name", "theme-color").length >= 1, where, "no theme-color meta");

  // Title
  const pageTitles = all(html, /<title>([^<]*)<\/title>/g).map((m) => decode(m[1]));
  check(pageTitles.length === 1, where, `expected one <title>, found ${pageTitles.length}`);
  const title = pageTitles[0] ?? "";
  check(title.length >= 30 && title.length <= 65, where, `title is ${title.length} characters (aim for 50–60): "${title}"`);
  if (title.length > 60 || title.length < 50) warn(where, `title is ${title.length} characters; 50–60 is the sweet spot`);
  check(!titles.has(title), where, `same title as ${titles.get(title)}`);
  titles.set(title, where);

  // Description
  const desc = metaContent(html, "name", "description");
  check(desc.length === 1, where, `expected one meta description, found ${desc.length}`);
  const description = desc[0] ?? "";
  check(description.length >= 110 && description.length <= 170, where, `description is ${description.length} characters (aim for 150–160)`);
  if (description.length < 150 || description.length > 160) warn(where, `description is ${description.length} characters; 150–160 is the sweet spot`);
  check(!descriptions.has(description), where, `same description as ${descriptions.get(description)}`);
  descriptions.set(description, where);

  // Canonical and indexing
  const canonical = tags(html, "link").filter((t) => t.rel === "canonical");
  check(canonical.length === 1, where, `expected one canonical link, found ${canonical.length}`);
  check(canonical[0]?.href === url, where, `canonical is ${canonical[0]?.href}, expected ${url}`);
  const robotsMeta = metaContent(html, "name", "robots").join(",");
  check(!/noindex|nofollow/i.test(robotsMeta), where, `robots meta blocks indexing: "${robotsMeta}"`);

  // Social
  const og = (p) => metaContent(html, "property", p);
  for (const p of ["og:title", "og:description", "og:url", "og:type", "og:site_name", "og:image", "og:image:width", "og:image:height"]) {
    check(og(p).length >= 1, where, `missing ${p}`);
  }
  check(og("og:url")[0] === url, where, `og:url is ${og("og:url")[0]}, expected ${url}`);
  check(og("og:title")[0] === title, where, "og:title differs from <title>");
  check(/^https?:\/\//.test(og("og:image")[0] ?? ""), where, `og:image isn't an absolute URL: ${og("og:image")[0]}`);
  check(og("og:image:alt").length >= 1, where, "missing og:image:alt");
  check(metaContent(html, "name", "twitter:card")[0] === "summary_large_image", where, "twitter:card isn't summary_large_image");
  for (const p of ["twitter:title", "twitter:description", "twitter:image"]) check(metaContent(html, "name", p).length >= 1, where, `missing ${p}`);

  // One h1, and headings that don't skip a level
  const headings = all(html, /<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/g).map((m) => ({ level: Number(m[1]), text: textOf(m[2]) }));
  check(headings.filter((h) => h.level === 1).length === 1, where, `expected one <h1>, found ${headings.filter((h) => h.level === 1).length}`);
  check(headings.every((h) => h.text.length > 0), where, "has an empty heading");
  let previous = 0;
  for (const h of headings) {
    check(h.level <= previous + 1, where, `heading "${h.text}" (h${h.level}) jumps from h${previous}`);
    previous = h.level;
  }

  // Structured data
  const blocks = all(html, /<script type="application\/ld\+json">([\s\S]*?)<\/script>/g).map((m) => m[1]);
  check(blocks.length >= 1, where, "no JSON-LD");
  const nodes = [];
  for (const block of blocks) {
    try {
      const parsed = JSON.parse(block);
      nodes.push(...(Array.isArray(parsed) ? parsed : [parsed]));
    } catch (error) {
      fail(where, `JSON-LD doesn't parse: ${error.message}`);
    }
  }
  check(!/<(?!\\u003c)/.test(blocks.join("")) || !blocks.join("").includes("</script"), where, "JSON-LD could close its own script tag");
  const types = nodes.map((n) => n["@type"]);
  check(types.includes("WebApplication"), where, "no WebApplication JSON-LD");
  check(types.includes("FAQPage"), where, "no FAQPage JSON-LD");
  if (path !== "/") check(types.includes("BreadcrumbList"), where, "no BreadcrumbList JSON-LD");
  for (const node of nodes) {
    check(node["@context"] === "https://schema.org", where, `${node["@type"]} has no schema.org @context`);
    check(!("aggregateRating" in node) && !("review" in node), where, `${node["@type"]} carries ratings or reviews; none exist`);
  }
  const app = nodes.find((n) => n["@type"] === "WebApplication");
  if (app) check(app.url === url, where, `WebApplication url is ${app.url}, expected ${url}`);
  const faq = nodes.find((n) => n["@type"] === "FAQPage");
  if (faq) {
    const questions = faq.mainEntity ?? [];
    check(questions.length >= 4, where, `FAQPage has ${questions.length} questions`);
    // Every answer in the structured data must be visible on the page.
    const visible = textOf(html);
    for (const q of questions) check(visible.includes(q.name), where, `FAQ question isn't on the page: "${q.name}"`);
  }

  // Images and links
  for (const img of tags(html, "img")) check(img.alt !== undefined, where, `<img src="${img.src}"> has no alt attribute`);
  const ids = new Set(all(html, /\sid="([^"]+)"/g).map((m) => m[1]));
  for (const a of tags(html, "a")) {
    const href = a.href ?? "";
    if (href.startsWith("#")) check(href === "#" || ids.has(href.slice(1)), where, `link to ${href} has no target on the page`);
    else if (href.startsWith("/")) {
      const target = href.split(/[?#]/)[0];
      check(knownPaths.has(target) || target.startsWith("/w/") || target === "/icon.svg", where, `internal link to ${href} isn't a page in the sitemap`);
    } else if (/^https?:\/\//.test(href) && !href.startsWith(SITE)) {
      check(/\bnoopener\b/.test(a.rel ?? "") || a.target !== "_blank", where, `external link ${href} opens a new tab without rel="noopener"`);
    }
  }
  check(tags(html, "a").filter((a) => (a.href ?? "").startsWith("/")).length >= 3, where, "has fewer than three internal links");
}

// ── The widget page is for OBS, not search ───────────────────────────────────

const widget = read(join("w", "valorant-rank.html"));
if (widget) {
  check(/noindex/i.test(metaContent(widget, "name", "robots").join(",")), "/w/valorant-rank", "isn't marked noindex");
  check(![...knownPaths].some((p) => p.startsWith("/w/")), "sitemap.xml", "lists a widget page");
} else {
  warn("/w/valorant-rank", "no prerendered widget page to check");
}

// ── Report ───────────────────────────────────────────────────────────────────

console.log(`Audited ${urls.length} pages: ${urls.map(pagePath).join("  ")}`);
for (const w of warnings) console.log(`  warning  ${w}`);
for (const f of failures) console.log(`  FAIL     ${f}`);
console.log(`${passed} checks passed, ${failures.length} failed, ${warnings.length} warnings.`);
process.exit(failures.length ? 1 : 0);
