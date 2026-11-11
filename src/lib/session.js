import { signId, verifyId } from "@/lib/sign";

// The account number is the app's one credential (see Account model). It
// used to live in localStorage and ride along as `account` in every request
// body - readable, and exfiltratable, by any script that ever runs on the
// page (an XSS bug, a compromised dependency). This cookie is the fix: the
// browser attaches it automatically, and no JS on the page - injected or
// not - can read its value at all, httpOnly is enforced by the browser
// itself. The number itself is still what gets shown to the user once, on
// signup/login, since it has to be - that's unavoidable and unrelated to
// this.
export const SESSION_COOKIE = "velum_session";

// Long-lived on purpose: this app has no password-reset flow and no second
// factor, "stay signed in" is the only model that makes sense for a
// number-as-credential system. Matches how localStorage behaved before -
// signed in until explicitly signed out.
const SESSION_TTL_MS = 180 * 24 * 60 * 60 * 1000;

// A `Secure` cookie is silently dropped by the browser on a plain-HTTP
// response - not rejected with an error, just never stored, which makes for
// a genuinely confusing bug: login "succeeds" (200 OK) and then every
// follow-up request looks signed-out. NODE_ENV=production doesn't actually
// tell you whether THIS request was HTTPS (self-hosters running the prod
// build directly, without Caddy/TLS in front yet, are NODE_ENV=production
// over plain HTTP) - checking the request itself is what's actually
// correct, and still secure: behind Caddy (see Caddyfile.example) the
// public connection is real HTTPS, so this still comes back true there.
const isHttps = (req) =>
  req.headers.get("x-forwarded-proto") === "https" ||
  req.nextUrl.protocol === "https:";

// Reuses sign.js's existing HMAC primitive (same one behind attachment
// URLs) rather than inventing a second signing scheme - the cookie value is
// just a signed, expiring token wrapping the account number, so it can't be
// forged or tampered with even if something else ever wrote to cookies.
export function setSessionCookie(req, res, number) {
  res.cookies.set(SESSION_COOKIE, signId(number, SESSION_TTL_MS), {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
}

export function clearSessionCookie(req, res) {
  res.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: isHttps(req),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

// -> account number, or null if there's no cookie / it's invalid / expired.
export function getSessionAccount(req) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token ? verifyId(token) : null;
}
