import { NextResponse } from "next/server";
import { findAccount } from "@/lib/account";
import { guardRequest, bad } from "@/lib/guard";
import { setSessionCookie, clearSessionCookie } from "@/lib/session";

// A cross-site request can't be blocked by SameSite=Lax here - there's no
// cookie yet for Lax to protect, which is exactly the hole this route would
// otherwise have: a victim's browser, auto-submitting a cross-site form
// (even via the classic text/plain-body trick, invisible to them), would
// get logged into whatever account number the attacker put in the body.
// Every real browser sets Origin on a POST regardless of same-origin or
// not, so reject anything that doesn't match this deploy's own host; only
// fall back to allowing when the header is absent entirely (very old
// browsers, non-browser API clients) - something a forged cross-site form
// can't produce anyway.
//
// Compares HOST only, not the full origin: behind the reverse proxy this
// app runs behind in production, Next sees a plain-HTTP internal
// connection, so req.nextUrl's own scheme is unreliable (same reason
// session.js's isHttps checks x-forwarded-proto instead of trusting it) -
// comparing a "https://" Origin against a reconstructed "http://" origin
// rejected every real login. The Host header itself is what the reverse
// proxy actually forwards untouched, and the host is all a CSRF check
// needs: an attacker's page can't fake a browser-set Origin header to
// claim a host it isn't actually being served from.
function isSameOrigin(req) {
  const origin = req.headers.get("origin");
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

// Login: the one place a client-supplied account number is still trusted
// directly, because by definition there's no session yet to check it
// against - the number itself is the thing being presented as proof. Every
// other route gets the account from the cookie this sets, never the body.
export async function POST(req) {
  if (!isSameOrigin(req)) return bad("forbidden", 403);

  const g = await guardRequest(req, {
    key: "login",
    limit: 20,
    windowMs: 5 * 60_000,
    busy: "too many attempts, try again later",
  });
  if (g.error) return bad(g.error, g.status);

  const body = await req.json().catch(() => ({}));
  const record = await findAccount(body.number);
  if (!record) return bad("account not found", 400);

  const res = NextResponse.json({ ok: true });
  setSessionCookie(req, res, record.number);
  return res;
}

// Logout: clear the cookie. No account requirement - an already-expired or
// tampered cookie should still be clearable.
export async function DELETE(req) {
  const res = NextResponse.json({ ok: true });
  clearSessionCookie(req, res);
  return res;
}
