"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import FullScreenNotice from "@/components/FullScreenNotice";
import RedirectIfSignedIn from "@/components/RedirectIfSignedIn";
import { api } from "@/lib/clientApi";
import { STORAGE_KEY } from "@/lib/limits";

// The number shown before "continue" is only a local candidate, nothing is
// created in the database until then, so an abandoned visit never leaves a
// row behind. Cached here purely so a refresh keeps showing the same number
// instead of rolling a new one.
const CANDIDATE_KEY = "velum_candidate_account";

function randomAccountNumber() {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 10))
    .join("")
    .match(/.{1,4}/g)
    .join(" ");
}

export default function CreateAccountPage() {
  const router = useRouter();
  const [candidate, setCandidate] = useState("");
  const [phase, setPhase] = useState("loading"); // loading | ready | submitting | error
  const [error, setError] = useState("");
  const [rateLimited, setRateLimited] = useState(false);
  const [copied, setCopied] = useState(false);
  const [saved, setSaved] = useState(false);
  const [rolling, setRolling] = useState("0000 0000 0000 0000");
  const started = useRef(false);

  useEffect(() => {
    if (phase !== "loading") return;
    const id = setInterval(() => setRolling(randomAccountNumber()), 60);
    return () => clearInterval(id);
  }, [phase]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    const minDelay = new Promise((resolve) => setTimeout(resolve, 700));

    (async () => {
      let number = "";
      try {
        number = sessionStorage.getItem(CANDIDATE_KEY) || "";
      } catch {
        // storage blocked - fall through to generating a new candidate
      }

      if (!number) {
        // ask the server to confirm a freshly rolled candidate is actually
        // free before ever showing it, without reserving it - a few tries
        // in case of a (near-impossible) collision
        for (let attempt = 0; attempt < 5 && !number; attempt++) {
          const tryNumber = randomAccountNumber();
          const { ok, data } = await api("/api/account/check", {
            body: { number: tryNumber },
          });
          if (ok && data.available) number = tryNumber;
        }
        if (!number) number = randomAccountNumber(); // checks exhausted, createAccount still retries on collision

        try {
          sessionStorage.setItem(CANDIDATE_KEY, number);
        } catch {
          // storage blocked - refresh will just roll a new candidate
        }
      }

      await minDelay;
      setCandidate(number);
      setPhase("ready");
    })();
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(candidate);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked - the number is on screen to copy by hand
    }
  };

  const download = () => {
    const blob = new Blob([candidate], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "velum-account-number.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const enter = async () => {
    setPhase("submitting");

    const { ok, status: code, data } = await api("/api/account", {
      body: { number: candidate },
    });

    if (!ok || !data.account) {
      setPhase("error");
      setRateLimited(code === 429);
      setError(
        code === 429
          ? "too many accounts from your network, try again later"
          : "something went wrong creating your account, try again",
      );
      return;
    }

    localStorage.setItem(STORAGE_KEY, data.account);
    try {
      sessionStorage.removeItem(CANDIDATE_KEY);
    } catch {
      // storage blocked - harmless, nothing left to clean up
    }
    router.push("/chat");
  };

  if (phase === "error") {
    return (
      <>
        <RedirectIfSignedIn />
        <Header />
        <FullScreenNotice
          title={rateLimited ? "you're being rate limited" : "something went wrong"}
          message={rateLimited ? "try again in a little while" : error}
        />
        <Footer />
      </>
    );
  }

  const ready = phase === "ready";

  return (
    <>
      <RedirectIfSignedIn />
      <Header />

      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex w-full flex-col gap-4 rounded-lg border border-border p-5 sm:p-7">
          <p className="text-xs uppercase tracking-[0.12em] text-faint">
            your account number
          </p>

          <div className="rounded-md border border-border bg-surface px-3 py-4 text-center sm:px-4 sm:py-5">
            <p className="whitespace-nowrap text-lg font-medium tracking-[0.08em] text-foreground sm:text-xl">
              {ready || phase === "submitting" ? candidate : rolling}
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={copy}
              disabled={!ready}
              suppressHydrationWarning
              className="flex-1 border border-border px-5 py-2.5 text-sm transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
            >
              {copied ? "copied" : "copy"}
            </button>
            <button
              onClick={download}
              disabled={!ready}
              suppressHydrationWarning
              className="flex-1 border border-border px-5 py-2.5 text-sm transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40 sm:text-base"
            >
              download
            </button>
          </div>

          <button
            type="button"
            onClick={() => setSaved((s) => !s)}
            disabled={!ready}
            suppressHydrationWarning
            className="flex items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span
              className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${
                saved ? "border-foreground bg-foreground" : "border-border"
              }`}
            >
              {saved && (
                <svg
                  viewBox="0 0 16 16"
                  className="h-3 w-3 text-background"
                  fill="none"
                >
                  <path
                    d="M3 8.5l3 3 7-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="text-sm text-muted">
              i’ve saved my account number. if i lose it, it can’t be
              recovered.
            </span>
          </button>

          <button
            onClick={enter}
            disabled={!saved || phase !== "ready"}
            suppressHydrationWarning
            className="border border-foreground bg-foreground px-5 py-2.5 text-background transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {phase === "submitting" ? "creating..." : "continue"}
          </button>
        </div>
      </main>

      <Footer />
    </>
  );
}
