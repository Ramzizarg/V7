import sharp from "sharp";

/**
 * Gymshark-like web targets: sharp source files stay modest; Next.js `/_next/image`
 * still serves viewport-sized AVIF/WebP at request time.
 */
const MAX_WIDTH: Record<"product" | "home" | "sizeGuide", number> = {
  product: 1600,
  home: 1920,
  sizeGuide: 1600,
};

const UPLOAD_QUALITY: Record<"product" | "home" | "sizeGuide", number> = {
  product: 80,
  home: 82,
  sizeGuide: 82,
};

const SKIP_OPTIMIZE_EXT = new Set(["svg", "gif", "ico"]);

/**
 * Resize and encode uploads as WebP to keep blobs small.
 * Returns original bytes for formats we should not transform.
 */
export async function optimizeUploadedImage(
  bytes: Buffer,
  ext: string,
  type: "product" | "home" | "sizeGuide"
): Promise<{ bytes: Buffer; ext: string; contentType: string }> {
  const normalized = ext.toLowerCase();
  if (SKIP_OPTIMIZE_EXT.has(normalized)) {
    const contentType =
      normalized === "svg"
        ? "image/svg+xml"
        : normalized === "gif"
          ? "image/gif"
          : "image/x-icon";
    return { bytes, ext: normalized, contentType };
  }

  const maxWidth = MAX_WIDTH[type];
  const quality = UPLOAD_QUALITY[type];
  const optimized = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality, effort: 6 })
    .toBuffer();

  return { bytes: optimized, ext: "webp", contentType: "image/webp" };
}
