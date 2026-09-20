import "./globals.css";
import { Geist, Geist_Mono } from "next/font/google";
import { site } from "@/config/site";
import InstallPrompt from "@/components/InstallPrompt";
import AdClickCapture from "@/components/AdClickCapture";

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

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <div className="flex min-h-screen flex-col">{children}</div>
        <InstallPrompt />
        <AdClickCapture />
      </body>
    </html>
  );
}
