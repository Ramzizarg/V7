import type { Metadata } from "next";

/** Circular V7 mark from `vero7-logo.png` (browser tab / bookmarks / Apple touch). */
export const brandIcons: NonNullable<Metadata["icons"]> = {
  icon: [
    { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
    { url: "/vero7-favicon-circle.png", sizes: "512x512", type: "image/png" },
  ],
  shortcut: "/favicon-32.png",
  apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
};

export function siteMetadataBase(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL("http://localhost:3000");
}
