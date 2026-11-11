// One-time backfill: encrypt any plaintext Project.name and Attachment.name
// left over from before these fields were encrypted (see src/lib/crypto.js
// - per-account keys, same scheme as Chat.title/Message.content). Safe to
// re-run: a value that already decrypts under its account's key is left
// untouched.
//
//   npm run db:encrypt-project-attachment-names            # dry run
//   npm run db:encrypt-project-attachment-names -- --yes   # write it
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { encryptText, decryptText } from "@/lib/crypto";

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

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: dbUrl }) });
const commit = process.argv.includes("--yes");

const isPlaintext = (accountId, value) => {
  if (value == null) return false;
  try {
    decryptText(accountId, value);
    return false; // decrypts cleanly under this account's key - already done
  } catch {
    return true;
  }
};

async function migrate(label, rows, field, update) {
  const targets = rows.filter((r) => isPlaintext(r.accountId, r[field]));
  console.log(`${label}: ${targets.length} of ${rows.length} plaintext`);
  if (!commit) return;
  for (const row of targets) {
    await update(row, encryptText(row.accountId, row[field]));
  }
}

const projects = await prisma.project.findMany({
  select: { id: true, accountId: true, name: true },
});
const attachments = await prisma.attachment.findMany({
  where: { name: { not: null } },
  select: { id: true, accountId: true, name: true },
});

await migrate("Project.name", projects, "name", (row, name) =>
  prisma.project.update({ where: { id: row.id }, data: { name } }),
);

await migrate("Attachment.name", attachments, "name", (row, name) =>
  prisma.attachment.update({ where: { id: row.id }, data: { name } }),
);

console.log(commit ? "\ndone." : "\ndry run. re-run with --yes to encrypt the above.");
await prisma.$disconnect();
