"use client";

import Link from "next/link";
import { useSignedIn } from "@/lib/useSignedIn";
import { site } from "@/config/site";

const primary =
  "group inline-flex items-center gap-2 rounded-md border border-foreground bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-colors hover:bg-background hover:text-foreground sm:text-base";
const secondary =
  "rounded-md border border-border px-5 py-2.5 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground sm:text-base";
const Arrow = () => (
  <span className="transition-transform group-hover:translate-x-0.5">&rarr;</span>
);

export default function Hero() {
  const signedIn = useSignedIn();

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex max-w-2xl flex-col items-start gap-6">
        <h1 className="text-balance text-4xl font-medium leading-[1.08] tracking-[-0.02em] sm:text-6xl">
          chat with ai models without giving up your identity
        </h1>

        <p className="max-w-lg text-[15px] leading-7 text-muted sm:text-base sm:leading-8">
          no email, no phone, no name. get a 16-digit number, add credit, and
          start chatting. pay only for what you use, no subscription.
        </p>

        <div className="mt-2 flex flex-wrap items-center gap-3">
          {signedIn ? (
            <Link href="/chat" className={primary}>
              open chat
              <Arrow />
            </Link>
          ) : (
            <>
              <Link href="/create-account" className={primary}>
                create an account
                <Arrow />
              </Link>
              <Link href="/login" className={secondary}>
                sign in
              </Link>
            </>
          )}
        </div>

        {site.github && (
          <Link
            href={site.github}
            className="text-sm text-faint transition-colors hover:text-foreground"
          >
            open source, verify it yourself &rarr;
          </Link>
        )}
      </div>
    </section>
  );
}
