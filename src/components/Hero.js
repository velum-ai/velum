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
const GitHubMark = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
  </svg>
);

export default function Hero() {
  const signedIn = useSignedIn();

  return (
    <section className="mx-auto w-full max-w-5xl px-5 py-16 sm:px-8 sm:py-24">
      <div className="flex max-w-2xl flex-col items-start gap-6">
        {site.github && (
          <Link
            href={site.github}
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted transition-colors hover:border-border-strong hover:text-foreground"
          >
            <GitHubMark />
            open source
          </Link>
        )}

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
      </div>
    </section>
  );
}
