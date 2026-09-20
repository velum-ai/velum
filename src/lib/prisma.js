import { PrismaClient } from "@prisma/client";

// One client per process. Cached on globalThis so dev hot-reload doesn't open a
// new connection pool on every edit.
const globalForPrisma = globalThis;

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

// Interactive transactions in this app do 2-4 small writes. The Prisma default
// (2s wait for a slot, 5s to run) is too tight against a slow shared pooler
// and was aborting credit refunds mid-flight (P2028). These are still short.
export const TX_OPTS = { maxWait: 10_000, timeout: 20_000 };

// Age past which a still-PENDING reservation is treated as abandoned (the
// request died between reserve and settle). Well above any real stream length.
const RESERVATION_TTL_MS = 10 * 60 * 1000;

// Refund abandoned reservations. Time-bounded and each refund is gated on
// winning the PENDING -> ABANDONED transition, so it is safe to run on every
// instance concurrently: an in-flight exchange is never touched and no
// reservation is refunded twice.
export async function sweepReservations() {
  const stale = await prisma.reservation.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - RESERVATION_TTL_MS) },
    },
    select: { id: true, accountId: true, amount: true },
  });

  let refunded = 0;
  for (const r of stale) {
    refunded += await prisma.$transaction(async (tx) => {
      const { count } = await tx.reservation.updateMany({
        where: { id: r.id, status: "PENDING" },
        data: { status: "ABANDONED", settledAt: new Date() },
      });
      if (count === 0) return 0;
      await tx.account.update({
        where: { number: r.accountId },
        data: { credits: { increment: r.amount } },
      });
      return 1;
    }, TX_OPTS);
  }

  return refunded;
}
