import { NextResponse } from "next/server";
import { accountOverview } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const g = await guardRequest(req, {
    key: "account-overview",
    limit: 30,
    windowMs: 60_000,
    account: true,
  });
  if (g.error) return bad(g.error, g.status);

  const data = await accountOverview(g.record.number, g.record);
  // The client no longer holds the account number anywhere itself (it lives
  // only in the httpOnly session cookie) - this is the one authenticated
  // response that hands it back, so the account page can display/copy it.
  return data
    ? NextResponse.json({ ...data, number: g.record.number })
    : bad("invalid account", 400);
}
