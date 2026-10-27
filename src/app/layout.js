import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { site } from "@/config/site";
import InstallPrompt from "@/components/InstallPrompt";

const geistSans = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata = {
  title: {
    default: site.name,
    template: `%s | ${site.name}`,
  },

  description: site.description,

  metadataBase: new URL(site.url),

  applicationName: site.name,

  openGraph: {
    title: site.name,
    description: site.description,
    url: site.url,
    siteName: site.name,
    locale: "en_US",
    type: "website",
    images: [
      { url: "/og.png", width: 1200, height: 630, alt: site.description },
    ],
  },

  twitter: {
    card: "summary_large_image",
    title: site.name,
    description: site.description,
    images: ["/og.png"],
  },

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
  colorScheme: "light dark",
};

// Runs before first paint: apply the saved theme so there is no flash.
const themeScript = `(function(){try{var t=localStorage.getItem('velum_theme');if(t==='light'||t==='dark')document.documentElement.dataset.theme=t;}catch(e){}})();`;

// Organization schema, so AI/search crawlers have a structured identity to
// attribute content to beyond scraping the page text themselves.
const orgSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: site.name,
  url: site.url,
  logo: `${site.url}/velum-logo-500.png`,
  description: site.description,
  sameAs: [site.github, site.twitter].filter(Boolean),
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(orgSchema) }}
        />
      </head>
      <body>
        <div className="flex min-h-screen flex-col">{children}</div>
        <InstallPrompt />
      </body>
    </html>
  );
}
