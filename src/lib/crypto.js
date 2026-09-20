import {
  createCipheriv,
  createDecipheriv,
  createHash,
  hkdfSync,
  randomBytes,
} from "node:crypto";

// Field-level encryption for stored chat content (Message.content/reasoning,
// Chat.title, Account.systemPrompt). Protects a DB leak, a stolen backup, or
// the host's own tooling from reading conversations; it does not protect
// against the running app itself, which needs plaintext to call the model.
//
// The key is derived from APP_SECRET via HKDF, domain-separated from sign.js
// (which HMACs URLs with the same secret) so the two uses share no key
// material. Same dev fallback as sign.js: process-stable, rotates if
// DATABASE_URL changes.
const SECRET =
  process.env.APP_SECRET ||
  createHash("sha256")
    .update(process.env.DATABASE_URL || "velum-dev-secret")
    .digest("hex");

const KEY = Buffer.from(hkdfSync("sha256", SECRET, "", "velum-field-encryption", 32));

const IV_LEN = 12;
const TAG_LEN = 16;
const ALGO = "aes-256-gcm";

// -> base64(iv | tag | ciphertext). null/undefined pass through, so callers
// don't need a null check before storing an optional field.
export function encryptText(plaintext) {
  if (plaintext == null) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptText(stored) {
  if (stored == null) return stored;
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("crypto.js")) {
  const { default: assert } = await import("node:assert");

  assert.strictEqual(encryptText(null), null);
  assert.strictEqual(encryptText(undefined), undefined);
  assert.strictEqual(decryptText(null), null);

  const enc = encryptText("hello there");
  assert.notStrictEqual(enc, "hello there");
  assert.strictEqual(decryptText(enc), "hello there");

  assert.notStrictEqual(encryptText("hello there"), enc); // fresh iv each call
  assert.strictEqual(decryptText(encryptText("")), "");

  assert.throws(() => decryptText("not-valid-ciphertext"));

  console.log("crypto.js self-check OK");
}
