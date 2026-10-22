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
// against the running app itself, which needs plaintext to call the model -
// nor against whoever holds APP_SECRET, since every account's key is still
// deterministically derivable from it. What it does buy: one account's key
// is cryptographically isolated from every other account's, so exposure of
// one derived key (short of the master secret itself) doesn't fan out.
//
// Each account gets its own key, HKDF-derived from APP_SECRET with the
// account number folded into `info` (domain-separated from sign.js, which
// HMACs URLs with the same secret, so the two uses share no key material).
// Same dev fallback as sign.js: process-stable, rotates if DATABASE_URL
// changes.
const SECRET =
  process.env.APP_SECRET ||
  createHash("sha256")
    .update(process.env.DATABASE_URL || "velum-dev-secret")
    .digest("hex");

const IV_LEN = 12;
const TAG_LEN = 16;
const ALGO = "aes-256-gcm";

function keyFor(accountId) {
  if (!accountId) throw new Error("field encryption requires an accountId");
  return Buffer.from(
    hkdfSync("sha256", SECRET, "", `velum-field-encryption:${accountId}`, 32),
  );
}

// -> base64(iv | tag | ciphertext). null/undefined pass through, so callers
// don't need a null check before storing an optional field.
export function encryptText(accountId, plaintext) {
  if (plaintext == null) return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, keyFor(accountId), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64");
}

export function decryptText(accountId, stored) {
  if (stored == null) return stored;
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, keyFor(accountId), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// Same scheme as above but for binary attachment bytes (images, PDFs) stored
// on disk: raw iv | tag | ciphertext, no base64, since it's written straight
// to a file rather than a text column.
export function encryptBuffer(accountId, plaintext) {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, keyFor(accountId), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]);
}

export function decryptBuffer(accountId, stored) {
  const iv = stored.subarray(0, IV_LEN);
  const tag = stored.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = stored.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, keyFor(accountId), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

// self-check: npm test
if (process.argv[1] && process.argv[1].endsWith("crypto.js")) {
  const { default: assert } = await import("node:assert");

  const ACCT = "1111 2222 3333 4444";
  const OTHER = "5555 6666 7777 8888";

  assert.strictEqual(encryptText(ACCT, null), null);
  assert.strictEqual(encryptText(ACCT, undefined), undefined);
  assert.strictEqual(decryptText(ACCT, null), null);

  const enc = encryptText(ACCT, "hello there");
  assert.notStrictEqual(enc, "hello there");
  assert.strictEqual(decryptText(ACCT, enc), "hello there");

  assert.notStrictEqual(encryptText(ACCT, "hello there"), enc); // fresh iv each call
  assert.strictEqual(decryptText(ACCT, encryptText(ACCT, "")), "");

  assert.throws(() => decryptText(ACCT, "not-valid-ciphertext"));

  // a different account's key can't decrypt this account's ciphertext
  assert.throws(() => decryptText(OTHER, enc));

  assert.throws(() => encryptText(null, "x")); // accountId required

  const bufEnc = encryptBuffer(ACCT, Buffer.from([0, 1, 2, 255, 254]));
  assert.deepStrictEqual(decryptBuffer(ACCT, bufEnc), Buffer.from([0, 1, 2, 255, 254]));
  assert.notStrictEqual(
    bufEnc.toString("hex"),
    encryptBuffer(ACCT, Buffer.from([0, 1, 2, 255, 254])).toString("hex"),
  );
  assert.throws(() => decryptBuffer(OTHER, bufEnc));

  console.log("crypto.js self-check OK");
}
