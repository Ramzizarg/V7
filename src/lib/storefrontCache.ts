import { syncClientCachesWithDeployment } from "@/lib/appBuildId";
import type { Product, StorefrontCategory } from "@/lib/types";

const STORAGE_KEY = "vero7:storefront-catalog";

export type StorefrontCatalog = {
  products: Product[];
  categories: StorefrontCategory[];
};

export function getCachedStorefrontSync(): StorefrontCatalog | null {
  if (typeof window === "undefined") return null;
  syncClientCachesWithDeployment();
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StorefrontCatalog;
    if (!Array.isArray(parsed.products) || !Array.isArray(parsed.categories)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setCachedStorefront(catalog: StorefrontCatalog): void {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(catalog));
  } catch {
    // quota / private mode
  }
}

export function clearStorefrontCache(): void {
  if (typeof window === "undefined") return;
  sessionStorage.removeItem(STORAGE_KEY);
}
