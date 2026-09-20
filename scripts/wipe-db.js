// Delete every row from the database and every stored attachment file.
// Destructive and irreversible. Runs as a dry run by default (prints the row
// counts it would remove); pass --yes to actually wipe.
//
//   npm run db:wipe            # show what is there
//   npm run db:wipe -- --yes   # delete all of it
//
// Point DATABASE_URL at the database you mean to wipe. The host is printed
// before anything happens.
import { PrismaClient } from "@prisma/client";
import { rm } from "node:fs/promises";
import path from "node:path";

// A dedicated client capped at one connection, so this runs even when the app's
// pool is already near the Supabase session-pooler client limit.
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

// Child rows first, then parents. TRUNCATE ... CASCADE would cover the order on
// its own, but listing every table keeps this honest if a relation changes.
const TABLES = [
  "Attachment",
  "Message",
  "Reservation",
  "Payment",
  "Chat",
  "RateLimit",
  "Account",
];

const DATA_DIR = process.env.DATA_DIR || "./.data";

const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL).host;
  } catch {
    return "unknown";
  }
})();

// Sequential, so the whole script only ever holds its one connection.
const accounts = await prisma.account.count();
const chats = await prisma.chat.count();
const messages = await prisma.message.count();
const attachments = await prisma.attachment.count();
const reservations = await prisma.reservation.count();
const payments = await prisma.payment.count();
const rateLimits = await prisma.rateLimit.count();

console.log(`database:     ${dbHost}`);
console.log(`accounts:     ${accounts}`);
console.log(`chats:        ${chats}`);
console.log(`messages:     ${messages}`);
console.log(`attachments:  ${attachments}`);
console.log(`reservations: ${reservations}`);
console.log(`payments:     ${payments}`);
console.log(`rate limits:  ${rateLimits}`);

if (!process.argv.includes("--yes")) {
  console.log("\ndry run. re-run with --yes to delete all of the above.");
  await prisma.$disconnect();
  process.exit(0);
}

await prisma.$executeRawUnsafe(
  `TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`,
);

await rm(path.join(DATA_DIR, "attachments"), { recursive: true, force: true });

console.log("\nwiped. every table is empty and the attachment store is gone.");
await prisma.$disconnect();
