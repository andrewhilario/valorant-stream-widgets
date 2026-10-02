# Tally

Free tools for Valorant streamers, on one static Next.js site. No account, no backend, no secrets on the server.

| Page | What it is |
| --- | --- |
| `/` | **Rank overlay** for OBS and TikTok LIVE: rank, RR, peak, session stats, four layouts (one tall and narrow for vertical streams). Pick a theme from a gallery (point at one to try it on the live preview), watch it react to a win, a loss or a rank change, copy one link, paste it into OBS as a Browser Source. |
| `/valorant-rank-calculator` | **Rank calculator**: games to a target rank from your win rate and RR per game, with a likely range. Optionally fills itself in from your recent ranked games, including a per-agent breakdown. |
| `/valorant-agent-mastery-calculator` | **Agent Mastery calculator**: matches, hours and days to a target Act Level, from Riot's published Mastery Point rules. Pick a game mode (Competitive, Unrated, Premier, Swiftplay, Spike Rush, Team Deathmatch) and it shows how many matches of each the climb takes. |

> "Tally" is a working name. It lives in one place, [`src/config/site.ts`](src/config/site.ts).

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm test             # unit tests
npm run typecheck
npm run build        # needs internet: next/font downloads the Google Fonts at build time
npm run check:seo    # audits the built pages the way a crawler sees them (run after build)
npm run check:api    # checks a real HenrikDev key and the shapes this app reads (see below)
```

Settings go in `.env.local` (copy `.env.example`). Nothing is needed to run locally.

| Variable | What it does |
| --- | --- |
| `NEXT_PUBLIC_SITE_URL` | **Set this before deploying.** The public address, e.g. `https://tally.example` (the `https://` is added if you leave it off, and `http://` for localhost, so `localhost:3000` works too). Canonical links, the sitemap, structured data and social cards are built from it. Unset, they point at `localhost` and the build warns. On Vercel the production URL is used automatically. |
| `NEXT_PUBLIC_BMC_URL` | Your Buy Me a Coffee page. Defaults to `https://buymeacoffee.com/ainzzuu`. |
| `NEXT_PUBLIC_BMC_WIDGET` | `off` removes Buy Me a Coffee's floating button (the plain links stay) and its hosts from the security policy. |

## How it works

It's a static site. Every page is prerendered; there are no API routes.

- **`/`** is the editor. Every control comes from a schema, so the inspector, the ⌘K palette, validation and the link format stay in step.
- **`/w/valorant-rank?…#k=…`** is the page OBS loads. It reads its settings from the link and polls HenrikDev itself. The editor's preview is this same page in an iframe, so what you see is what OBS renders.
- **The calculators** are client components over pure maths in [`src/lib`](src/lib) (`rank-calc.ts`, `mastery.ts`, with `rank-tool.ts` and `mastery-tool.ts` turning form text into results), so every number and every state's wording is unit-tested.

### Every streamer brings their own HenrikDev key

A shared key would cap how many streamers could be live at once, because each key has its own rate limit. So instead:

- The streamer pastes a free HenrikDev key into **Account**. It is saved in their browser's `localStorage`, in the editor's saved settings. The calculators read and write the same four fields (Riot ID, region, platform, key), so it is entered once for every tool.
- The OBS link carries it **after a `#`**. Browsers never send a URL fragment to a server, so the key goes from OBS straight to `api.henrikdev.xyz` (which allows browser requests) and never through this site. It is kept out of the query string and out of the editor's address bar too.
- The link field shows the key masked. Copying it, by button or by hand, always gives the full link.
- One overlay lookup costs two requests (rank + history); the default refresh is 60 s. The calculators' "Use my recent ranked games" costs three, once per click.

**Don't add analytics that record full URLs or `location.hash`.** That would put keys in your logs.

### Sessions need no reset

There's no stored session to lose when OBS restarts. The widget works the session out from match history every time: the latest unbroken run of games (a gap longer than N hours starts a new one), everything since local midnight, or a rolling window. See [`src/lib/session.ts`](src/lib/session.ts).

### The overlay reacts to games

When two lookups in a row differ, the widget plays a short reaction, so viewers see a result land. [`reactions.ts`](src/widgets/valorant-rank/reactions.ts) decides which, as a pure function (`detectReaction(previous, next)`):

| Reaction | When | What plays |
| --- | --- | --- |
| Win | a new game that gained RR | a pop on the change, a bump on the number, one pass of light |
| Loss | a new game that lost RR | the change nudges, the number dips, a little red on the edge. No fanfare. |
| Rank up | the tier went up (or the last placement game ended) | the badge swells and sends out a ring, the name rises into place, light crosses slowly. RR and the bar snap to the new rank instead of counting backwards. |
| Rank down | the tier went down | the badge sinks, the name drops in, the change nudges |

It stays quiet when it shouldn't speak: the first lookup, a repeat of the same games, a different account, a history that failed to load and then loaded (so old games don't look new), a game that ended more than 15 minutes ago, and a game that changed no RR. A new rank wins over the game that caused it.

- It is on by default and off with **React to games** in Look (link parameter `rx=0`). It needs **Animate changes**, so a fully static overlay stays static, and it never starts for someone who asked their system for reduced motion.
- It moves only `transform` and `opacity`, and the widget stylesheet still avoids everything old OBS builds can't parse.
- The editor can't wait for a game to end, so under the preview **Try a game** (Win, Loss, Rank up, Rank down; also in the ⌘K palette, and by clicking the widget in the preview) plays one made up by `simulateGame`. It runs on sample data and keeps going from there (win enough and it promotes), and switching back to "Show my rank" starts over. It isn't a model of Valorant's matchmaking: RR stays continuous across a rank boundary, where real demotions land lower.
- The live path was exercised with stubbed HenrikDev responses (first load, nothing new, a win, a repeat, a promotion), like everything else here; it hasn't seen a real key.

### Themes

The Theme control is drawn as cards (`display: "gallery"` on a choice in the schema, with a `swatch` and a `note` per option), each a miniature of the widget in that theme's own colours, corners, marks and bar. Pointing at a card tries it on the preview without picking it: the editor posts the settings *as if it were picked* (`withChoice`, the same code a real pick uses, bundle included) and puts the real ones back when the pointer leaves. Nothing is saved or put in the link until it is picked. Touch just taps to pick. In the preview, a theme change cross-fades because the widget's colour variables are registered with `@property`; a browser that doesn't know it simply changes at once, and in OBS the settings never change after load.

Pointing at the widget in the editor's preview leans it a few degrees toward the pointer and presses it on click ([`tilt.ts`](src/lib/tilt.ts), [`useStageTilt.ts`](src/components/playground/useStageTilt.ts)). That is only the editor's preview, never the page OBS loads, it is off for reduced motion, and the maximum lean is 3.5°.

### OBS compatibility

OBS Browser Sources can run an old Chromium, so the widget's stylesheet avoids `oklch()`, `color-mix()`, nesting, `:has()` and container queries. Its colours are authored in OKLCH in [`themes.ts`](src/widgets/valorant-rank/themes.ts) and converted to `rgb()` at runtime. `browserslist` in `package.json` tells the compiler to match.

## The calculators

### What can and can't be fetched

| Data | Source | Notes |
| --- | --- | --- |
| Your rank, RR, win rate, RR per win and loss | HenrikDev `v3/mmr` + `v2/mmr-history`, with your own key | Same two requests the overlay uses. |
| Which agent you played, match length, who won | HenrikDev `v4/matches` (`mode=competitive&size=10`) | Your last ten ranked games, joined to the RR history on `match_id`. **Only tested against fixtures and a fake key, never a real one. Run `npm run check:api` once.** |
| The agent list, and each agent's portrait | valorant-api.com (no key) | The list (about 20 KiB) is fetched once, and only when needed. Portraits appear in the Mastery page's agent picker, beside your pick in the result, and in the rank page's "Your recent agents". They are the API's 64 px round `minimapPortrait`, about 6 KiB each, and the picker only loads them once it is opened. **Not `displayIcon`:** that, and `displayIconSmall`, which is the very same file, is a 1024 px image of 400 to 570 KiB, so a picker of 29 agents would be about 15 MB. See [`src/lib/agents.ts`](src/lib/agents.ts). |
| **Your Agent Mastery progress** | **Not available** | Neither HenrikDev nor valorant-api.com had a Mastery endpoint when this was written (30 September 2026), so the Mastery page asks you to type your level and progress from the in-game screen. If one appears, it would replace the manual fields. |
| The Mastery rules and level costs | Typed in from Riot's pages | See below. |

### Where the Mastery numbers come from

The Mastery Point rule, the cost of each Act Level, the list of modes and the reward costs are from Riot's [VALORANT Wiki](https://wiki.playvalorant.com/en-us/Agent_Mastery). Each mode's match length is the "Estimated Game Time" column on the wiki's [Game Modes](https://wiki.playvalorant.com/en-us/Game_Modes) page. Portrait Accent levels, Overleveling and the release are from [Riot's Patch 13.06 notes](https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-13-06/). They were compared on 30 September 2026. Things worth knowing:

- Riot hasn't published how much **Performance Score** adds, so it is an input on the page (default 0%), never a built-in.
- **Game modes.** Mastery Points come from minutes played (80 a minute, times 1.3 for a win), so the *hours* are the same in any mode and the shorter modes just need more *matches*. Riot gives each mode a range, never one figure (Competitive and Unrated 30–40 min, Premier 30–40+, Swiftplay 10–15, Spike Rush 8–12, Team Deathmatch 8–10), so the calculator uses the middle of the range, shows the spread between the two ends under each count, and lets you type your own length. If you load your ranked games, your own average length is used for the first-to-13 modes (Competitive, Unrated, Premier) and never for the short ones. The figures live in [`src/lib/modes.ts`](src/lib/modes.ts), which has a test that holds them to what the wiki prints; the FAQ answers that quote numbers work them out with the same functions.
- The wiki's table prints 109,000 as the running total at Level 9; its own per-level costs add up to 109,900, and its later totals agree with that. The code adds up the costs instead of copying the total, and the page says so.

When Riot changes the rules, edit [`src/lib/mastery.ts`](src/lib/mastery.ts) (its tests assert the published totals, so a wrong edit fails loudly), then update `MASTERY_SOURCE.checked` there and `lastModified` for that page in [`src/config/pages.ts`](src/config/pages.ts).

### The rank maths

Iron 1 to Ascendant 3 climb in fixed 100 RR steps, so the gap is `(target − current) × 100 − RR`; games are the gap divided by `win rate × RR per win − (1 − win rate) × RR per loss`. The likely range (shown as "8 in 10 runs") treats RR as a random walk and uses an inverse-Gaussian first-passage approximation, checked against a seeded simulation in [`rank-calc.test.ts`](src/lib/rank-calc.test.ts). It stops at Immortal 1 (RR has no 100-point ceiling above that) and ignores demotion shields.

## SEO

Every page has its own title (50–60 characters) and description (150–160), a canonical link, Open Graph and Twitter tags, a generated 1200 × 630 social card, JSON-LD (`WebApplication`, `FAQPage`, and `BreadcrumbList` on tool pages), one `h1`, breadcrumbs and descriptive internal links. `/sitemap.xml`, `/robots.txt` and the web manifest are generated. The widget pages under `/w/` are `noindex` and disallowed. AI crawlers are not blocked.

- All of it is driven by one list, [`src/config/pages.ts`](src/config/pages.ts). **To add a page**, add an entry there, create the route with `pageMetadata(page)` and a `ToolPage` (see the existing two), and add an `opengraph-image.tsx`. The nav, footer, sitemap and related-tools links follow.
- `npm run build && npm run check:seo` audits the prerendered HTML: lengths, uniqueness, canonicals, social tags, JSON-LD (including that every FAQ answer is visible on the page), heading order, links, the sitemap and robots rules. `src/lib/seo.test.ts` holds the copy to the same length rules at test time.
- After deploying: submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.
- Measured with Lighthouse on the production build (mobile profile, median of three runs, on a busy laptop): SEO 100, Accessibility 100, Best Practices 100, Performance 95 on the rank calculator and 93 on the Mastery calculator, layout shift 0. Performance moves by several points between runs on the same code, and field data will differ.
- Social card colours and the apple icon are read from `tokens.css` at build time, so they follow the site's palette. They use Space Grotesk from `@fontsource/space-grotesk` (a dev dependency, used only at build).

## Security

[`next.config.ts`](next.config.ts) sets, in production: a Content-Security-Policy, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` and HSTS. The widget pages get a stricter policy (and `noindex`, and `no-referrer`).

The pages are static, so scripts can't carry a nonce and the policy has to allow `'unsafe-inline'` (the documented option for that). What it does add is a short list of places a script on the page may send anything: `connect-src` is only this site, `api.henrikdev.xyz` and `valorant-api.com`; images only this site, `media.valorant-api.com` and Buy Me a Coffee; frames only this site (the editor's preview) and Buy Me a Coffee.

**Buy Me a Coffee's floating button is third-party JavaScript on pages that hold a streamer's key in `localStorage`.** It loads after the page is idle, is never on the widget pages OBS loads, and sets a `visited` cookie for a day. The policy above limits where it could send anything, but it is still code you don't control. If that isn't acceptable, set `NEXT_PUBLIC_BMC_WIDGET=off`: the button goes, the plain Buy Me a Coffee links stay, and its hosts leave the policy. If Buy Me a Coffee changes the hosts it uses, the button will quietly stop working until `next.config.ts` is updated. The policy was tested against the live widget (script, button, and its panel), the editor preview and the widget page.

A key is also visible to anyone with the OBS link, so treat the link like a password. If it leaks, create a new key in the HenrikDev dashboard.

## Adding a widget

1. `src/widgets/<id>/definition.ts`: the schema (sections of controls, each with a default and a short URL parameter) and a typed config.
2. `Widget.tsx` + `widget.css`: a pure renderer. `Runtime.tsx`: reads the link, fetches, renders. Copy the Valorant one.
3. Register the metadata in [`src/widgets/registry.ts`](src/widgets/registry.ts) and the runtime in [`src/components/WidgetRuntime.tsx`](src/components/WidgetRuntime.tsx).

Controls marked `secret: true` travel in the `#fragment`, never the query string. A choice can be drawn as a theme-style gallery (`display: "gallery"`, with a `swatch` per option), and a widget can offer `tryouts` in the registry: buttons under the preview that make it play something once.

## Checking a real key

Everything here was tested against fixtures shaped from the HenrikDev docs and against the live API with a deliberately wrong key (to check the error path, CORS and the request URLs). **It has not been run against a real key.** Do this once:

```powershell
$env:HENRIK_API_KEY = "HDEV-…"; npm run check:api -- <name> <tag> <region>
```

It checks `v3/mmr`, `v2/mmr-history` and `v4/matches`: each request's status, your rate-limit headers, and whether the fields the app reads are present (including that you appear in the match's player list and that matches join to the RR history).

## Layout of the code

```
tokens.css                  design tokens (the only place site colours live)
src/config/                 site.ts (name, URL, Buy Me a Coffee), pages.ts (every page, once)
src/app/(site)/             the editor, the calculator pages, and their root layout
src/app/(widget)/w/[widget] the page OBS loads + its own root layout and fonts
src/components/playground/  editor: stage, inspector, palette, output bar, state
src/components/calc/        the calculators: fields, result pieces, account panel, lookups
src/components/site/        header, footer, breadcrumbs, palette, the Buy Me a Coffee button
src/components/controls/    schema-driven form controls (the calculators reuse them)
src/content/faq.ts          FAQ copy as data: the visible answers and the FAQPage data are the same words
src/lib/                    schema codec, session maths, rank and mastery maths, tilt maths, HenrikDev client + normalisers
src/widgets/valorant-rank/  definition, renderer, runtime, themes, reactions, styles
scripts/                    check-api.mjs (a real key), check-seo.mjs (the built pages)
```

The design system is documented in the stamp at the top of [`globals.css`](src/app/(site)/globals.css) and recorded in `.hallmark/log.json`.

## Not affiliated with Riot Games

Valorant and Riot Games are trademarks of Riot Games, Inc. Rank data comes from the unofficial HenrikDev API; badge art and agent data from valorant-api.com; Mastery rules from Riot's own pages.
