// Mint one account number and print it. Admin path (users self-serve at
// /create-account). Point DATABASE_URL at the production database.
//
//   DATABASE_URL=postgres://... npm run create-account
import { createAccount } from "@/lib/account";
import { prisma } from "@/lib/prisma";

console.log(await createAccount());
await prisma.$disconnect();
