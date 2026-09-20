import { sweepReservations } from "@/lib/prisma";
import { pruneRateLimits } from "@/lib/rateLimit";
import { sweepAttachments } from "@/lib/storage";
import { dodoStatus } from "@/lib/dodo";
import { btcpayStatus } from "@/lib/btcpay";
import { upstreamStatus } from "@/lib/upstream";
import { log, logError } from "@/lib/logger";

const INTERVAL_MS = 10 * 60 * 1000;

// Periodic housekeeping: refund abandoned reservations, drop stale rate-limit
// rows. Started once from instrumentation.js; the interval is unref'd so it
// never keeps the process alive on its own.
export function startMaintenance() {
  log("boot", { chat: upstreamStatus(), payments: dodoStatus(), btcpay: btcpayStatus() });

  const tick = async () => {
    try {
      const refunded = await sweepReservations();
      const pruned = await pruneRateLimits();
      const orphans = await sweepAttachments();
      if (refunded || pruned || orphans) {
        log("maintenance", { refunded, pruned, orphans });
      }
    } catch (err) {
      logError("maintenance_failed", err);
    }
  };

  tick();
  setInterval(tick, INTERVAL_MS).unref();
}
