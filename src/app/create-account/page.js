"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { api } from "@/lib/clientApi";
import { STORAGE_KEY } from "@/lib/limits";
import { TWCLID_KEY } from "@/components/AdClickCapture";

export default function CreateAccountPage() {
  const router = useRouter();
  const [account, setAccount] = useState("");
  const [status, setStatus] = useState("idle"); // idle | loading | done | error
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setStatus("loading");
    setError("");

    const twclid = localStorage.getItem(TWCLID_KEY) || undefined;
    const { ok, status: code, data } = await api("/api/account", { body: { twclid } });
    if (!ok || !data.account) {
      setStatus("error");
      setError(
        code === 429
          ? "too many accounts from your network, try again later"
          : "something went wrong, try again",
      );
      return;
    }

    localStorage.removeItem(TWCLID_KEY);
    setAccount(data.account);
    setStatus("done");
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(account);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard blocked - the number is on screen to copy by hand
    }
  };

  const enter = () => {
    localStorage.setItem(STORAGE_KEY, account);
    router.push("/account");
  };

  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10 sm:px-6 sm:py-16">
        <div className="flex w-full flex-col gap-6 rounded-lg border border-border p-5 sm:p-7">
          {status === "done" ? (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.12em] text-faint">
                  your account number
                </p>
                <h1 className="text-2xl font-medium tracking-[0.12em] text-foreground sm:text-3xl">
                  {account}
                </h1>
                <p className="leading-7 text-muted">
                  this is the only way in and we can’t recover it. keep it
                  somewhere safe, then add credit to start chatting.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  onClick={copy}
                  className="border border-foreground px-5 py-2.5 text-sm transition-colors hover:bg-foreground hover:text-background sm:text-base"
                >
                  {copied ? "copied" : "copy number"}
                </button>
                <button
                  onClick={enter}
                  className="border border-foreground bg-foreground px-5 py-2.5 text-sm text-background transition-colors hover:bg-background hover:text-foreground sm:text-base"
                >
                  saved it, add credit
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-col gap-2">
                <p className="text-xs uppercase tracking-[0.12em] text-faint">
                  new account
                </p>
                <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
                  create an account
                </h1>
                <p className="leading-7 text-muted">
                  no email, no phone, no name. you get a 16-digit number that is
                  your whole identity here. add credit and start chatting.{" "}
                  <Link href="/login" className="underline hover:text-foreground">
                    already have one?
                  </Link>
                </p>
              </div>

              {error && <p className="text-sm text-muted">{error}</p>}

              <button
                onClick={create}
                disabled={status === "loading"}
                className="self-start border border-foreground bg-foreground px-5 py-2.5 text-background transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                {status === "loading" ? "creating..." : "create account"}
              </button>
            </>
          )}
        </div>
      </main>

      <Footer />
    </>
  );
}
