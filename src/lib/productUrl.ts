/** URL segment for `/collection/[slug]` (slug DB ou nom du produit). */
export function productPathSlug(product: { id: number; slug?: string | null; name?: string | null }): string {
  const s = product.slug?.trim();
  if (s) return s;
  const byName = slugifyProductName(product.name);
  if (byName) return byName;
  return `id-${product.id}`;
}

export function slugifyProductName(name: string | null | undefined): string {
  if (!name) return "";
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
