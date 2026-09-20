import { NextResponse } from "next/server";
import { findAccount } from "@/lib/account";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { log } from "@/lib/logger";

// The one error-response shape every route returns on rejection.
export const bad = (error, status) => NextResponse.json({ error }, { status });

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
  const { allowed } = await checkRateLimit(`${key}:${ip}`, { limit, windowMs });
  if (!allowed) {
    log("rate_limited", { key, ip });
    return { error: busy, status: 429 };
  }

  if (account === undefined) return {};

  const record = await findAccount(account);
  if (!record) return { error: "invalid account", status: 400 };
  return { record };
}
