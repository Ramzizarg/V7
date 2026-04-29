const UPLOAD_API = "/api/upload-product-image";

async function uploadViaApi(file: File, type: "home" | "product" | "sizeGuide") {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("type", type);
  const res = await fetch(UPLOAD_API, { method: "POST", body: formData });
  const data = (await res.json().catch(() => null)) as { url?: string; error?: string } | null;
  if (!res.ok || !data?.url) {
    throw new Error(data?.error || "Upload failed");
  }
  return data.url;
}

export async function uploadHomeImage(_pathPrefix: string, file: File): Promise<string> {
  return uploadViaApi(file, "home");
}

export async function uploadHeroImage(file: File): Promise<string> {
  return uploadViaApi(file, "home");
}
