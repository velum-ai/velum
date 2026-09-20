import { NextResponse } from "next/server";
import { creditPayment, failPayment } from "@/lib/account";
import { verifyWebhook } from "@/lib/dodo";
import { log, logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_BODY = 64 * 1024; // Dodo events are ~2KB; this is slack, not a limit

// Dodo Payments -> us. The durable source of truth for completed payments. Must
// read the RAW body for the Standard Webhooks HMAC, so never call req.json()
// here. Answers 2xx only once the work is done or provably pointless to retry;
// a transient failure returns 5xx so Dodo redelivers (it backs off for hours).
export async function POST(req) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const valid = verifyWebhook(
    {
      id: req.headers.get("webhook-id"),
      timestamp: req.headers.get("webhook-timestamp"),
      signature: req.headers.get("webhook-signature"),
    },
    raw,
  );
  if (!valid) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // ack: a retry won't parse either
  }

  const data = event?.data || {};
  const ref = data.metadata?.ref;

  try {
    if (event.type === "payment.succeeded" && ref) {
      const r = await creditPayment({ ref, dodoPaymentId: data.payment_id });
      log("payment_webhook", { ref, known: r.ok, credited: r.credited ?? false });
    } else if (event.type === "payment.failed" && ref) {
      const { count } = await failPayment(ref);
      log("payment_webhook_failed", { ref, marked: count > 0 });
    }
  } catch (err) {
    // DB unreachable etc. 5xx so Dodo redelivers; the credit is not lost.
    logError("payment_webhook_error", err, { ref, type: event?.type });
    return NextResponse.json({ error: "temporary failure" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
