import { pages } from "@/config/pages";
import { socialCard } from "@/lib/og";

export const alt = "Valorant Agent Mastery calculator: matches by game mode, hours and days to your next level";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return socialCard(pages.mastery.card);
}
