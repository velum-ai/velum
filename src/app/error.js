"use client";

import { useEffect } from "react";
import Link from "next/link";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function Error({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <>
      <Header />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center">
        <h1 className="text-3xl font-medium tracking-tight sm:text-5xl">
          something went wrong
        </h1>

        <p className="max-w-md leading-7 text-muted sm:leading-8">
          <button onClick={reset} className="underline hover:text-foreground">
            try again
          </button>{" "}
          or{" "}
          <Link href="/" className="underline hover:text-foreground">
            go home
          </Link>
        </p>
      </main>

      <Footer />
    </>
  );
}
