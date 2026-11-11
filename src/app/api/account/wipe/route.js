import { NextResponse } from "next/server";
import { wipeChats, deleteAccount } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";
import { clearSessionCookie } from "@/lib/session";
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
    account: true,
  });
  if (g.error) return bad(g.error, g.status);
  const number = g.record.number;

  if (body.target === "account") {
    await deleteAccount(number);
    log("account_deleted", { account: maskAccount(number) });
    const res = NextResponse.json({ ok: true, target: "account" });
    clearSessionCookie(req, res); // the account this cookie pointed at is gone
    return res;
  }

  const removed = await wipeChats(number);
  log("chats_wiped", { account: maskAccount(number), removed });
  return NextResponse.json({ ok: true, target: "chats", removed });
}
