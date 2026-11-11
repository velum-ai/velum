import { NextResponse } from "next/server";
import { findAccount } from "@/lib/account";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { getSessionAccount } from "@/lib/session";
import { log } from "@/lib/logger";

// The one error-response shape every route returns on rejection. `extra`
// merges in additional fields, e.g. the real balance on a 402 so the client
// doesn't have to assume "0" just because this one request was rejected.
export const bad = (error, status, extra) =>
  NextResponse.json({ error, ...extra }, { status });

// The one admission seam for every API route: per-ip rate limit, then
// optional account resolution. `account: true` means "this route needs an
// authenticated caller" - the account number comes from the signed session
// cookie (see session.js), never from anything the client sends in the
// body. A request with no cookie, a tampered one, or one for an account
// that's since been deleted all collapse into the same 401.
//
// Returns { error, status } on rejection, else {} - or { record } when an
// account was required and resolved.
export async function guardRequest(
  req,
  { key, limit, windowMs, account, busy = "too many requests, try again later" },
) {
  const ip = clientIp(req);
  const sessionAccount = account ? getSessionAccount(req) : null;
  // Rate limit and account lookup hit different tables and don't depend on
  // each other's result, so run them concurrently instead of back-to-back -
  // saves one DB round trip of latency on every single request, ahead of
  // the upstream model call. Rejection precedence is unchanged: rate limit
  // still wins over an unauthenticated caller, same as the old order.
  const [{ allowed }, record] = await Promise.all([
    checkRateLimit(`${key}:${ip}`, { limit, windowMs }),
    sessionAccount ? findAccount(sessionAccount) : Promise.resolve(null),
  ]);

  if (!allowed) {
    log("rate_limited", { key, ip });
    return { error: busy, status: 429 };
  }

  if (!account) return {};

  if (!record) return { error: "not signed in", status: 401 };
  return { record };
}
