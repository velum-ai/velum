// Add (or, with a negative amount, remove) credit on an account directly.
// Admin tool, no payment involved.
//
//   DATABASE_URL=... npm run grant-credit -- "1234 5678 9012 3456" 1000
import { prisma } from "@/lib/prisma";
import { isValidAccountFormat } from "@/lib/account";

const [account, raw] = process.argv.slice(2);
const amount = Number(raw);

if (!isValidAccountFormat(account) || !Number.isInteger(amount) || amount === 0) {
  console.error('usage: npm run grant-credit -- "<16-digit number>" <credits>');
  process.exit(1);
}

try {
  const acc = await prisma.account.update({
    where: { number: account },
    data: { credits: { increment: amount } },
    select: { number: true, credits: true },
  });
  console.log(`${acc.number}  ->  ${acc.credits.toLocaleString()} credits`);
} catch (e) {
  console.error(e.code === "P2025" ? "account not found" : e.message);
  process.exit(1);
}

await prisma.$disconnect();
