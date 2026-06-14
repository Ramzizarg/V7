/** SVG is not passed through the Next.js image optimizer. */
export function isSvgImageSrc(src: string): boolean {
  const path = src.split("?")[0]?.split("#")[0] ?? src;
  return /\.svg$/i.test(path);
}

/** Use native / unoptimized delivery only when optimization cannot apply. */
export function shouldBypassImageOptimization(src: string): boolean {
  return isSvgImageSrc(src);
}

/** Uploaded blobs are already WebP — skip Next.js recompression for full-bleed hero delivery. */
export function shouldServePreOptimizedImage(src: string): boolean {
  if (shouldBypassImageOptimization(src)) return true;
  if (src.startsWith("/uploads/")) return true;
  return /blob\.vercel-storage\.com/i.test(src);
}
