// Every public page, once. The header, footer, sitemap, metadata and structured data all read from here,
// so a page can't be in the nav but missing from the sitemap, or carry a title that drifts from its link text.

export type PageMeta = {
  id: "overlay" | "rank" | "mastery";
  path: string;
  /** <title>, written out in full. 50–60 characters. */
  title: string;
  /** Meta description. 150–160 characters. */
  description: string;
  h1: string;
  /** Short label for nav and footer links. */
  navLabel: string;
  /** ISO date. Change it when the page's content changes, not on every build. */
  lastModified: string;
  /** Social card text. */
  card: { headline: string; sub: string };
};

export const pages: Record<PageMeta["id"], PageMeta> = {
  overlay: {
    id: "overlay",
    path: "/",
    title: "Free Valorant Rank Overlay for OBS & TikTok LIVE | Tally",
    description:
      "Free Valorant rank overlay for OBS and TikTok LIVE. Live rank, RR and session stats as a Browser Source, with a vertical layout. Copy one link, no account.",
    h1: "Valorant rank overlay for OBS",
    navLabel: "Rank overlay",
    lastModified: "2026-09-30",
    card: { headline: "Valorant rank overlay for OBS and TikTok LIVE", sub: "Free. Copy one link. No account." },
  },
  rank: {
    id: "rank",
    path: "/valorant-rank-calculator",
    title: "Valorant Rank Calculator: Games to Rank Up | Tally",
    description:
      "How many games to reach your next Valorant rank? Enter your win rate and RR per game, or load your recent games, and see the typical run and a likely range.",
    h1: "Valorant rank calculator",
    navLabel: "Rank calculator",
    lastModified: "2026-09-30",
    card: { headline: "How many games to your next Valorant rank?", sub: "Win rate, RR per game, and a likely range." },
  },
  mastery: {
    id: "mastery",
    path: "/valorant-agent-mastery-calculator",
    title: "Valorant Agent Mastery Calculator: Matches by Mode | Tally",
    description:
      "How many Competitive, Swiftplay or Spike Rush matches to your next Valorant Agent Mastery level? Uses Riot’s published Mastery Point rules. Free, no sign-up.",
    h1: "Valorant Agent Mastery calculator",
    navLabel: "Mastery calculator",
    lastModified: "2026-09-30",
    card: { headline: "Valorant Agent Mastery calculator", sub: "Matches by mode, hours and days to your next level." },
  },
};

export const pageList = [pages.overlay, pages.rank, pages.mastery];
