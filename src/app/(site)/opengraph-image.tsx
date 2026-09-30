import { pages } from "@/config/pages";
import { socialCard } from "@/lib/og";

export const alt = "Tally: a free Valorant rank overlay for OBS and TikTok LIVE";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return socialCard(pages.overlay.card);
}
