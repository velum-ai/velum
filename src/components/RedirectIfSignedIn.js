"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { STORAGE_KEY } from "@/lib/limits";

// Drop into marketing / auth pages: bounces an already-signed-in visitor
// straight to the app. Renders nothing.
export default function RedirectIfSignedIn({ to = "/chat" }) {
  const router = useRouter();

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) router.replace(to);
    } catch {
      // storage blocked - leave the visitor where they are
    }
  }, [router, to]);

  return null;
}
