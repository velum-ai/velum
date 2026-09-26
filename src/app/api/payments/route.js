import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { guardRequest, bad } from "@/lib/guard";
import { createPayment } from "@/lib/account";
import { createCheckout, dodoConfigured } from "@/lib/dodo";
import { createInvoice, btcpayConfigured } from "@/lib/btcpay";
import { centsForCredits, isValidPurchase } from "@/lib/pricing";
import { maskAccount } from "@/lib/mask";
import { logError } from "@/lib/logger";
import { site } from "@/config/site";


// Open a hosted checkout for a credit top-up: Dodo (card, wallets, bank debit, etc.) or BTCPay (Monero).
// Either way we record a pending Payment row before redirecting the browser;
// the webhook / return-url verify grants the credits on success.
export async function POST(req) {
  const { account, credits, method: rawMethod } = await req.json().catch(() => ({}));
  const method = rawMethod === "btcpay" ? "BTCPAY" : "DODO";

  if (method === "BTCPAY" ? !btcpayConfigured() : !dodoConfigured()) {
    return bad("payments are not available", 503);
  }

  const g = await guardRequest(req, {
    key: "payments",
    limit: 10,
    windowMs: 60 * 60_000, // 10 / hour / ip
    account,
  });
  if (g.error) return bad(g.error, g.status);

  const n = Number(credits);
  if (!isValidPurchase(n)) return bad("invalid amount", 400);

  const ref = randomUUID();
  // site.url is a normalised absolute origin (see config/site.js); the request
  // origin is only a fallback for a misconfigured deploy.
  const origin = site.url || req.nextUrl.origin;
  const amountCents = centsForCredits(n);

  let checkout;
  try {
    checkout =
      method === "BTCPAY"
        ? await createInvoice({ credits: n, amountCents, ref, returnUrl: `${origin}/account` })
        : await createCheckout({ credits: n, ref, returnUrl: `${origin}/account` });
  } catch (err) {
    logError("payment_checkout_failed", err, { account: maskAccount(account), method });
    return bad("could not start payment", 502);
  }

  try {
    await createPayment({
      id: ref,
      accountId: account,
      method,
      dodoCheckoutId: method === "DODO" ? checkout.sessionId : undefined,
      btcpayInvoiceId: method === "BTCPAY" ? checkout.invoiceId : undefined,
      amountCents,
      credits: n,
    });
  } catch (err) {
    // Checkout exists at the provider but we failed to record it. Loud log so
    // it can be reconciled; the user sees an error rather than a broken redirect.
    logError("payment_checkout_orphaned", err, {
      method,
      providerId: checkout.sessionId || checkout.invoiceId,
      credits: n,
    });
    return bad("could not start payment", 502);
  }

  return NextResponse.json({ checkoutUrl: checkout.checkoutUrl, credits: n });
}
