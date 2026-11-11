import { api } from "@/lib/clientApi";
import { STORAGE_KEY, SIGNED_IN_KEY } from "@/lib/limits";

// Cheap, non-destructive "is this visitor signed in" check - no network
// call, nothing mutated. Safe to call from any component (marketing pages,
// redirects) since it can't race with or interrupt the real migration
// below. A legacy raw-number key counts as signed in even though it hasn't
// been exchanged for a cookie yet; whichever page actually needs a real
// session calls migrateLegacySession to do that exchange.
export function hasLegacySession() {
  try {
    return Boolean(localStorage.getItem(SIGNED_IN_KEY) || localStorage.getItem(STORAGE_KEY));
  } catch {
    return false;
  }
}

// One-time migration for a session from before accounts moved to an
// httpOnly cookie: if the raw number is still sitting in localStorage,
// exchange it for a real session cookie and forget it - this is the only
// place that old key is ever read again. No-op (returns false) if there's
// nothing to migrate, which is the normal case for anyone who signed in
// after the cookie migration shipped.
//
// Only call this from a page that actually needs a real session (chat,
// account) - not from redirect/CTA components. Earlier, RedirectIfSignedIn
// also called this (via useSignedIn) on /login, which raced the hard
// navigation to /chat right after: the login page's call could read and
// clear the legacy key without surviving long enough to finish the
// network exchange, losing the session. Keeping this to a single
// authoritative caller per load avoids that race entirely.
export async function migrateLegacySession() {
  try {
    if (localStorage.getItem(SIGNED_IN_KEY)) return true;
  } catch {
    // storage blocked - fall through, the rest degrades the same way
  }

  let legacy = "";
  try {
    legacy = localStorage.getItem(STORAGE_KEY) || "";
  } catch {
    return false;
  }
  if (!legacy) return false;

  const { ok } = await api("/api/session", { body: { number: legacy } });
  try {
    localStorage.removeItem(STORAGE_KEY);
    if (ok) localStorage.setItem(SIGNED_IN_KEY, "1");
  } catch {
    // storage blocked - the session cookie (if set) still works this load
  }
  return ok;
}
