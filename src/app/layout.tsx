import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppBuildCacheGuard } from "@/components/AppBuildCacheGuard";
import { PageLoadSplash } from "@/components/PageLoadSplash";
import { brandIcons, siteMetadataBase } from "@/lib/siteIconsMeta";
import "./globals.css";

/** Fresh HTML on every request so browsers load the latest hashed /_next/static assets. */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

export const metadata: Metadata = {
  metadataBase: siteMetadataBase(),
  title: "Vero7 | Vetements Sport & Casual",
  description:
    "Vero7 est une marque de vetements moderne qui melange performance sportive et style casual.",
  /**
   * Tab / bookmarks: `V7/V7 2.png` → `public/V7/V7-2.png`; `src/app/icon.png` + `apple-icon.png` match.
   * `metadataBase` + `/favicon.ico` rewrite (next.config) help browsers stop using the default triangle.
   */
  icons: brandIcons,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var n=performance.getEntriesByType("navigation")[0];if(!n||n.type==="reload"||n.type==="navigate"){document.documentElement.classList.add("vero7-splash-active")}}catch(e){}})();`,
          }}
        />
        <PageLoadSplash />
        <div id="vero7-app-root" className="flex min-h-full flex-1 flex-col">
          <AppBuildCacheGuard />
          {children}
        </div>
        <Analytics />
      </body>
    </html>
  );
}
