import { RankCalculator } from "@/components/calc/RankCalculator";
import { Faq } from "@/components/sections/Faq";
import { ToolPage } from "@/components/site/ToolPage";
import { pages } from "@/config/pages";
import { faqForLd, rankFaq } from "@/content/faq";
import { faqLd, pageMetadata, webApplicationLd } from "@/lib/seo";

const page = pages.rank;

export const metadata = pageMetadata(page);

export default function RankCalculatorPage() {
  return (
    <ToolPage
      page={page}
      lede="This Valorant rank calculator estimates how many games it takes to climb from your current rank and RR to a target rank, using your win rate and the RR you gain and lose per game. Type your numbers in, or load your last ranked games to fill them in."
      data={[
        webApplicationLd(page, {
          featureList: [
            "Games to reach a target rank, from Iron 1 up to Immortal 1",
            "A likely range, not just one number",
            "Win rate needed to finish in 25, 50 or 100 games",
            "Optional: fill in your win rate and RR from your recent ranked games",
          ],
        }),
        faqLd(faqForLd(rankFaq)),
      ]}
    >
      <RankCalculator />

      <section className="section" id="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">How the rank calculator works</h2>
        <div className="prose">
          <p>Between Iron 1 and Ascendant 3, every rank is 100 RR. So the distance to your target is:</p>
          <p className="formula">RR to go = (target rank − current rank) × 100 − your current RR</p>
          <p>Each game moves you by your average gain if you win and your average loss if you lose, so on average a game is worth:</p>
          <p className="formula">RR per game = win rate × RR per win − (1 − win rate) × RR per loss</p>
          <p>
            The games you need are the RR to go divided by the RR per game, rounded up. If RR per game is zero or less you aren’t climbing,
            so the calculator shows the win rate you’d need to break even instead:
          </p>
          <p className="formula">Break-even win rate = RR per loss ÷ (RR per win + RR per loss)</p>

          <h3>The likely range</h3>
          <p>
            Two players with the same averages still finish at different times, because wins and losses come in streaks. The calculator
            treats your RR as a random walk and uses a standard approximation for how long a walk takes to reach a target (an inverse
            Gaussian distribution). It reports the point where 1 run in 10 is quicker and the point where 1 in 10 is slower, so the span
            between them holds about 8 runs in 10.
          </p>

          <h3>What it leaves out</h3>
          <ul>
            <li>Demotion shields and the Act ending.</li>
            <li>Any change in your win rate or RR per game as you climb. The calculator holds both fixed.</li>
            <li>Immortal 2 and above, and Radiant. From Immortal up, RR has no 100-point ceiling per rank.</li>
          </ul>
        </div>
      </section>

      <Faq id="questions" title="Questions about rank and RR" items={rankFaq} />
    </ToolPage>
  );
}
