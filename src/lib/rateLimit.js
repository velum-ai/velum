import { prisma } from "@/lib/prisma";

// Fixed-window limiter backed by the RateLimit table: one atomic upsert per
// call, durable across restarts, shared by every app instance. The window
// resets in-place when the stored one has expired.
export async function checkRateLimit(key, { limit, windowMs }) {
  const cutoff = new Date(Date.now() - windowMs);
  const [row] = await prisma.$queryRaw`
    INSERT INTO "RateLimit" ("key", "windowStart", "count")
    VALUES (${key}, now(), 1)
    ON CONFLICT ("key") DO UPDATE SET
      "windowStart" = CASE WHEN "RateLimit"."windowStart" < ${cutoff}
                           THEN now() ELSE "RateLimit"."windowStart" END,
      "count"       = CASE WHEN "RateLimit"."windowStart" < ${cutoff}
                           THEN 1 ELSE "RateLimit"."count" + 1 END
    RETURNING "count"`;
  return { allowed: Number(row.count) <= limit };
}

export async function pruneRateLimits() {
  const { count } = await prisma.rateLimit.deleteMany({
    where: { windowStart: { lt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  return count;
}

// Behind Cloudflare the origin has no public port, so CF-Connecting-IP is
// trustworthy. The other headers are fallbacks - spoofable if the origin is
// reachable directly, so keep it locked to Cloudflare (see README).
export const clientIp = (req) =>
  req.headers.get("cf-connecting-ip") ||
  req.headers.get("x-real-ip") ||
  req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
  "unknown";
