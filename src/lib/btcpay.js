import { createHmac, timingSafeEqual } from "node:crypto";
import { isTransient, wait } from "@/lib/httpRetry";

// The only module that knows BTCPay Server's wire format: invoice creation,
// single-invoice lookup, and webhook signature verification. BTCPay is
// self-hosted and non-custodial (we hold the wallet, not a processor), used
// for the privacy-focused payment path (Monero). See dodo.js for the card
// path; the two are independent providers behind one Payment table.

const BASE = (process.env.BTCPAY_URL || "").replace(/\/$/, "");
const STORE_ID = process.env.BTCPAY_STORE_ID || "";
const KEY = process.env.BTCPAY_API_KEY || "";
const webhookSecret = () => process.env.BTCPAY_WEBHOOK_SECRET || "";
const TIMEOUT_MS = Number(process.env.BTCPAY_TIMEOUT_MS) || 10_000;

export function btcpayStatus() {
  const warnings = [];
  if (btcpayConfigured() && !webhookSecret()) {
    warnings.push("BTCPAY configured without BTCPAY_WEBHOOK_SECRET: webhook events will 401");
  }
  return { configured: btcpayConfigured(), webhook: Boolean(webhookSecret()), warnings };
}

export const btcpayConfigured = () => Boolean(BASE && STORE_ID && KEY);

// --- HTTP -------------------------------------------------------------------

async function btcpayFetch(path, { method = "GET", body, retry = false } = {}) {
  const call = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `token ${KEY}`,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });

  let res;
  try {
    res = await call();
  } catch (err) {
    if (!(retry && isTransient(err))) throw err;
    await wait(300);
    res = await call();
  }

  if (retry && [502, 503, 504].includes(res.status)) {
    await wait(300);
    res = await call();
  }
  return res;
}

// --- invoices ---------------------------------------------------------------

// Open a hosted invoice. `ref` is our Payment row id; BTCPay's redirect
// checkout supports a `{InvoiceId}` placeholder in redirectURL, so the browser
// comes back carrying the invoice id and we look the Payment row up by it
// (see account.paymentRefForInvoice) rather than round-tripping metadata.
export async function createInvoice({ credits, amountCents, ref, returnUrl }) {
  const res = await btcpayFetch(`/api/v1/stores/${STORE_ID}/invoices`, {
    method: "POST",
    retry: true,
    body: {
      amount: (amountCents / 100).toFixed(2),
      currency: "USD",
      metadata: { ref, credits: String(credits) },
      checkout: {
        redirectURL: `${returnUrl}${returnUrl.includes("?") ? "&" : "?"}btcpay_invoice={InvoiceId}`,
        defaultPaymentMethod: "XMR",
      },
    },
  });

  if (!res.ok) {
    throw new Error(`btcpay invoice ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!data.id || !data.checkoutLink) {
    throw new Error("btcpay invoice: response missing id/checkoutLink");
  }
  return { invoiceId: data.id, checkoutUrl: data.checkoutLink };
}

// Authoritative status for one invoice (the return-url confirm path). Returns
// null for a genuine 404, { transient: true } for a network drop or 5xx.
export async function getInvoice(invoiceId) {
  let res;
  try {
    res = await btcpayFetch(`/api/v1/stores/${STORE_ID}/invoices/${encodeURIComponent(invoiceId)}`, {
      retry: true,
    });
  } catch {
    return { transient: true };
  }
  if (res.status === 404) return null;
  if (!res.ok) return { transient: true };

  const d = await res.json().catch(() => null);
  if (!d) return { transient: true };
  // "Settled" = confirmed on-chain per the store's speed policy. "Processing"
  // means seen but not yet confirmed - not enough to grant credit.
  return { status: d.status, amountCents: Math.round(Number(d.amount) * 100) || null };
}

// --- webhook signature (BTCPay-Sig: sha256=<hmac>) --------------------------

const sign = (body) =>
  createHmac("sha256", webhookSecret()).update(body).digest("hex");

const eq = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// rawBody must be the exact bytes received.
export function verifyWebhook(signatureHeader, rawBody) {
  if (!webhookSecret() || !signatureHeader) return false;
  const given = String(signatureHeader).startsWith("sha256=")
    ? signatureHeader.slice(7)
    : signatureHeader;
  return eq(given, sign(rawBody));
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("btcpay.js")) {
  const { default: assert } = await import("node:assert");

  process.env.BTCPAY_WEBHOOK_SECRET = "test-secret";
  const body = '{"type":"InvoiceSettled","invoiceId":"inv_1"}';
  const goodSig = "sha256=" + createHmac("sha256", "test-secret").update(body).digest("hex");

  assert.strictEqual(verifyWebhook(goodSig, body), true);
  assert.strictEqual(verifyWebhook("sha256=deadbeef", body), false);
  assert.strictEqual(verifyWebhook(goodSig, body + "x"), false);
  assert.strictEqual(verifyWebhook("", body), false);

  assert.strictEqual(btcpayConfigured(), false); // BTCPAY_URL/STORE_ID/KEY unset in test
  const st = btcpayStatus();
  assert.deepStrictEqual(
    [typeof st.configured, typeof st.webhook, Array.isArray(st.warnings)],
    ["boolean", "boolean", true],
  );
  assert.strictEqual(isTransient({ name: "TimeoutError" }), true);
  assert.strictEqual(isTransient({ cause: { code: "ECONNRESET" } }), true);
  assert.strictEqual(isTransient(new Error("nope")), false);

  console.log("btcpay.js self-check OK");
}
