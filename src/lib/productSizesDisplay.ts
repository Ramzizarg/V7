/** Display row for product detail (matches dashboard S / M / L / XL / XXL). */
export const DEFAULT_DISPLAY_SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;

const SIZE_ORDER = ["XS", "S", "M", "L", "XL", "XXL", "STANDARD"] as const;

export function normalizeSizeKey(s: string): string {
  const t = s.trim().toUpperCase();
  if (t === "STANDAR" || t === "STANDARD") return "STANDARD";
  return t;
}

type SizeInput = {
  sizes?: string[] | null;
  stock?: number | null;
};

/**
 * - No explicit `sizes` in data → show default row; all are selectable if `stock` > 0.
 * - Explicit `sizes` (from dashboard) → show union of default row + any extra size; only listed sizes are selectable.
 */
export function getSizeOptionsForProduct(p: SizeInput): { label: string; available: boolean }[] {
  const stockOk = Number(p.stock ?? 0) > 0;
  const explicit = (p.sizes ?? []).filter((x) => typeof x === "string" && x.trim().length > 0);
  const hasExplicit = explicit.length > 0;

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

  if (!hasExplicit) {
    return sortLabels([...DEFAULT_DISPLAY_SIZES]).map((label) => ({ label, available: stockOk }));
  }

  const allowed = new Set(explicit.map(normalizeSizeKey));
  const allLabels = sortLabels([...DEFAULT_DISPLAY_SIZES, ...explicit]);
  return allLabels.map((label) => ({
    label,
    available: stockOk && allowed.has(normalizeSizeKey(label)),
  }));
}

export function firstAvailableSize(options: { label: string; available: boolean }[]): string | null {
  return options.find((o) => o.available)?.label ?? null;
}

/** No orderable size (global stock 0 or no size enabled). */
export function isProductOutOfStock(p: SizeInput): boolean {
  return !getSizeOptionsForProduct(p).some((o) => o.available);
}
