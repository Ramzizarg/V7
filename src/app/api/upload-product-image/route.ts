import { put } from "@vercel/blob";
import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { optimizeUploadedImage } from "@/lib/optimizeUploadedImage";

export const runtime = "nodejs";

const SAFE_EXTS = new Set(["jpg", "jpeg", "png", "webp", "gif", "avif", "bmp", "svg", "ico"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/svg+xml": "svg",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
};

function getExt(filename: string, mimeType?: string) {
  const fromName = filename.split(".").pop()?.toLowerCase() || "";
  if (SAFE_EXTS.has(fromName)) return fromName;
  const fromMime = mimeType ? MIME_TO_EXT[mimeType.toLowerCase()] : "";
  if (fromMime && SAFE_EXTS.has(fromMime)) return fromMime;
  return "jpg";
}

function useVercelBlob() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN?.trim());
}

/**
 * Vercel serverless FS is read-only; uploads must go to Vercel Blob in production.
 * Set BLOB_READ_WRITE_TOKEN in the project (Vercel: Storage → Blob, or copy read-write token).
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const type = String(formData.get("type") || "product");
    if (!file?.size) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (!file.type?.toLowerCase().startsWith("image/")) {
      return NextResponse.json({ error: "Only image files are allowed" }, { status: 400 });
    }

    const rawBytes = Buffer.from(await file.arrayBuffer());
    const extIn = getExt(file.name, file.type);
    const uploadType = type === "sizeGuide" ? "sizeGuide" : type === "home" ? "home" : "product";
    const { bytes, ext, contentType } = await optimizeUploadedImage(rawBytes, extIn, uploadType);
    const folder = type === "sizeGuide" ? "size-guides" : type === "home" ? "home" : "products";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const isVercel = process.env.VERCEL === "1" || process.env.VERCEL_ENV != null;
    if (isVercel && !useVercelBlob()) {
      return NextResponse.json(
        {
          error:
            "Vercel Blob n'est pas configure. Ouvrez le projet Vercel → Storage → creez un store Blob, puis liez le ou ajoutez la variable BLOB_READ_WRITE_TOKEN (Read-Write). Redeployez.",
        },
        { status: 503 }
      );
    }

    if (useVercelBlob()) {
      const pathname = `uploads/${folder}/${filename}`;
      const blob = await put(pathname, bytes, {
        access: "public",
        contentType,
        addRandomSuffix: false,
      });
      return NextResponse.json({ url: blob.url });
    }

    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);

    return NextResponse.json({ url: `/uploads/${folder}/${filename}` });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Upload failed";
    if (process.env.NODE_ENV === "development") {
      console.error("[upload-product-image]", e);
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
