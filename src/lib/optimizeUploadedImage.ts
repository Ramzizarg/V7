import sharp from "sharp";

const MAX_WIDTH: Record<"product" | "home" | "sizeGuide", number> = {
  product: 2000,
  home: 2560,
  sizeGuide: 2400,
};

const SKIP_OPTIMIZE_EXT = new Set(["svg", "gif", "ico"]);

/**
 * Resize and encode uploads as WebP to keep blobs small (Shopify-like targets).
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
  const optimized = await sharp(bytes, { failOn: "none" })
    .rotate()
    .resize({ width: maxWidth, withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  return { bytes: optimized, ext: "webp", contentType: "image/webp" };
}
