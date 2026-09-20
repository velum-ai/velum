import { createHmac, createHash, timingSafeEqual } from "node:crypto";

// Short signed tokens for URLs the browser must fetch without sending the
// account number (attachment <img> src). The server mints a token bound to one
// id; the attachment route verifies it and needs no other auth.
//
// APP_SECRET should be set in production. The fallback keeps dev working and is
// still process-stable (derived from DATABASE_URL), but rotates if that changes.
const SECRET =
  process.env.APP_SECRET ||
  createHash("sha256")
    .update(process.env.DATABASE_URL || "velum-dev-secret")
    .digest("hex");

const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

const b64url = (buf) =>
  Buffer.from(buf).toString("base64url");

const sig = (payload) =>
  createHmac("sha256", SECRET).update(payload).digest("base64url");

// -> "<id>.<expiryMs>.<sig>"
export function signId(id, ttlMs = DEFAULT_TTL_MS) {
  const exp = Date.now() + ttlMs;
  const payload = `${b64url(id)}.${exp}`;
  return `${payload}.${sig(payload)}`;
}

// token -> id, or null if malformed / bad signature / expired.
export function verifyId(token) {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3) return null;
  const [idPart, expPart, given] = parts;
  const payload = `${idPart}.${expPart}`;

  const want = Buffer.from(sig(payload));
  const got = Buffer.from(given);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;

  if (!Number(expPart) || Date.now() > Number(expPart)) return null;
  try {
    return Buffer.from(idPart, "base64url").toString("utf8") || null;
  } catch {
    return null;
  }
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("sign.js")) {
  const { default: assert } = await import("node:assert");

  const t = signId("abc-123");
  assert.strictEqual(verifyId(t), "abc-123");
  assert.strictEqual(verifyId(t + "x"), null);
  assert.strictEqual(verifyId("a.b.c"), null);
  assert.strictEqual(verifyId(signId("x", -1000)), null); // already expired
  assert.strictEqual(verifyId(""), null);

  console.log("sign.js self-check OK");
}
