import { NextResponse } from "next/server";
import { createAccount, updateSystemPrompt, updateEnabledModels } from "@/lib/account";
import { guardRequest } from "@/lib/guard";
import { checkRateLimit, clientIp } from "@/lib/rateLimit";
import { maskAccount } from "@/lib/mask";
import { log } from "@/lib/logger";
import { reportConversion as reportXConversion } from "@/lib/xConversions";
import { reportConversion as reportRedditConversion } from "@/lib/redditConversions";

// Self-serve signup. Anonymous + free trial credits, so it is rate limited on
// two windows per IP as the only abuse brake (add a CAPTCHA / Cloudflare
// Turnstile in front for real bot resistance - see README).
export async function POST(req) {
  const { twclid, rdtCid } = await req.json().catch(() => ({}));

  const g = await guardRequest(req, {
    key: "create-account",
    limit: 5,
    windowMs: 60 * 60_000, // 5 / hour / ip
    busy: "too many accounts created, try again later",
  });
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const daily = await checkRateLimit(`create-account-day:${clientIp(req)}`, {
    limit: 20,
    windowMs: 24 * 60 * 60_000, // 20 / day / ip
  });
  if (!daily.allowed) {
    return NextResponse.json(
      { error: "too many accounts created, try again later" },
      { status: 429 },
    );
  }

  const account = await createAccount();
  log("account_created", { account: maskAccount(account) });
  // fire-and-forget, ad reporting never gates signup
  reportXConversion(twclid);
  reportRedditConversion(rdtCid);
  return NextResponse.json({ account });
}

// Update custom instructions (system prompt) or the account's model picks.
export async function PATCH(req) {
  const body = await req.json().catch(() => ({}));
  const g = await guardRequest(req, {
    key: "account-patch",
    limit: 30,
    windowMs: 60_000,
    account: body.account,
  });
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const result = Array.isArray(body.enabledModels)
    ? await updateEnabledModels(body.account, body.enabledModels)
    : await updateSystemPrompt(body.account, body.systemPrompt);

  return result
    ? NextResponse.json(result)
    : NextResponse.json({ error: "invalid request" }, { status: 400 });
}
