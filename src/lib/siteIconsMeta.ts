import type { Metadata } from "next";

/** Same asset as `V7/V7 2.png`, served from `public` (no space in URL). */
export const brandIcons: NonNullable<Metadata["icons"]> = {
  icon: [{ url: "/V7/V7-2.png", type: "image/png" }],
  shortcut: "/V7/V7-2.png",
  apple: "/V7/V7-2.png",
};

export function siteMetadataBase(): URL {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return new URL(explicit);
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL("http://localhost:3000");
}
