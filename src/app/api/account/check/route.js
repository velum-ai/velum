import { NextResponse } from "next/server";
import { accountNumberAvailable } from "@/lib/account";
import { guardRequest } from "@/lib/guard";

// Read-only availability check for a client-generated candidate account
// number, called before it's shown to the user. Nothing is written here -
// createAccount does the actual claim and still retries on collision.
export async function POST(req) {
  const body = await req.json().catch(() => ({}));
  // Reveals the same "does this number exist" signal as the real login
  // endpoint, so it must be at least as strict - stricter here since a
  // legitimate signup only ever needs a handful of checks.
  const g = await guardRequest(req, {
    key: "account-check",
    limit: 10,
    windowMs: 5 * 60_000,
    busy: "too many attempts, try again later",
  });
  if (g.error) return NextResponse.json({ error: g.error }, { status: g.status });

  const available = await accountNumberAvailable(body.number);
  return NextResponse.json({ available });
}
