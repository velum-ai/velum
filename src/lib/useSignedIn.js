"use client";

import { useEffect, useState } from "react";
import { STORAGE_KEY } from "@/lib/limits";

// Whether an account number is in localStorage. There is no server-side
// session, so this is false on the server and the first client render, then
// resolves after mount. Also follows sign-in / sign-out in another tab.
export function useSignedIn() {
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    const read = () => {
      try {
        setSignedIn(Boolean(localStorage.getItem(STORAGE_KEY)));
      } catch {
        setSignedIn(false);
      }
    };
    read();
    window.addEventListener("storage", read);
    return () => window.removeEventListener("storage", read);
  }, []);

  return signedIn;
}
