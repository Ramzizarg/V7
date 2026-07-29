import {
  normalizeSizeKey,
  parseSizeStocks,
  stockForSize,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";

/** Display row for product detail (matches dashboard S / M / L / XL / XXL). */
export const DEFAULT_DISPLAY_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "STANDARD"] as const;

export { normalizeSizeKey };

type SizeInput = {
  sizes?: SizeStock[] | string[] | null;
  stock?: number | null;
};

function toSizeStocks(p: SizeInput): SizeStock[] | null {
  return parseSizeStocks(p.sizes ?? null, p.stock ?? 0);
}

/**
 * - `sizes` null/undefined → legacy row; all default sizes selectable if `stock` > 0.
 * - `sizes` = [] → rupture; nothing selectable.
 * - `sizes` with values → each size selectable when that size's stock > 0.
 */
export function getSizeOptionsForProduct(
  p: SizeInput
): { label: string; available: boolean; stock: number }[] {
  const stocks = toSizeStocks(p);
  const globalStock = Math.max(0, Math.floor(Number(p.stock ?? 0) || 0));

  const order = new Map<string, number>(SIZE_ORDER.map((v, i) => [v, i]));
  const sortLabels = (labels: string[]) =>
    Array.from(new Set(labels.map((x) => x.trim()).filter(Boolean))).sort((a, b) => {
      const aa = normalizeSizeKey(a);
      const bb = normalizeSizeKey(b);
      const ia = order.get(aa);
      const ib = order.get(bb);
      if (ia != null && ib != null) return ia - ib;
      if (ia != null) return -1;
      if (ib != null) return 1;
      return aa.localeCompare(bb, "fr");
    });

  if (stocks == null) {
    return sortLabels([...DEFAULT_DISPLAY_SIZES]).map((label) => ({
      label,
      available: globalStock > 0,
      stock: globalStock,
    }));
  }

  if (stocks.length === 0) {
    return sortLabels([...DEFAULT_DISPLAY_SIZES]).map((label) => ({
      label,
      available: false,
      stock: 0,
    }));
  }

  const byKey = new Map(stocks.map((s) => [normalizeSizeKey(s.size), s]));
  const allLabels = sortLabels([...DEFAULT_DISPLAY_SIZES, ...stocks.map((s) => s.size)]);
  return allLabels.map((label) => {
    const row = byKey.get(normalizeSizeKey(label));
    const stock = row ? Math.max(0, Math.floor(Number(row.stock) || 0)) : 0;
    return { label, available: stock > 0, stock };
  });
}

export function firstAvailableSize(
  options: { label: string; available: boolean }[]
): string | null {
  return options.find((o) => o.available)?.label ?? null;
}

/** No orderable size (all size stocks 0 or no size enabled). */
export function isProductOutOfStock(p: SizeInput): boolean {
  const stocks = toSizeStocks(p);
  if (stocks == null) return Math.max(0, Math.floor(Number(p.stock ?? 0) || 0)) < 1;
  if (stocks.length === 0) return true;
  return totalSizeStock(stocks) < 1;
}

export function remainingStockForSelectedSize(
  p: SizeInput,
  size: string | null | undefined
): number {
  return stockForSize(toSizeStocks(p), size, p.stock ?? 0);
}
