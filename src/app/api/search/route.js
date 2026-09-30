import { NextResponse } from "next/server";
import { searchMessages } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";

// Full-text-ish search over the account's own messages. Backs the command
// palette; the sidebar box stays a client-side title filter.
export async function POST(req) {
  const { account, q } = await req.json().catch(() => ({}));

  const g = await guardRequest(req, {
    key: "search",
    limit: 60,
    windowMs: 60_000,
    account,
  });
  if (g.error) return bad(g.error, g.status);

  const results = await searchMessages(account, q);
  return NextResponse.json({ results });
}
