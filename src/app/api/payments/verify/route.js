import { NextResponse } from "next/server";
import { guardRequest, bad } from "@/lib/guard";
import { creditPayment, failPayment, paymentRefForInvoice } from "@/lib/account";
import { getPayment, dodoConfigured } from "@/lib/dodo";
import { getInvoice, btcpayConfigured } from "@/lib/btcpay";
import { maskAccount } from "@/lib/mask";
import { log } from "@/lib/logger";

const PAYMENT_ID = /^pay_[A-Za-z0-9_-]{6,}$/;
const INVOICE_ID = /^[A-Za-z0-9]{6,}$/;

// Called by the browser when the provider redirects back to /account with
// either ?payment_id= (Dodo) or ?btcpay_invoice= (BTCPay). Confirms with the
// provider and credits immediately; the webhook is the durable backstop.
// Both funnel through the idempotent creditPayment(), so a slow or failed
// call here only delays the UI, it never loses or double-grants credit.
export async function POST(req) {
  const { account, paymentId, btcpayInvoiceId } = await req.json().catch(() => ({}));

  const g = await guardRequest(req, {
    key: "payments-verify",
    limit: 20,
    windowMs: 60 * 60_000,
    account,
  });
  if (g.error) return bad(g.error, g.status);

  if (btcpayInvoiceId) return verifyBtcpay(account, btcpayInvoiceId);
  return verifyDodo(account, paymentId);
}

async function verifyDodo(account, paymentId) {
  if (!dodoConfigured()) return bad("payments are not available", 503);
  if (!PAYMENT_ID.test(String(paymentId || ""))) return bad("missing fields", 400);

  const payment = await getPayment(paymentId);
  if (!payment) return bad("unknown payment", 404);
  if (payment.transient) return NextResponse.json({ ok: false, pending: true });

  if (payment.status === "failed") {
    if (payment.metadata?.ref) await failPayment(payment.metadata.ref).catch(() => {});
    return NextResponse.json({ ok: false, failed: true });
  }
  if (payment.status !== "succeeded") {
    return NextResponse.json({ ok: false, pending: true });
  }

  const ref = payment.metadata?.ref;
  if (!ref) return bad("unknown payment", 404);

  let r;
  try {
    r = await creditPayment({ ref, dodoPaymentId: paymentId, expectAccount: account });
  } catch {
    return NextResponse.json({ ok: false, pending: true }); // webhook will settle it
  }
  if (!r.ok) return bad("unknown payment", 404);

  log("payment_verified", { account: maskAccount(account), method: "dodo", credited: r.credited });
  return NextResponse.json({ ok: true, balance: r.balance, granted: r.granted ?? 0 });
}

async function verifyBtcpay(account, invoiceId) {
  if (!btcpayConfigured()) return bad("payments are not available", 503);
  if (!INVOICE_ID.test(String(invoiceId || ""))) return bad("missing fields", 400);

  const invoice = await getInvoice(invoiceId);
  if (!invoice) return bad("unknown payment", 404);
  if (invoice.transient) return NextResponse.json({ ok: false, pending: true });

  const row = await paymentRefForInvoice(invoiceId);
  if (!row) return bad("unknown payment", 404);

  if (invoice.status === "Expired" || invoice.status === "Invalid") {
    await failPayment(row.id).catch(() => {});
    return NextResponse.json({ ok: false, failed: true });
  }
  if (invoice.status !== "Settled") {
    return NextResponse.json({ ok: false, pending: true });
  }

  let r;
  try {
    r = await creditPayment({ ref: row.id, expectAccount: account });
  } catch {
    return NextResponse.json({ ok: false, pending: true }); // webhook will settle it
  }
  if (!r.ok) return bad("unknown payment", 404);

  log("payment_verified", { account: maskAccount(account), method: "btcpay", credited: r.credited });
  return NextResponse.json({ ok: true, balance: r.balance, granted: r.granted ?? 0 });
}
