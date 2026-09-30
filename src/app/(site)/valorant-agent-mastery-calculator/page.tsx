import { MasteryCalculator } from "@/components/calc/MasteryCalculator";
import { Faq } from "@/components/sections/Faq";
import { ToolPage } from "@/components/site/ToolPage";
import { pages } from "@/config/pages";
import { faqForLd, masteryFaq } from "@/content/faq";
import { int } from "@/lib/format";
import { creditRange, cumulativeMp, levelRows, MASTERY_SOURCE, matchesNeeded, milestoneCost, REWARD_MILESTONES } from "@/lib/mastery";
import { GAME_MODES, lengthLabel, MODE_SOURCE, typicalMinutes } from "@/lib/modes";
import { faqLd, pageMetadata, webApplicationLd } from "@/lib/seo";

const page = pages.mastery;

export const metadata = pageMetadata(page);

export default function MasteryCalculatorPage() {
  return (
    <ToolPage
      page={page}
      lede="This Valorant Agent Mastery calculator works out how many matches, hours and days it takes to reach your next Act Level in Competitive, Unrated, Swiftplay, Spike Rush, Team Deathmatch or Premier, using Riot’s published Mastery Point rules from Patch 13.06. Pick your mode, then enter your level, progress and win rate."
      data={[
        webApplicationLd(page, {
          featureList: [
            "Matches, hours and days to a target Act Level",
            "Matches needed in each game mode that earns Mastery Points",
            "Best and worst case: every match won, every match lost",
            "Portrait Accents and Lifetime Level rewards you would pass",
            "Optional: use your own match length and win rate from your recent ranked games",
          ],
        }),
        faqLd(faqForLd(masteryFaq)),
      ]}
    >
      <MasteryCalculator />

      <section className="section" id="how-it-works" aria-labelledby="how-title">
        <h2 id="how-title">How Mastery Points work</h2>
        <div className="prose">
          <p>
            Agent Mastery arrived in Patch {MASTERY_SOURCE.patch} on {MASTERY_SOURCE.released}, replacing the Gear system. It tracks how
            much you play each agent.
          </p>
          <ul>
            <li>
              Play a match with an agent in Unrated, Competitive, Swiftplay, Spike Rush, Team Deathmatch or Premier to earn Mastery Points (MP) for
              that agent. <a href="#modes">See how many matches each mode takes.</a>
            </li>
            <li>Every minute played is worth 80 MP, and a win multiplies the match by 1.3. Performance Score adds more, but Riot hasn’t published how much.</li>
            <li>Each agent has 10 main Act Levels per Act. Reaching Levels 4, 7 and 10 unlocks Portrait Accents.</li>
            <li>After Act Level 10 you can keep going through Overleveling for the rest of the Act.</li>
            <li>Act Levels reset every Act. Each Act Level you earn also adds one Lifetime Level, which is permanent and unlocks the rewards below.</li>
          </ul>
          <p className="formula">Base MP = seconds played × 4 ÷ 3</p>
          <p className="formula">MP for a win = base MP × 1.3</p>
        </div>
      </section>

      <section className="section" id="modes" aria-labelledby="modes-title">
        <h2 id="modes-title">Matches in each game mode</h2>
        <div className="prose">
          <p>
            Mastery Points come from minutes played, so every mode takes the same time to climb. The shorter modes just need more matches.
            Riot’s wiki lists six modes that earn Mastery Points and gives each an estimated game time.
          </p>
        </div>
        <table className="datatable">
          <caption>
            From the start to Act Level 10 at a 50% win rate, using the middle of Riot’s estimate and no Performance Score bonus.
          </caption>
          <thead>
            <tr>
              <th scope="col">Mode</th>
              <th scope="col">Estimated game time</th>
              <th scope="col">Matches</th>
            </tr>
          </thead>
          <tbody>
            {GAME_MODES.map((mode) => (
              <tr key={mode.id}>
                <td>{mode.name}</td>
                <td>{lengthLabel(mode)}</td>
                <td>{int(matchesNeeded(cumulativeMp(10), typicalMinutes(mode), 50))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="source">
          The calculator above does the same sum with your own level, win rate and match length. Estimated game times are from{" "}
          <a href={MODE_SOURCE.url} target="_blank" rel="noopener noreferrer">
            {MODE_SOURCE.name}
          </a>
          , and Riot gives a range for every mode, never one figure, so real matches run shorter or longer.
        </p>
      </section>

      <section className="section" id="mp-per-level" aria-labelledby="levels-title">
        <h2 id="levels-title">Mastery Points per Act Level</h2>
        <table className="datatable">
          <caption>MP to earn each Act Level on its own, and in total from the start of the Act.</caption>
          <thead>
            <tr>
              <th scope="col">Act Level</th>
              <th scope="col">MP for this level</th>
              <th scope="col">Total MP</th>
            </tr>
          </thead>
          <tbody>
            {levelRows().map((row) => (
              <tr key={row.level}>
                <td>{row.level}</td>
                <td>{int(row.mp)}</td>
                <td>{int(row.cumulative)}</td>
              </tr>
            ))}
            <tr>
              <td>15 to 30</td>
              <td>{int(715_000)} each</td>
              <td>
                {int(cumulativeMp(15))} to {int(cumulativeMp(30))}
              </td>
            </tr>
          </tbody>
        </table>
        <p className="source">
          The totals are added up from the per-level costs. The wiki’s table prints 109,000 for Level 9; its own costs add up to 109,900, and
          its totals from Level 10 on agree with that.
        </p>
      </section>

      <section className="section" id="rewards" aria-labelledby="rewards-title">
        <h2 id="rewards-title">Lifetime Level rewards</h2>
        <p className="lede">
          Rewards unlock at every fifth Lifetime Level and are claimed with Kingdom Credits. The cost of each is in brackets.
        </p>
        <ul className="milestones">
          {REWARD_MILESTONES.map((m) => (
            <li key={m.level}>
              <strong>Lifetime Level {m.level}</strong>
              <span>
                {m.rewards.map((r) => `${r.name} (${int(r.credits)})`).join(", ")}.{" "}
                <span className="milestones__cost">
                  {creditRange(m)} each, {int(milestoneCost(m))} for all {m.rewards.length}.
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="source">
          Sources: the MP rule, level costs, reward costs and the list of modes are from{" "}
          <a href={MASTERY_SOURCE.wiki.url} target="_blank" rel="noopener noreferrer">
            {MASTERY_SOURCE.wiki.name}
          </a>
          ; each mode’s estimated game time is from{" "}
          <a href={MODE_SOURCE.url} target="_blank" rel="noopener noreferrer">
            {MODE_SOURCE.name}
          </a>
          ; Portrait Accents, Overleveling and the release are from{" "}
          <a href={MASTERY_SOURCE.notes.url} target="_blank" rel="noopener noreferrer">
            {MASTERY_SOURCE.notes.name}
          </a>
          . Checked {MASTERY_SOURCE.checked}. Riot can change these numbers, and this site isn’t affiliated with Riot Games.
        </p>
      </section>

      <Faq id="questions" title="Questions about Agent Mastery" items={masteryFaq} />
    </ToolPage>
  );
}
