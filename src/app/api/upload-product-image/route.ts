import { NextRequest, NextResponse } from "next/server";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

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

    const bytes = Buffer.from(await file.arrayBuffer());
    const ext = getExt(file.name, file.type);
    const folder = type === "sizeGuide" ? "size-guides" : type === "home" ? "home" : "products";
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    const uploadDir = path.join(process.cwd(), "public", "uploads", folder);
    await mkdir(uploadDir, { recursive: true });
    await writeFile(path.join(uploadDir, filename), bytes);

    return NextResponse.json({ url: `/uploads/${folder}/${filename}` });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Upload failed" }, { status: 500 });
  }
}
