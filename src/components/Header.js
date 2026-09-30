"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";
import { useSignedIn } from "@/lib/useSignedIn";

export default function Header() {
  const pathname = usePathname();
  const signedIn = useSignedIn();
  const showLogin =
    !signedIn && pathname !== "/login" && pathname !== "/create-account";

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link
          href="/"
          aria-label="velum, home"
          className="text-foreground transition-opacity hover:opacity-70"
        >
          <Logo className="h-6 w-6" />
        </Link>

        <div className="flex items-center gap-4">
          {showLogin && (
            <Link
              href="/login"
              className="text-sm text-muted transition-colors hover:text-foreground"
            >
              login
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
