// One-off: import a legacy data/db.json blob into Postgres. Idempotent-ish -
// skips accounts that already exist. Run once after the first migration.
//
//   DATABASE_URL=postgres://... npm run import:legacy [path/to/db.json]
import { readFile } from "node:fs/promises";
import { prisma } from "@/lib/prisma";

const path = process.argv[2] || "data/db.json";
const { accounts = {} } = JSON.parse(await readFile(path, "utf8"));

let a = 0;
let c = 0;
let m = 0;

for (const [number, rec] of Object.entries(accounts)) {
  if (await prisma.account.findUnique({ where: { number }, select: { number: true } })) {
    continue;
  }
  await prisma.$transaction(async (tx) => {
    await tx.account.create({
      data: {
        number,
        credits: Number(rec.credits) || 0,
        createdAt: new Date(Number(rec.createdAt) || Date.now()),
      },
    });
    for (const chat of rec.chats || []) {
      const ts = new Date(Number(chat.createdAt) || Date.now());
      await tx.chat.create({
        data: {
          id: chat.id,
          accountId: number,
          title: chat.title || "chat",
          spent: Number(chat.spent) || 0,
          createdAt: ts,
          updatedAt: ts,
          messages: {
            create: (chat.messages || []).map((msg) => ({
              role: msg.role || "user",
              content: String(msg.content ?? ""),
              createdAt: ts,
            })),
          },
        },
      });
      c += 1;
      m += (chat.messages || []).length;
    }
  });
  a += 1;
}

console.log(`imported ${a} accounts, ${c} chats, ${m} messages`);
await prisma.$disconnect();
