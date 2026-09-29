import Link from "next/link";
import Logo from "@/components/Logo";
import ThemeToggle from "@/components/ThemeToggle";

export default function Header() {
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

        <ThemeToggle />
      </div>
    </header>
  );
}
