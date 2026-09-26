// Accept a bare host in NEXT_PUBLIC_SITE_URL ("velum.run") and return a usable
// absolute origin with no trailing slash. Localhost gets http, everything else
// https. Keeps one malformed env var from breaking metadataBase, the sitemap,
// and the payment return URL.
function normalizeOrigin(value, fallback) {
  const s = String(value || "").trim().replace(/\/+$/, "");
  if (!s) return fallback;
  if (/^https?:\/\//i.test(s)) return s;
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:|$)/.test(s);
  return `${local ? "http" : "https"}://${s}`;
}

export const site = {
  name: "velum",

  description:
    "chat with ai models without your name, email or phone number",

  // canonical origin, used for metadata / sitemap / robots / payment return
  url: normalizeOrigin(process.env.NEXT_PUBLIC_SITE_URL, "https://velum.run"),

  github: "https://github.com/velum-ai/velum",
};

export const navigation = [
  { label: "pricing", href: "/pricing" },
  { label: "faq", href: "/faq" },
  { label: "login", href: "/login" },
];

export const footerNavigation = [
  { label: "privacy", href: "/privacy" },
  { label: "terms", href: "/terms" },
  { label: "github", href: site.github },
];
