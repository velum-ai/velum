import { NextResponse } from "next/server";
import { exportAccount } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";
import { maskAccount } from "@/lib/mask";
import { log } from "@/lib/logger";

// One JSON file with the whole account: settings, every chat and message, and
// paid top-ups. Served as an attachment.
export async function POST(req) {
  const g = await guardRequest(req, {
    key: "account-export",
    limit: 10,
    windowMs: 60 * 60_000,
    account: true,
  });
  if (g.error) return bad(g.error, g.status);
  const number = g.record.number;

  const dump = await exportAccount(number);
  if (!dump) return bad("invalid request", 400);

  log("account_exported", { account: maskAccount(number) });

  const last4 = String(number).replace(/\D/g, "").slice(-4);
  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="velum-${last4}.json"`,
    },
  });
}
