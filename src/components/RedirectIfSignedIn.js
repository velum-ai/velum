"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSignedIn } from "@/lib/useSignedIn";

// Drop into marketing / auth pages: bounces an already-signed-in visitor
// straight to the app. Renders nothing.
export default function RedirectIfSignedIn({ to = "/chat" }) {
  const router = useRouter();
  const signedIn = useSignedIn();

  useEffect(() => {
    if (signedIn) router.replace(to);
  }, [signedIn, router, to]);

  return null;
}
