// One-time backfill: encrypt any plaintext attachment files left on disk
// from before attachment encryption (see src/lib/storage.js, src/lib/crypto.js).
// Safe to re-run: a file that already decrypts is left untouched. Run this on
// whatever host actually holds DATA_DIR (in Docker, `docker compose exec`).
// Dry run by default; pass --yes to write.
//
//   npm run db:encrypt-attachments            # show what would change
//   npm run db:encrypt-attachments -- --yes   # encrypt it
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { encryptBuffer, decryptBuffer } from "../src/lib/crypto.js";

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

const MIME_EXT = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/pdf": "pdf",
};
const extFor = (mime) => MIME_EXT[mime] || "bin";

const isPlaintext = (buf) => {
  try {
    decryptBuffer(buf);
    return false; // decrypts cleanly - already encrypted
  } catch {
    return true;
  }
};

const rows = await prisma.attachment.findMany({ select: { id: true, mime: true } });
let plaintextCount = 0;
let missing = 0;

for (const row of rows) {
  const file = path.join(DIR, `${row.id}.${extFor(row.mime)}`);
  let buf;
  try {
    buf = await readFile(file);
  } catch {
    missing += 1;
    continue;
  }
  if (!isPlaintext(buf)) continue;
  plaintextCount += 1;
  if (commit) await writeFile(file, encryptBuffer(buf));
}

console.log(`${plaintextCount} of ${rows.length} plaintext${missing ? ` (${missing} files missing on disk)` : ""}`);
console.log(commit ? "\ndone." : "\ndry run. re-run with --yes to encrypt the above.");
await prisma.$disconnect();
