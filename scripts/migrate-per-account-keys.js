// One-time re-encryption: moves every encrypted row from the old single
// global field-encryption key to the new per-account key (see
// src/lib/crypto.js - keyFor() now folds the account number into HKDF info).
// Must run exactly once, after the per-account crypto.js lands but before
// (or during a maintenance window around) deploying it, since old rows are
// unreadable under the new code until migrated. Safe to re-run: a row that
// already decrypts under its account's new key is left untouched, so an
// interrupted run can just be started again.
//
//   npm run db:migrate-per-account-keys            # show what would change
//   npm run db:migrate-per-account-keys -- --yes   # actually re-encrypt
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createDecipheriv, createHash, hkdfSync } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import { encryptText, decryptText, encryptBuffer, decryptBuffer } from "@/lib/crypto";
import { attachmentExt } from "@/lib/storage";

const dbUrl = (() => {
  const base = process.env.DATABASE_URL || "";
  if (!base) return base;
  try {
    const u = new URL(base);
    u.searchParams.set("connection_limit", "1");
    return u.toString();
  } catch {
    return base;
  }
})();

const prisma = new PrismaClient({ datasourceUrl: dbUrl });
const commit = process.argv.includes("--yes");

const DATA_DIR = process.env.DATA_DIR || "./.data";
const DIR = path.join(DATA_DIR, "attachments");

// --- old scheme: exactly what crypto.js did before per-account keys -------
const SECRET =
  process.env.APP_SECRET ||
  createHash("sha256")
    .update(process.env.DATABASE_URL || "velum-dev-secret")
    .digest("hex");
const OLD_KEY = Buffer.from(hkdfSync("sha256", SECRET, "", "velum-field-encryption", 32));
const IV_LEN = 12;
const TAG_LEN = 16;
const ALGO = "aes-256-gcm";

function oldDecryptText(stored) {
  const buf = Buffer.from(stored, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, OLD_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function oldDecryptBuffer(stored) {
  const iv = stored.subarray(0, IV_LEN);
  const tag = stored.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ciphertext = stored.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, OLD_KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
// ---------------------------------------------------------------------------

// A row already under the new per-account key decrypts fine with the new
// scheme; one still under the old global key doesn't (different key -> GCM
// auth tag fails) but does decrypt under OLD_KEY. Anything that decrypts
// under neither is corrupt/foreign and is reported, never touched.
function migrated(accountId, value) {
  try {
    decryptText(accountId, value);
    return true;
  } catch {
    return false;
  }
}

async function migrateTextField(label, rows, accountOf, field, update) {
  let done = 0;
  let pending = 0;
  let unreadable = 0;
  for (const row of rows) {
    const value = row[field];
    if (value == null) continue;
    const accountId = accountOf(row);
    if (migrated(accountId, value)) {
      done += 1;
      continue;
    }
    let plaintext;
    try {
      plaintext = oldDecryptText(value);
    } catch (err) {
      unreadable += 1;
      console.error(`  ${label} ${row.id}: unreadable under old key either - ${err.message}`);
      continue;
    }
    pending += 1;
    if (commit) {
      await update(row, encryptText(accountId, plaintext));
    }
  }
  console.log(
    `${label}: ${done} already migrated, ${pending} to migrate${unreadable ? `, ${unreadable} unreadable (left untouched)` : ""}`,
  );
}

const accounts = await prisma.account.findMany({
  select: { number: true, systemPrompt: true },
});
const chats = await prisma.chat.findMany({
  select: { id: true, title: true, accountId: true },
});
const messages = await prisma.message.findMany({
  select: { id: true, content: true, reasoning: true, chat: { select: { accountId: true } } },
});
const attachments = await prisma.attachment.findMany({
  select: { id: true, mime: true, accountId: true },
});

await migrateTextField(
  "Account.systemPrompt",
  accounts,
  (a) => a.number,
  "systemPrompt",
  (row, systemPrompt) =>
    prisma.account.update({ where: { number: row.number }, data: { systemPrompt } }),
);

await migrateTextField(
  "Chat.title",
  chats,
  (c) => c.accountId,
  "title",
  (row, title) => prisma.chat.update({ where: { id: row.id }, data: { title } }),
);

await migrateTextField(
  "Message.content",
  messages,
  (m) => m.chat.accountId,
  "content",
  (row, content) => prisma.message.update({ where: { id: row.id }, data: { content } }),
);

await migrateTextField(
  "Message.reasoning",
  messages,
  (m) => m.chat.accountId,
  "reasoning",
  (row, reasoning) => prisma.message.update({ where: { id: row.id }, data: { reasoning } }),
);

// attachment files on disk - same old-key-detect / new-key-write shape, but
// reading/writing files instead of DB rows
let attDone = 0;
let attPending = 0;
let attMissing = 0;
let attUnreadable = 0;
for (const row of attachments) {
  const file = path.join(DIR, `${row.id}.${attachmentExt(row.mime)}`);
  let buf;
  try {
    buf = await readFile(file);
  } catch {
    attMissing += 1;
    continue;
  }
  try {
    decryptBuffer(row.accountId, buf);
    attDone += 1;
    continue;
  } catch {
    /* not under the new key yet, fall through */
  }
  let plaintext;
  try {
    plaintext = oldDecryptBuffer(buf);
  } catch (err) {
    attUnreadable += 1;
    console.error(`  Attachment ${row.id}: unreadable under old key either - ${err.message}`);
    continue;
  }
  attPending += 1;
  if (commit) await writeFile(file, encryptBuffer(row.accountId, plaintext));
}
console.log(
  `Attachment files: ${attDone} already migrated, ${attPending} to migrate` +
    `${attMissing ? `, ${attMissing} missing on disk` : ""}` +
    `${attUnreadable ? `, ${attUnreadable} unreadable (left untouched)` : ""}`,
);

console.log(commit ? "\ndone." : "\ndry run. re-run with --yes to migrate the above.");
await prisma.$disconnect();
