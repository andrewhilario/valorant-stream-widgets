// Which AI crawlers robots.txt turns away, and which it deliberately leaves alone. No imports, because scripts/check-seo.mjs
// reads this file directly.

/**
 * Crawlers that collect pages to train AI models, and nothing else. robots.txt asks these to stay out; the site's own pages
 * stay open to everyone else. Blocking them doesn't take the site out of AI answers: it only declines the use of its pages as
 * training data. Add a name here to opt out of another one.
 *
 * Google-Extended is left out on purpose. It is Google's switch for Gemini training, but it also stops the Gemini app from
 * using the page to ground an answer, and the aim here is to be found. Add it if you would rather opt out of both.
 */
export const TRAINING_CRAWLERS = [
  "GPTBot", // OpenAI, training
  "ClaudeBot", // Anthropic, training
  "anthropic-ai", // Anthropic, older name
  "CCBot", // Common Crawl, the open dataset many models train on
  "Applebot-Extended", // Apple Intelligence training (Siri and Spotlight search use plain Applebot)
  "Bytespider", // ByteDance
  "meta-externalagent", // Meta, training
  "cohere-ai", // Cohere
  "Diffbot", // sells scraped pages as training data
] as const;

/**
 * Crawlers that must never be blocked here: the search engines that feed AI answers, the AI search indexes, and the ones that
 * fetch a page because somebody asked an assistant about it. check-seo.mjs fails the build audit if any is disallowed.
 */
export const ASSISTANT_CRAWLERS = [
  "Googlebot", // Google Search, AI Overviews and AI Mode
  "Bingbot", // Bing, Copilot
  "OAI-SearchBot", // ChatGPT search
  "ChatGPT-User", // ChatGPT opening a page for a user
  "PerplexityBot", // Perplexity's index
  "Perplexity-User",
  "Claude-SearchBot", // Claude's web search
  "Claude-User",
  "DuckAssistBot", // DuckDuckGo's AI answers
  "Applebot", // Siri and Spotlight
] as const;
