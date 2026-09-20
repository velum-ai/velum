import { site } from "@/config/site";

const ROUTES = [
  "",
  "/pricing",
  "/faq",
  "/privacy",
  "/terms",
  "/login",
  "/create-account",
];

// Frozen at build time so the sitemap doesn't claim every page changed on
// every request.
const lastModified = new Date();

export default function sitemap() {
  return ROUTES.map((route) => ({ url: `${site.url}${route}`, lastModified }));
}
