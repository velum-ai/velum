"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import RedirectIfSignedIn from "@/components/RedirectIfSignedIn";
import { api } from "@/lib/clientApi";
import { STORAGE_KEY } from "@/lib/limits";

function formatAccountInput(value) {
  return (
    value
      .replace(/\D/g, "")
      .slice(0, 16)
      .match(/.{1,4}/g)
      ?.join(" ") ?? ""
  );
}

export default function SignInPage() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const trimmed = value.trim();
    if (!trimmed) return;

    setLoading(true);

    const { ok, status } = await api("/api/account/lookup", {
      body: { account: trimmed },
    });
    setLoading(false);

    if (!ok) {
      setError(
        status === 429
          ? "too many attempts, try again later"
          : status === 0
            ? "something went wrong"
            : "account not found",
      );
      return;
    }

    localStorage.setItem(STORAGE_KEY, trimmed);
    router.push("/chat");
  };

  return (
    <>
      <RedirectIfSignedIn />
      <Header />

      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10 sm:px-6 sm:py-16">
        <form
          onSubmit={handleSubmit}
          className="flex w-full flex-col gap-6 rounded-lg border border-border p-5 sm:p-7"
        >
          <div className="flex flex-col gap-2">
            <p className="text-xs uppercase tracking-[0.12em] text-faint">
              sign in
            </p>

            <h1 className="text-2xl font-medium tracking-tight sm:text-3xl">
              enter your account number
            </h1>

            <p className="leading-7 text-muted">
              the 16-digit number from when you created your account. don’t have
              one yet?{" "}
              <Link
                href="/create-account"
                className="underline hover:text-foreground"
              >
                create an account
              </Link>
              .
            </p>
          </div>

          <input
            type="text"
            inputMode="numeric"
            value={value}
            onChange={(e) => setValue(formatAccountInput(e.target.value))}
            placeholder="0000 0000 0000 0000"
            className="w-full border border-border bg-transparent px-2 py-3 text-center text-base tracking-[0.1em] outline-none sm:px-4 sm:text-xl sm:tracking-[0.2em]"
          />

          {error && <p className="text-sm text-muted">{error}</p>}

          <button
            type="submit"
            disabled={loading || !value.trim()}
            className="border border-foreground bg-foreground px-5 py-2.5 text-background transition-colors hover:bg-background hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? "checking..." : "sign in"}
          </button>
        </form>
      </main>

      <Footer />
    </>
  );
}
