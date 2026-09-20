import { NextResponse } from "next/server";
import { creditPayment, failPayment, paymentRefForInvoice } from "@/lib/account";
import { verifyWebhook } from "@/lib/btcpay";
import { log, logError } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MAX_BODY = 64 * 1024;

// BTCPay Server -> us. The durable source of truth for settled Monero
// invoices, mirroring src/app/api/payments/webhook (Dodo). Must read the RAW
// body for the HMAC, so never call req.json() here. A transient failure
// returns 5xx so BTCPay redelivers.
export async function POST(req) {
  const raw = await req.text();
  if (raw.length > MAX_BODY) {
    return NextResponse.json({ error: "payload too large" }, { status: 413 });
  }

  const valid = verifyWebhook(req.headers.get("btcpay-sig"), raw);
  if (!valid) {
    return NextResponse.json({ error: "bad signature" }, { status: 401 });
  }

  let event;
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: true }); // ack: a retry won't parse either
  }

  const invoiceId = event?.invoiceId;
  if (!invoiceId) return NextResponse.json({ ok: true });

  try {
    const row = await paymentRefForInvoice(invoiceId);
    if (!row) return NextResponse.json({ ok: true }); // unknown invoice, nothing to do

    if (event.type === "InvoiceSettled") {
      const r = await creditPayment({ ref: row.id });
      log("payment_webhook", { method: "btcpay", ref: row.id, known: r.ok, credited: r.credited ?? false });
    } else if (event.type === "InvoiceExpired" || event.type === "InvoiceInvalid") {
      const { count } = await failPayment(row.id);
      log("payment_webhook_failed", { method: "btcpay", ref: row.id, marked: count > 0 });
    }
  } catch (err) {
    // DB unreachable etc. 5xx so BTCPay redelivers; the credit is not lost.
    logError("payment_webhook_error", err, { method: "btcpay", invoiceId, type: event?.type });
    return NextResponse.json({ error: "temporary failure" }, { status: 503 });
  }

  return NextResponse.json({ ok: true });
}
