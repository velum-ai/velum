import { NextResponse } from "next/server";
import { findAccount } from "@/lib/account";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { log } from "@/lib/logger";

// The one error-response shape every route returns on rejection. `extra`
// merges in additional fields, e.g. the real balance on a 402 so the client
// doesn't have to assume "0" just because this one request was rejected.
export const bad = (error, status, extra) =>
  NextResponse.json({ error, ...extra }, { status });

// The one admission seam for every API route: per-ip rate limit, then optional
// account lookup. findAccount validates format and uses a parameterized query,
// so bad-format and not-found collapse into the same uniform 400 (no oracle).
//
// Returns { error, status } on rejection, else {} - or { record } when an
// account was requested and found.
export async function guardRequest(
  req,
  { key, limit, windowMs, account, busy = "too many requests, try again later" },
) {
  const ip = clientIp(req);
  // Rate limit and account lookup hit different tables and don't depend on
  // each other's result, so run them concurrently instead of back-to-back -
  // saves one DB round trip of latency on every single request, ahead of
  // the upstream model call. Rejection precedence is unchanged: rate limit
  // still wins over an invalid account, same as the old sequential order.
  const [{ allowed }, record] = await Promise.all([
    checkRateLimit(`${key}:${ip}`, { limit, windowMs }),
    account === undefined ? Promise.resolve(null) : findAccount(account),
  ]);

  if (!allowed) {
    log("rate_limited", { key, ip });
    return { error: busy, status: 429 };
  }

  if (account === undefined) return {};

  if (!record) return { error: "invalid account", status: 400 };
  return { record };
}
