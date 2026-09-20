import { createHmac, timingSafeEqual } from "node:crypto";
import { isTransient, wait } from "@/lib/httpRetry";

// The only module that knows Dodo Payments' wire format: checkout session
// creation, single-payment lookup, and Standard Webhooks signature verification.
// Dodo is a merchant of record, so checkout is a full-page redirect to their
// hosted page and the webhook is the durable source of truth.

const RAW_MODE = String(process.env.DODO_MODE || "test").toLowerCase().trim();
const MODE = RAW_MODE === "live" ? "live" : "test";
const BASE = (
  process.env.DODO_API_BASE || `https://${MODE}.dodopayments.com`
).replace(/\/$/, "");
const TIMEOUT_MS = Number(process.env.DODO_TIMEOUT_MS) || 10_000;

const KEY = process.env.DODO_API_KEY || "";
const PRODUCT_ID = process.env.DODO_PRODUCT_ID || "";
const webhookSecret = () => process.env.DODO_WEBHOOK_SECRET || "";

// Credits granted per unit of the Dodo product. Default: a $1.00 product = 100
// credits, so quantity = credits / 100.
export const CREDITS_PER_UNIT =
  Math.max(1, Math.round(Number(process.env.DODO_CREDITS_PER_UNIT) || 100));

// Config health, surfaced in the boot log and /api/health. `configured` is what
// the payment routes gate on; `warnings` are non-fatal but worth seeing.
export function dodoStatus() {
  const warnings = [];
  if (process.env.DODO_MODE && RAW_MODE !== "test" && RAW_MODE !== "live") {
    warnings.push(`DODO_MODE "${process.env.DODO_MODE}" is not test/live; using test`);
  }
  if (MODE === "live" && !webhookSecret()) {
    warnings.push("live mode without DODO_WEBHOOK_SECRET: webhook events will 401");
  }
  return {
    configured: Boolean(KEY && PRODUCT_ID),
    mode: MODE,
    webhook: Boolean(webhookSecret()),
    warnings,
  };
}

export const dodoConfigured = () => Boolean(KEY && PRODUCT_ID);

// --- HTTP -----------------------------------------------------------------

// One JSON call to Dodo with a hard timeout. `retry` re-attempts once on a
// network drop or 502/503/504. Safe for GETs; the checkout POST also passes it
// because a stray extra session is harmless (creditPayment is idempotent on
// ref) and a lost checkout would otherwise strand the user.
async function dodoFetch(path, { method = "GET", body, retry = false } = {}) {
  const call = () =>
    fetch(`${BASE}${path}`, {
      method,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${KEY}`,
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

// --- checkout ------------------------------------------------------------

// Open a hosted checkout. `ref` is our Payment row id; it comes back to us in
// the webhook and the payment's metadata so both settle paths find the row.
export async function createCheckout({ credits, ref, returnUrl }) {
  const quantity = Math.round(credits / CREDITS_PER_UNIT);
  if (!Number.isInteger(quantity) || quantity < 1) {
    throw new Error(`dodo checkout: bad quantity ${quantity} for ${credits} credits`);
  }

  const res = await dodoFetch("/checkouts", {
    method: "POST",
    retry: true,
    body: {
      product_cart: [{ product_id: PRODUCT_ID, quantity }],
      return_url: returnUrl,
      metadata: { ref, credits: String(credits) },
      // Dodo is a merchant of record and needs an email for the receipt, so
      // that field stays. Phone number and tax id are not required for a $1-5
      // top-up; skip asking for them.
      feature_flags: { allow_phone_number_collection: false, allow_tax_id: false },
    },
  });

  if (!res.ok) {
    throw new Error(`dodo checkout ${res.status}: ${await res.text().catch(() => "")}`);
  }
  const data = await res.json().catch(() => ({}));
  if (!data.checkout_url) {
    throw new Error("dodo checkout: response has no checkout_url");
  }
  return {
    sessionId:
      data.session_id ||
      data.checkout_url.match(/\/session\/([^/?#]+)/)?.[1] ||
      ref,
    checkoutUrl: data.checkout_url,
    paymentId: data.payment_id || null,
  };
}

// Authoritative status for one payment (the return-url confirm path). Returns
// null for a genuine 404, { transient: true } for a network drop or 5xx (so the
// caller says "processing" rather than "unknown"), and the payment otherwise.
export async function getPayment(paymentId) {
  let res;
  try {
    res = await dodoFetch(`/payments/${encodeURIComponent(paymentId)}`, {
      retry: true,
    });
  } catch {
    return { transient: true };
  }
  if (res.status === 404) return null;
  if (!res.ok) return { transient: true };

  const d = await res.json().catch(() => null);
  if (!d) return { transient: true };
  return {
    status: d.status, // "succeeded" | "processing" | "failed"
    amountCents: d.settlement_amount ?? d.total_amount ?? null,
    metadata: d.metadata || {},
  };
}

// --- Standard Webhooks signature (https://www.standardwebhooks.com) ---------

const TOLERANCE_S = 5 * 60;

function secretKey() {
  const raw = webhookSecret();
  const b64 = raw.startsWith("whsec_") ? raw.slice(6) : raw;
  try {
    const buf = Buffer.from(b64, "base64");
    if (buf.length) return buf;
  } catch {
    /* fall through */
  }
  return Buffer.from(raw, "utf8");
}

const sign = (id, ts, body) =>
  createHmac("sha256", secretKey()).update(`${id}.${ts}.${body}`).digest("base64");

const eq = (a, b) => {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

// rawBody must be the exact bytes received. Returns true only on a good,
// in-tolerance signature.
export function verifyWebhook({ id, timestamp, signature }, rawBody) {
  if (!webhookSecret() || !id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(Date.now() / 1000 - ts) > TOLERANCE_S) {
    return false;
  }

  const expected = sign(id, timestamp, rawBody);
  return String(signature)
    .split(" ")
    .map((part) => (part.includes(",") ? part.split(",")[1] : part))
    .some((sig) => sig && eq(sig, expected));
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("dodo.js")) {
  const { default: assert } = await import("node:assert");

  process.env.DODO_WEBHOOK_SECRET = "whsec_" + Buffer.from("test-secret").toString("base64");
  const id = "msg_1";
  const ts = String(Math.floor(Date.now() / 1000));
  const body = '{"type":"payment.succeeded","data":{"payment_id":"pay_1"}}';
  const good = createHmac("sha256", Buffer.from("test-secret"))
    .update(`${id}.${ts}.${body}`)
    .digest("base64");

  assert.strictEqual(verifyWebhook({ id, timestamp: ts, signature: `v1,${good}` }, body), true);
  assert.strictEqual(verifyWebhook({ id, timestamp: ts, signature: good }, body), true);
  assert.strictEqual(verifyWebhook({ id, timestamp: ts, signature: "v1,deadbeef" }, body), false);
  assert.strictEqual(verifyWebhook({ id, timestamp: ts, signature: `v1,${good}` }, body + "x"), false);
  assert.strictEqual(
    verifyWebhook({ id, timestamp: String(Number(ts) - 9999), signature: `v1,${good}` }, body),
    false,
  );
  assert.strictEqual(verifyWebhook({ id, timestamp: ts, signature: "" }, body), false);

  const st = dodoStatus();
  assert.deepStrictEqual(
    [typeof st.configured, typeof st.mode, Array.isArray(st.warnings)],
    ["boolean", "string", true],
  );
  assert.strictEqual(st.mode, "test");
  assert.strictEqual(isTransient({ name: "TimeoutError" }), true);
  assert.strictEqual(isTransient({ cause: { code: "ECONNRESET" } }), true);
  assert.strictEqual(isTransient(new Error("nope")), false);
  assert.strictEqual(CREDITS_PER_UNIT, 100);

  console.log("dodo.js self-check OK");
}
