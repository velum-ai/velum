import Link from "next/link";
import { footerCategories, social } from "@/config/site";

export default function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-8 gap-y-6 px-4 py-8 sm:flex sm:flex-wrap sm:justify-center sm:gap-x-32 sm:gap-y-8 sm:px-6 sm:py-10">
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
