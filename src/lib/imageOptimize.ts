/** SVG is not passed through the Next.js image optimizer. */
export function isSvgImageSrc(src: string): boolean {
  const path = src.split("?")[0]?.split("#")[0] ?? src;
  return /\.svg$/i.test(path);
}

/**
 * Use native / unoptimized delivery only when Next cannot optimize (SVG).
 * Uploads and Blob URLs must go through `/_next/image` so browsers get
 * viewport-sized AVIF/WebP (~50–150KB) instead of multi‑MB originals.
 */
export function shouldBypassImageOptimization(src: string): boolean {
  return isSvgImageSrc(src);
}
