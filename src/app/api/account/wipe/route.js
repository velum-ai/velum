import { NextResponse } from "next/server";
import { wipeChats, deleteAccount } from "@/lib/account";
import { guardRequest } from "@/lib/guard";
import { maskAccount } from "@/lib/mask";
import { log } from "@/lib/logger";

// Destructive data controls. `target` is "chats" (delete every thread, keep the
// account and its balance) or "account" (delete everything).
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  const g = await guardRequest(req, {
    key: "account-wipe",
    limit: 6,
    windowMs: 60 * 60_000,
    account: body.account,
  });
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  if (body.target === "account") {
    await deleteAccount(body.account);
    log("account_deleted", { account: maskAccount(body.account) });
    return NextResponse.json({ ok: true, target: "account" });
  }

  const removed = await wipeChats(body.account);
  log("chats_wiped", { account: maskAccount(body.account), removed });
  return NextResponse.json({ ok: true, target: "chats", removed });
}
