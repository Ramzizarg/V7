import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";
import { AppBuildCacheGuard } from "@/components/AppBuildCacheGuard";
import { MetaPixel } from "@/components/MetaPixel";
import { PageLoadSplash } from "@/components/PageLoadSplash";
import { WelcomeOfferModal } from "@/components/WelcomeOfferModal";
import { SiteLocaleInit } from "@/components/SiteLocaleInit";
import { SiteLocaleProvider } from "@/i18n/SiteLocaleProvider";
import { brandIcons, siteMetadataBase } from "@/lib/siteIconsMeta";
import { SITE_LOCALE_STORAGE_KEY } from "@/lib/siteLocale";
import "./globals.css";

/** Fresh HTML on every request so browsers load the latest hashed /_next/static assets. */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const metadata: Metadata = {
  metadataBase: siteMetadataBase(),
  title: "Vero7 | Vetements Sport & Casual",
  description:
    "Vero7 est une marque de vetements moderne qui melange performance sportive et style casual.",
  /**
   * Tab / bookmarks: circular V7 from `vero7-logo.png`
   * (`/favicon-32.png`, `/vero7-favicon-circle.png`, `/apple-touch-icon.png`).
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
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var n=performance.getEntriesByType("navigation")[0];if(!n||n.type==="reload"||n.type==="navigate"){document.documentElement.classList.add("vero7-splash-active")}var l=localStorage.getItem("${SITE_LOCALE_STORAGE_KEY}");if(l==="en"||l==="fr")document.documentElement.lang=l}catch(e){}})();`,
          }}
        />
        <SiteLocaleInit />
        <SiteLocaleProvider>
        <PageLoadSplash />
        <div id="vero7-app-root" className="flex min-h-full flex-1 flex-col">
          <AppBuildCacheGuard />
          {children}
          <WelcomeOfferModal />
        </div>
        </SiteLocaleProvider>
        <Analytics />
        <MetaPixel />
      </body>
    </html>
  );
}
