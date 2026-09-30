// FAQ copy as data, so the visible accordion and the FAQPage structured data are always the same words.
// Where an answer quotes a figure, the figure is worked out with the same functions the calculators use.

import { hoursText, list } from "@/lib/format";
import { cumulativeMp, matchesNeeded } from "@/lib/mastery";
import { GAME_MODES, lengthLabel, modeById, typicalMinutes } from "@/lib/modes";

export type FaqItem = {
  q: string;
  /** Plain text. Each string is one paragraph; the structured data joins them. */
  paragraphs: string[];
  /** Adds the Buy Me a Coffee link after the answer (left out of the structured data). */
  support?: boolean;
};

export const overlayFaq: FaqItem[] = [
  {
    q: "Is it really free?",
    paragraphs: [
      "Yes. No account on this site, no watermark, no trial. If it earns a spot on your stream, a coffee helps keep it going.",
    ],
    support: true,
  },
  {
    q: "Why do I need my own key?",
    paragraphs: [
      "Rank data comes from HenrikDev, and each key has its own rate limit. One shared key would cap how many streamers could be live at once. A key of your own is free, and it means your widget never competes with anyone else’s.",
    ],
  },
  {
    q: "Is my key safe?",
    paragraphs: [
      "The key is saved in this browser and added to your OBS link after a #. Browsers never send that part of a link to a server, so it goes from OBS straight to HenrikDev and never through this site.",
      "Treat the link like a password: don’t post it in chat or show it on stream. If it leaks, create a new key in the HenrikDev dashboard and copy a fresh link.",
      "The only third-party script on this site is the Buy Me a Coffee button. The widget page that OBS loads has none.",
    ],
  },
  {
    q: "Does it need my Riot password?",
    paragraphs: [
      "No, and never type one here. It only needs your Riot ID, the name and tag, because HenrikDev reads public ranked data.",
    ],
  },
  {
    q: "Does it work for vertical streams like TikTok LIVE?",
    paragraphs: [
      "Yes. Switch the preview to Vertical to place the widget on a 1080 × 1920 canvas, and try the Stack layout, which is tall and narrow.",
      "In OBS, set the base and output resolution to 1080 × 1920 under Settings, Video, then add the Browser Source as usual. In TikTok LIVE Studio, add a Link source and paste the same link.",
    ],
  },
  {
    q: "How often does it update?",
    paragraphs: [
      "Every 60 seconds by default, and each update costs two requests from your key. Ranked data only changes when a game ends, so checking faster rarely helps. You can change it under Session, Advanced. If the data service is slow, the widget keeps showing the last numbers it had.",
    ],
  },
  {
    q: "What counts as a session?",
    paragraphs: [
      "By default, your latest run of games. A gap longer than four hours starts a fresh session, so yesterday’s stats never show up on today’s stream. Prefer a calendar day or a rolling window? Switch it under Session. There is nothing to reset: the widget works it out from your match history each time.",
    ],
  },
  {
    q: "Why is the widget blank in OBS?",
    paragraphs: [
      "Start with the status line under the preview: it says what HenrikDev returned, including whether your Riot ID, region and key are right. If the preview is fine but OBS isn’t, open the source’s properties and press Refresh cache of current page, then check that the width and height match the boxes under the preview.",
    ],
  },
  {
    q: "Can I use my own colours and fonts?",
    paragraphs: [
      "Colours, yes: pick a swatch or type a hex under Look, Accent colour. Three type sets are built in. Panel opacity and corner style are there too.",
    ],
  },
  {
    q: "Is this official?",
    paragraphs: [
      "No. It isn’t affiliated with or endorsed by Riot Games. Valorant and Riot Games are trademarks of Riot Games, Inc. Rank data comes from the unofficial HenrikDev API and badge art from valorant-api.com.",
    ],
  },
];

export const rankFaq: FaqItem[] = [
  {
    q: "How many games does it take to rank up in Valorant?",
    paragraphs: [
      "It depends on your win rate and on how much RR you gain and lose. From Iron 1 to Ascendant 3 every rank is 100 RR, so the distance to a target is the number of ranks times 100, minus the RR you already have.",
      "Divide that by your average RR per game. For example, at a 54% win rate with +19 RR per win and −17 RR per loss you average +2.44 RR a game, so one 100 RR rank takes about 41 games.",
    ],
  },
  {
    q: "Do Unrated, Swiftplay or other modes change my RR?",
    paragraphs: [
      "No. Only Competitive games change your RR, so this calculator counts ranked games, and “Use my recent ranked games” reads your recent ranked matches. Unrated, Swiftplay, Spike Rush and Team Deathmatch don’t move your rank.",
      "They do earn Agent Mastery Points, though: the Agent Mastery calculator shows how many matches of each mode it takes to reach your next level.",
    ],
  },
  {
    q: "What win rate do I need to climb?",
    paragraphs: [
      "You climb only when you win more often than your break-even rate, which is RR per loss divided by RR per win plus RR per loss. With +19 per win and −17 per loss that is 47.2%. Below it you lose RR on average, however long you play.",
      "The calculator works out your own break-even rate, and shows what a few points more or less would change.",
    ],
  },
  {
    q: "How much RR do you gain for a win?",
    paragraphs: [
      "It isn’t a fixed number. It changes from game to game with how you played and with how your hidden matchmaking rating compares with your rank, which is why the calculator asks for your own averages.",
      "To fill them in from your real games, open “Use my recent ranked games” and load them with your own HenrikDev key.",
    ],
  },
  {
    q: "How accurate is the estimate?",
    paragraphs: [
      "It’s an average, not a promise. Real runs vary: a hot streak shortens the climb and a slump lengthens it, so the calculator also shows a range. With your numbers, about 8 in 10 runs finish between its quick and slow figures.",
      "It leaves out demotion shields, the Act ending, and any change in your win rate. The more ranked games your averages come from, the better they describe you.",
    ],
  },
  {
    q: "Does it work for Immortal and Radiant?",
    paragraphs: [
      "Only up to Immortal 1. Iron 1 through Ascendant 3 move in fixed 100 RR steps, and the maths relies on that. From Immortal up, RR has no 100-point ceiling per rank, so the calculator stops at Immortal 1.",
    ],
  },
  {
    q: "Do I need a key to use it?",
    paragraphs: [
      "No. Type your numbers in and it works. A key is only for the optional “Use my recent ranked games” button, which reads your last ranked games from HenrikDev with a free key of your own. The key stays in your browser and goes straight to HenrikDev, not through this site.",
    ],
  },
];

/** The climb from the start to Act Level 10 at a 50% win rate, in one mode: matches and the hours they add up to. */
function fromTheStart(modeId: string) {
  const minutes = typicalMinutes(modeById(modeId));
  const matches = matchesNeeded(cumulativeMp(10), minutes, 50);
  return { matches, hours: (matches * minutes) / 60 };
}

export const masteryFaq: FaqItem[] = [
  {
    q: "How many Mastery Points do you earn per match?",
    paragraphs: [
      "Riot’s published rule is 80 MP for every minute you play (seconds played × 4 ÷ 3), multiplied by 1.3 if you win, plus more for your Performance Score. A 35-minute match is worth 2,800 MP before Performance Score, or 3,640 MP if you win.",
      "Riot hasn’t published how much Performance Score adds, so the calculator starts its bonus at 0% and lets you set your own. Until you do, real matches may earn a little more than it assumes.",
    ],
  },
  {
    q: "How many Mastery Points do you need to reach Act Level 10?",
    paragraphs: [
      "132,400 MP in all, from 2,000 MP for Act Level 1 up to 22,500 MP for Act Level 10. At 35 minutes a match and a 50% win rate, which averages 3,220 MP a match, that is 42 matches and about 24.5 hours of play.",
    ],
  },
  {
    q: "Can the calculator see my Mastery progress?",
    paragraphs: [
      "No. The data service this site uses has no Mastery information, so you enter your Act Level and the MP you’ve earned toward the next one from the Mastery screen in the game.",
      "“Use my recent ranked games” fills in your win rate, and your match length for the modes that play like ranked (Competitive, Unrated and Premier), from your last ranked games, and nothing more.",
    ],
  },
  {
    q: "Which game modes earn Mastery Points?",
    paragraphs: [
      `${list(GAME_MODES.map((m) => m.name))}, according to Riot’s VALORANT Wiki.`,
      `Riot gives each an estimated game time: ${list(GAME_MODES.map((m) => `${m.name} ${lengthLabel(m)}`))}. The calculator shows how many matches of each it takes.`,
    ],
  },
  {
    q: "Which game mode is fastest for Agent Mastery?",
    paragraphs: [
      "By Riot’s published rule, none. Mastery Points come from minutes played, 80 a minute and 1.3 times that for a win, so the hours are the same in any mode. A shorter mode just takes more matches.",
      `For example, from the start to Act Level 10 at a 50% win rate is ${fromTheStart("competitive").matches} Competitive matches (${hoursText(fromTheStart("competitive").hours)}) or ${fromTheStart("swiftplay").matches} Swiftplay matches (${hoursText(fromTheStart("swiftplay").hours)}), using the middle of Riot’s estimated game times.`,
      "Performance Score, which Riot hasn’t published, may differ from mode to mode, so real results can differ from this.",
    ],
  },
  {
    q: "Do Act Levels reset?",
    paragraphs: [
      "Yes. Act Levels start again at the beginning of every Act. Each Act Level you earn also adds one Lifetime Level, and Lifetime Levels are permanent for that agent.",
      "Lifetime Level is what unlocks the reward milestones at 5, 10, 15, 20, 25 and 30.",
    ],
  },
  {
    q: "What is Overleveling?",
    paragraphs: [
      "Once you reach Act Level 10 you can keep earning Act Levels for the rest of the Act, which Riot calls Overleveling. The levels get steep: Level 11 costs 35,000 MP, Level 12 costs 78,000, Level 13 costs 205,000 and Level 14 costs 418,000. From Level 15 every level costs 715,000 MP.",
    ],
  },
  {
    q: "Does the agent I pick change the maths?",
    paragraphs: [
      "No. The Mastery Point rules are the same for every agent. Pick one to name your result, or, after loading your recent ranked games, to use your own match length and win rate on that agent.",
    ],
  },
];

export const faqForLd = (items: FaqItem[]) => items.map((item) => ({ q: item.q, a: item.paragraphs.join(" ") }));
