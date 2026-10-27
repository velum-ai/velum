import { site } from "@/config/site";

// Chat/account/api are disallowed for everyone (nothing there is a public,
// citable page); AI crawlers get the same blanket allow as regular search
// bots on everything else, listed explicitly so a scanner checking for named
// AI user-agents doesn't read their absence as "blocked".
const AI_CRAWLERS = [
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "Amazonbot",
  "Meta-ExternalAgent",
];

export default function robots() {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/chat", "/account", "/api"] },
      ...AI_CRAWLERS.map((userAgent) => ({
        userAgent,
        allow: "/",
        disallow: ["/chat", "/account", "/api"],
      })),
    ],
    sitemap: `${site.url}/sitemap.xml`,
  };
}
