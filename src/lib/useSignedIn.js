"use client";

import { useEffect, useState } from "react";
import { hasLegacySession } from "@/lib/ensureSession";

// Whether there's a signed-in session. The actual credential lives only in
// an httpOnly cookie now (see session.js) - unreadable by any script on the
// page - so this just checks a non-secret local flag for instant routing.
// Deliberately does NOT perform the legacy-session migration itself: that
// exchange is destructive (reads then clears a one-time key) and must only
// happen once, from whichever page actually needs a real session (chat,
// account). Doing it here too would race that page's own migration across
// a hard navigation - see migrateLegacySession's comment.
// False on the server and the first client render, then resolves after
// mount. Also follows sign-in / sign-out in another tab.
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const read = () => setSignedIn(hasLegacySession());

    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  return signedIn;
}
