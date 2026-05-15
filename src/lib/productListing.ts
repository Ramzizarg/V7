import { isProductOutOfStock } from "@/lib/productSizesDisplay";
import type { Product } from "@/lib/types";

/** `active === false` → teaser only (“coming soon”), no checkout. */
export function isProductListedForSale(product: Pick<Product, "active">): boolean {
  return product.active !== false;
}

/** Actif + au moins une taille / stock (recherche, suggestions achetables). */
export function isProductAvailableForPurchase(
  product: Pick<Product, "active" | "sizes" | "stock">
): boolean {
  return isProductListedForSale(product) && !isProductOutOfStock(product);
}

export function parseProductActive(raw: unknown): boolean {
  if (raw === false || raw === 0 || raw === "0" || raw === "false" || raw === "f" || raw === "F") return false;
  return true;
}
