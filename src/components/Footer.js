import Link from "next/link";
import { footerNavigation } from "@/config/site";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-6 px-4 py-5 text-sm sm:px-6">
        {footerNavigation.map((link) => (
          <Link
            key={link.label}
            href={link.href}
            className="text-muted transition-colors hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
      </nav>
    </footer>
  );
}
