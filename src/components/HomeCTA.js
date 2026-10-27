"use client";

import Link from "next/link";
import { useSignedIn } from "@/lib/useSignedIn";

export default function HomeCTA() {
  const signedIn = useSignedIn();

  return (
    <section className="mx-auto w-full max-w-5xl border-t border-border px-5 py-16 text-center sm:px-8 sm:py-24">
      <p className="text-xl font-medium tracking-tight sm:text-2xl">
        ready when you are.
      </p>
      <Link
        href={signedIn ? "/chat" : "/create-account"}
        className="mt-6 inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-background hover:text-foreground sm:text-base"
      >
        {signedIn ? "chat" : "get started"}
      </Link>
    </section>
  );
}
