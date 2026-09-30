import { pages } from "@/config/pages";
import { socialCard } from "@/lib/og";

export const alt = "Valorant rank calculator: how many games to your next rank";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return socialCard(pages.rank.card);
}
