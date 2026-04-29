import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { brandIcons, siteMetadataBase } from "@/lib/siteIconsMeta";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
