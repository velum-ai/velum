import { NextResponse } from "next/server";
import { exportAccount } from "@/lib/account";
import { guardRequest } from "@/lib/guard";

// One JSON file with the whole account: settings, every chat and message, and
// paid top-ups. Served as an attachment.
export async function POST(req) {
  const { account } = await req.json().catch(() => ({}));

  const g = await guardRequest(req, {
    key: "account-export",
    limit: 10,
    windowMs: 60 * 60_000,
    account,
  });
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const dump = await exportAccount(account);
  if (!dump) return NextResponse.json({ error: "invalid request" }, { status: 400 });

  const last4 = String(account).replace(/\D/g, "").slice(-4);
  return new NextResponse(JSON.stringify(dump, null, 2), {
    headers: {
      "content-type": "application/json",
      "content-disposition": `attachment; filename="velum-${last4}.json"`,
    },
  });
}
