import { isTransient, wait } from "@/lib/httpRetry";
import { logError } from "@/lib/logger";

// Brave Search, the "search" composer mode's only backend. Results are
// folded into the prompt as plain text (see chat/route.js), same pattern as
// file uploads, so every model handles it identically without needing tool
// calling support.

const BASE = "https://api.search.brave.com/res";
const KEY = process.env.BRAVE_API_KEY || "";
const TIMEOUT_MS = 8_000;
const RESULT_COUNT = 5;

export const searchConfigured = () => Boolean(KEY);

async function braveFetch(query) {
  const url = `${BASE}/v1/web/search?q=${encodeURIComponent(query)}&count=${RESULT_COUNT}&result_filter=web`;
  const call = () =>
    fetch(url, {
      headers: { accept: "application/json", "x-subscription-token": KEY },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let res;
  try {
    res = await call();
  } catch (err) {
    if (!isTransient(err)) throw err;
    await wait(300);
    res = await call();
  }
  if ([502, 503, 504].includes(res.status)) {
    await wait(300);
    res = await call();
  }
  return res;
}

// -> "[web search results ...]" text block, or "" if search failed/found
// nothing. Never throws: a dead search provider degrades to "no results",
// not a broken chat.
export async function searchText(query) {
  if (!searchConfigured() || !query) return "";

  let res;
  try {
    res = await braveFetch(query);
  } catch (err) {
    logError("web_search_failed", err, { query });
    return "";
  }
  if (!res.ok) {
    logError("web_search_failed", new Error(`brave search ${res.status}`), { query });
    return "";
  }

  const data = await res.json().catch(() => null);
  const results = data?.web?.results;
  if (!Array.isArray(results) || !results.length) return "";

  const items = results
    .slice(0, RESULT_COUNT)
    .map((r, i) => `${i + 1}. ${r.title}\n${r.url}\n${r.description || ""}`)
    .join("\n\n");

  return `[web search results for "${query}"]\n${items}\n\n`;
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("webSearch.js")) {
  const { default: assert } = await import("node:assert");

  assert.strictEqual(searchConfigured(), false); // no BRAVE_API_KEY in test
  assert.strictEqual(await searchText("anything"), ""); // no-op, not configured
  assert.strictEqual(await searchText(""), ""); // no-op, no query

  console.log("webSearch.js self-check OK");
}
