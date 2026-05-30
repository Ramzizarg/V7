/** SVG is not passed through the Next.js image optimizer. */
export function isSvgImageSrc(src: string): boolean {
  const path = src.split("?")[0]?.split("#")[0] ?? src;
  return /\.svg$/i.test(path);
}

/** Use native / unoptimized delivery only when optimization cannot apply. */
export function shouldBypassImageOptimization(src: string): boolean {
  return isSvgImageSrc(src);
}
