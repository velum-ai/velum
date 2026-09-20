// One-time backfill: encrypt any plaintext Message.content/reasoning,
// Chat.title, and Account.systemPrompt left over from before field-level
// encryption (see src/lib/crypto.js). Safe to re-run: a row that already
// decrypts is left untouched. Dry run by default; pass --yes to write.
//
//   npm run db:encrypt-existing            # show what would change
//   npm run db:encrypt-existing -- --yes   # encrypt it
import { PrismaClient } from "@prisma/client";
import { encryptText, decryptText } from "../src/lib/crypto.js";

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

const isPlaintext = (value) => {
  if (value == null) return false;
  try {
    decryptText(value);
    return false; // decrypts cleanly - already encrypted
  } catch {
    return true;
  }
};

async function migrate(label, rows, field, update) {
  const targets = rows.filter((r) => isPlaintext(r[field]));
  console.log(`${label}: ${targets.length} of ${rows.length} plaintext`);
  if (!commit) return;
  for (const row of targets) {
    await update(row.id, encryptText(row[field]));
  }
}

const accounts = await prisma.account.findMany({ select: { number: true, systemPrompt: true } });
const chats = await prisma.chat.findMany({ select: { id: true, title: true } });
const messages = await prisma.message.findMany({
  select: { id: true, content: true, reasoning: true },
});

await migrate(
  "Account.systemPrompt",
  accounts.map((a) => ({ id: a.number, systemPrompt: a.systemPrompt })),
  "systemPrompt",
  (id, systemPrompt) => prisma.account.update({ where: { number: id }, data: { systemPrompt } }),
);

await migrate("Chat.title", chats, "title", (id, title) =>
  prisma.chat.update({ where: { id }, data: { title } }),
);

await migrate("Message.content", messages, "content", (id, content) =>
  prisma.message.update({ where: { id }, data: { content } }),
);

await migrate(
  "Message.reasoning",
  messages.filter((m) => m.reasoning != null),
  "reasoning",
  (id, reasoning) => prisma.message.update({ where: { id }, data: { reasoning } }),
);

console.log(commit ? "\ndone." : "\ndry run. re-run with --yes to encrypt the above.");
await prisma.$disconnect();
