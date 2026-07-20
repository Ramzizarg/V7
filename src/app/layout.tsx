import type { Metadata, Viewport } from "next";
import Script from "next/script";
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
import { HYDRATION_GUARD_SCRIPT } from "@/lib/hydrationGuardScript";
import { SITE_LOCALE_STORAGE_KEY } from "@/lib/siteLocale";
import "./globals.css";

/** Fresh HTML on every request so browsers load the latest hashed /_next/static assets. */
export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  /** Avoid interactive-widget resize fighting Instagram/Safari chrome. */
  interactiveWidget: "overlays-content",
};

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

/** Locks layout width + hero height so Instagram WebView does not “zoom” on scroll. */
const MOBILE_VIEWPORT_STABILITY_SCRIPT = `(function(){try{var d=document.documentElement;function lock(){d.style.setProperty("--app-vh",window.innerHeight+"px");d.style.setProperty("--hero-min-h",Math.round(window.innerHeight*0.85)+"px")}lock();var ua=navigator.userAgent||"";if(/Instagram|FBAN|FBAV|Line\\//i.test(ua)){var m=document.querySelector('meta[name="viewport"]');if(m){m.setAttribute("content","width=device-width,initial-scale=1,maximum-scale=1,viewport-fit=cover")}}window.addEventListener("orientationchange",function(){setTimeout(lock,250)},{passive:true})}catch(e){}})();`;

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
        <Script id="vero7-hydration-guard" strategy="beforeInteractive">
          {HYDRATION_GUARD_SCRIPT}
        </Script>
        <Script id="vero7-mobile-viewport" strategy="beforeInteractive">
          {MOBILE_VIEWPORT_STABILITY_SCRIPT}
        </Script>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var n=performance.getEntriesByType("navigation")[0];if(!n||n.type==="reload"||n.type==="navigate"){document.documentElement.classList.add("vero7-splash-active")}var l=localStorage.getItem("${SITE_LOCALE_STORAGE_KEY}");if(l==="en"||l==="fr")document.documentElement.lang=l}catch(e){}})();`,
          }}
        />
        <SiteLocaleInit />
        <SiteLocaleProvider>
        <PageLoadSplash />
        <div id="vero7-app-root" className="flex min-h-full flex-1 flex-col overflow-x-clip">
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
