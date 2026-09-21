import { randomUUID } from "node:crypto";
import { logError } from "@/lib/logger";

// Reports a signup as an ad conversion to Reddit's Conversions API. Server-to-
// server only: no script runs in the visitor's browser, no cookies, nothing
// client-side at all beyond capturing the click id Reddit already put in the
// ad's landing URL. See account.js's create-account route for where this fires.

const PIXEL_ID = process.env.REDDIT_PIXEL_ID || "";
const TOKEN = process.env.REDDIT_ACCESS_TOKEN || "";

export const redditConversionsConfigured = () => Boolean(PIXEL_ID && TOKEN);

// Fire-and-forget: never throws, never awaited by the caller. An ad network
// being slow or down must never delay or fail a signup.
export function reportConversion(clickId) {
  if (!redditConversionsConfigured() || !clickId) return;

  fetch(`https://ads-api.reddit.com/api/v3/pixels/${PIXEL_ID}/conversion_events`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${TOKEN}`,
    },
    body: JSON.stringify({
      data: {
        events: [
          {
            event_at: Date.now(), // ms epoch, Reddit rejects seconds
            action_source: "WEBSITE", // must be uppercase, lowercase 400s
            type: { tracking_type: "SignUp" },
            click_id: clickId,
            metadata: { conversion_id: randomUUID() }, // no client pixel, id is ours alone
          },
        ],
      },
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((err) => {
    logError("reddit_conversion_report_failed", err);
  });
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("redditConversions.js")) {
  const { default: assert } = await import("node:assert");

  assert.strictEqual(redditConversionsConfigured(), false); // no env vars set in test
  assert.doesNotThrow(() => reportConversion("some-click-id")); // no-op, not configured
  assert.doesNotThrow(() => reportConversion(undefined)); // no-op, no click id

  console.log("redditConversions.js self-check OK");
}
