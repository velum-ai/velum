import { site } from "@/config/site";

export default function robots() {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/chat", "/account", "/api"],
    },
    sitemap: `${site.url}/sitemap.xml`,
  };
}
