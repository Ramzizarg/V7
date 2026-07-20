import { shouldBypassImageOptimization } from "@/lib/imageOptimize";

/** Main product gallery frame (desktop reference size). */
export const PRODUCT_GALLERY_WIDTH_PX = 544;
export const PRODUCT_GALLERY_HEIGHT_PX = 580;

export const PRODUCT_GALLERY_SIZES = `${PRODUCT_GALLERY_WIDTH_PX}px`;

/**
 * Widths Next may request for the main gallery (sizes≈544px × 1–3 DPR).
 * Must exist in next.config `deviceSizes` / `imageSizes`.
 */
const GALLERY_PRELOAD_WIDTHS = [640, 1080, 1200] as const;

/** Warm the same URL `next/image` will fetch (not the raw Blob/PNG). */
export function preloadProductGalleryImage(src: string, quality = 75) {
  if (typeof window === "undefined" || !src.trim()) return;

  if (shouldBypassImageOptimization(src)) {
    const img = new window.Image();
    img.decoding = "async";
    img.src = src;
    return;
  }

  for (const w of GALLERY_PRELOAD_WIDTHS) {
    const img = new window.Image();
    img.decoding = "async";
    img.src = `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=${quality}`;
  }
}

export function preloadProductGalleryImages(srcs: string[]) {
  srcs.forEach((src) => preloadProductGalleryImage(src));
}
