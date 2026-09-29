import Link from "next/link";
import { footerCategories, social } from "@/config/site";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap justify-center gap-x-32 gap-y-8 px-4 py-10 sm:px-6">
        {footerCategories.map((category) => (
          <nav key={category.label} className="flex flex-col gap-2.5 text-sm">
            <span className="text-xs uppercase tracking-[0.12em] text-faint">
              {category.label}
            </span>
            {category.links.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="text-muted transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        ))}

        <div className="flex flex-col gap-2.5 text-sm">
          <span className="text-xs uppercase tracking-[0.12em] text-faint">
            follow
          </span>
          {social.map((link) => (
            <a
              key={link.label}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted transition-colors hover:text-foreground"
            >
              {link.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
