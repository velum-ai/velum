// Delete one account and everything under it (chats, messages, attachments,
// reservations, payments - all cascade from the Account row). Same path the
// account page's own "delete account" button uses, just admin-triggered by
// number instead of self-serve. Irreversible. Dry run by default, --yes to
// actually delete. Attachment files only get cleaned up if DATA_DIR here
// points at the same disk the app writes to (i.e. run this on the server).
//
//   npm run delete-account -- "1234 5678 9012 3456"
//   npm run delete-account -- "1234 5678 9012 3456" --yes
import { prisma } from "@/lib/prisma";
import { isValidAccountFormat, deleteAccount } from "@/lib/account";

const [account] = process.argv.slice(2);
const commit = process.argv.includes("--yes");

if (!isValidAccountFormat(account)) {
  console.error('usage: npm run delete-account -- "<16-digit number>" [--yes]');
  process.exit(1);
}

const acc = await prisma.account.findUnique({
  where: { number: account },
  select: { credits: true, createdAt: true, _count: { select: { chats: true, payments: true } } },
});

if (!acc) {
  console.error("account not found");
  process.exit(1);
}

console.log(`account:  ${account}`);
console.log(`credits:  ${acc.credits}`);
console.log(`chats:    ${acc._count.chats}`);
console.log(`payments: ${acc._count.payments}`);
console.log(`created:  ${acc.createdAt.toISOString()}`);

if (!commit) {
  console.log("\ndry run. re-run with --yes to delete this account and all its data.");
  await prisma.$disconnect();
  process.exit(0);
}

await deleteAccount(account);
console.log("\ndeleted.");
await prisma.$disconnect();
