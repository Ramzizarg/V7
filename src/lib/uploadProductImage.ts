const UPLOAD_API = "/api/upload-product-image";

async function uploadViaApi(file: File, type: "product" | "sizeGuide"): Promise<string> {
  const formData = new FormData();
  formData.set("file", file);
  formData.set("type", type);
  const res = await fetch(UPLOAD_API, { method: "POST", body: formData });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Upload failed");
  if (!data.url) throw new Error("No URL returned");
  return data.url;
}

/** Upload size guide image; returns public URL. Uses API so bucket is created if missing. */
export async function uploadSizeGuideImage(file: File): Promise<string> {
  return uploadViaApi(file, "sizeGuide");
}

/** Upload one product image; returns public URL. Uses API so bucket is created if missing. */
export async function uploadProductImage(file: File): Promise<string> {
  return uploadViaApi(file, "product");
}
