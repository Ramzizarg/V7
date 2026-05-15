import type { Product } from "@/lib/types";

/** `active === false` → teaser only (“coming soon”), no checkout. */
export function isProductListedForSale(product: Pick<Product, "active">): boolean {
  return product.active !== false;
}

export function parseProductActive(raw: unknown): boolean {
  if (raw === false || raw === 0 || raw === "0" || raw === "false" || raw === "f" || raw === "F") return false;
  return true;
}
