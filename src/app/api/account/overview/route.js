import { NextResponse } from "next/server";
import { accountOverview } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";

export const dynamic = "force-dynamic";

export async function POST(req) {
  const { account } = await req.json().catch(() => ({}));
  const g = await guardRequest(req, {
    key: "account-overview",
    limit: 30,
    windowMs: 60_000,
    account,
  });
  if (g.error) return bad(g.error, g.status);

  const data = await accountOverview(account, g.record);
  return data ? NextResponse.json(data) : bad("invalid account", 400);
}
