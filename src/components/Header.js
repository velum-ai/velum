"use client";

import Link from "next/link";
import { navigation } from "@/config/site";
import { useSignedIn } from "@/lib/useSignedIn";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
  const signedIn = useSignedIn();

  // When signed in, the "login" link becomes a way back into the app.
  const items = navigation.map((item) =>
    signedIn && item.href === "/login"
      ? { label: "chat", href: "/chat" }
      : item,
  );

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="velum, home"
          className="text-foreground transition-opacity hover:opacity-70"
        >
          <Logo className="h-8 w-8" />
        </Link>

        <nav className="flex items-center gap-5 text-sm sm:gap-6">
          {items.map((item) => (
            <Link
              key={item.label}
              href={item.href}
              className="text-muted transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          <ThemeToggle className="-mr-1" />
        </nav>
      </div>
    </header>
  );
}
