import { randomUUID } from "node:crypto";
import { logError } from "@/lib/logger";

// Reports a signup as an ad conversion to X's Conversions API. Server-to-
// server only: no script runs in the visitor's browser, no cookies, nothing
// client-side at all beyond capturing the click id X already put in the ad's
// landing URL. See account.js's create-account route for where this fires.

const PIXEL_ID = process.env.X_PIXEL_ID || "";
const TOKEN = process.env.X_API_KEY || "";
// The registered event's own id from Events manager (fixed per event, not
// per report). "tw-<pixel>-<suffix>" is X's own format, copy it verbatim
// from the event's install dialog rather than constructing it.
const EVENT_ID = process.env.X_EVENT_ID || "";

export const xConversionsConfigured = () => Boolean(PIXEL_ID && TOKEN && EVENT_ID);

// Fire-and-forget: never throws, never awaited by the caller. An ad network
// being slow or down must never delay or fail a signup.
export function reportConversion(twclid) {
  if (!xConversionsConfigured() || !twclid) return;

  fetch(`https://ads-api.x.com/12/measurement/conversions/${PIXEL_ID}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-pixel-token": TOKEN,
    },
    body: JSON.stringify({
      conversions: [
        {
          conversion_time: new Date().toISOString(),
          event_id: EVENT_ID,
          conversion_id: randomUUID(), // per-signup, for X's own dedup
          identifiers: [{ twclid }],
        },
      ],
    }),
    signal: AbortSignal.timeout(5000),
  }).catch((err) => {
    logError("x_conversion_report_failed", err);
  });
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("xConversions.js")) {
  const { default: assert } = await import("node:assert");

  assert.strictEqual(xConversionsConfigured(), false); // no env vars set in test
  assert.doesNotThrow(() => reportConversion("some-click-id")); // no-op, not configured
  assert.doesNotThrow(() => reportConversion(undefined)); // no-op, no click id

  console.log("xConversions.js self-check OK");
}
