import { describe, expect, it } from "vitest";
import { ASSISTANT_CRAWLERS, TRAINING_CRAWLERS } from "@/config/crawlers";
import robots from "@/app/robots";

const rules = (() => {
  const r = robots().rules;
  return Array.isArray(r) ? r : [r];
})();
const agentsOf = (rule: (typeof rules)[number]) => (Array.isArray(rule.userAgent) ? rule.userAgent : [rule.userAgent ?? "*"]);
const listed = rules.flatMap(agentsOf).map((agent) => agent.toLowerCase());

describe("robots.txt", () => {
  it("keeps the widget pages and the event counter out for everyone, and leaves the rest open", () => {
    const everyone = rules.find((rule) => agentsOf(rule).includes("*"));
    expect(everyone?.allow).toBe("/");
    expect(everyone?.disallow).toEqual(["/w/", "/api/"]);
  });

  it("asks the training crawlers to stay out of the whole site", () => {
    const training = rules.find((rule) => agentsOf(rule).includes(TRAINING_CRAWLERS[0]));
    expect(training?.disallow).toBe("/");
    for (const bot of TRAINING_CRAWLERS) expect(agentsOf(training!)).toContain(bot);
  });

  it("never names a search or assistant crawler, so they follow the rules for everyone", () => {
    for (const bot of ASSISTANT_CRAWLERS) expect(listed).not.toContain(bot.toLowerCase());
  });

  it("keeps the two lists apart", () => {
    const training = new Set(TRAINING_CRAWLERS.map((bot) => bot.toLowerCase()));
    for (const bot of ASSISTANT_CRAWLERS) expect(training.has(bot.toLowerCase())).toBe(false);
  });

  it("points at the sitemap", () => {
    expect(robots().sitemap).toMatch(/\/sitemap\.xml$/);
  });
});
