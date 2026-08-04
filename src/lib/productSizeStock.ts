/** Per-size inventory stored in `products.sizes` jsonb. */
export type SizeStock = {
  size: string;
  stock: number;
};

export function normalizeSizeKey(s: string): string {
  const t = s.trim().toUpperCase();
  if (t === "STANDAR" || t === "STANDARD") return "STANDARD";
  return t;
}

function isSizeStockRow(x: unknown): x is { size?: unknown; stock?: unknown; qty?: unknown } {
  return typeof x === "object" && x != null && ("size" in x || "label" in x);
}

function rowToSizeStock(x: Record<string, unknown>): SizeStock | null {
  const sizeRaw = x.size ?? x.label;
  if (typeof sizeRaw !== "string" || !sizeRaw.trim()) return null;
  const stockRaw = x.stock ?? x.qty ?? 0;
  const stock = Math.max(0, Math.floor(Number(stockRaw) || 0));
  return { size: sizeRaw.trim(), stock };
}

/**
 * Normalize DB `sizes` jsonb:
 * - `[{ size, stock }]` → as-is
 * - `["S","M"]` legacy → distribute `fallbackStock` across sizes (equal + remainder)
 * - `null` / invalid → `null` (legacy “all sizes” when used with global stock)
 * - `[]` → empty (out of stock)
 */
export function parseSizeStocks(raw: unknown, fallbackStock = 0): SizeStock[] | null {
  if (raw == null) return null;

  let arr: unknown[] | null = null;
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    try {
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) arr = j;
    } catch {
      return null;
    }
  }
  if (!arr) return null;
  if (arr.length === 0) return [];

  if (arr.every((x) => typeof x === "string")) {
    const labels = arr
      .filter((x): x is string => typeof x === "string" && x.trim().length > 0)
      .map((x) => x.trim());
    if (labels.length === 0) return [];
    const total = Math.max(0, Math.floor(Number(fallbackStock) || 0));
    const base = Math.floor(total / labels.length);
    let rem = total - base * labels.length;
    return labels.map((size) => {
      const extra = rem > 0 ? 1 : 0;
      if (rem > 0) rem -= 1;
      return { size, stock: base + extra };
    });
  }

  if (arr.every(isSizeStockRow)) {
    const out: SizeStock[] = [];
    for (const item of arr) {
      const row = rowToSizeStock(item as Record<string, unknown>);
      if (row) out.push(row);
    }
    return out;
  }

  // Mixed / partial objects
  const out: SizeStock[] = [];
  for (const item of arr) {
    if (typeof item === "string" && item.trim()) {
      out.push({ size: item.trim(), stock: 0 });
    } else if (isSizeStockRow(item)) {
      const row = rowToSizeStock(item as Record<string, unknown>);
      if (row) out.push(row);
    }
  }
  return out;
}

export function totalSizeStock(sizes: SizeStock[] | null | undefined): number {
  if (!sizes || sizes.length === 0) return 0;
  return sizes.reduce((sum, s) => sum + Math.max(0, Math.floor(Number(s.stock) || 0)), 0);
}

export function sizeStockLabels(sizes: SizeStock[] | null | undefined): string[] {
  if (!sizes) return [];
  return sizes.map((s) => s.size).filter(Boolean);
}

export function stockForSize(
  sizes: SizeStock[] | null | undefined,
  size: string | null | undefined,
  fallbackGlobalStock = 0
): number {
  if (!size || !String(size).trim()) {
    return Math.max(0, Math.floor(Number(fallbackGlobalStock) || 0));
  }
  if (sizes == null) {
    return Math.max(0, Math.floor(Number(fallbackGlobalStock) || 0));
  }
  const key = normalizeSizeKey(size);
  const row = sizes.find((s) => normalizeSizeKey(s.size) === key);
  return row ? Math.max(0, Math.floor(Number(row.stock) || 0)) : 0;
}

/** Decrement qty for a size; returns new list + total, or null if insufficient. */
export function decrementSizeStock(
  sizes: SizeStock[],
  size: string,
  qty: number
): { sizes: SizeStock[]; total: number } | null {
  const need = Math.max(1, Math.floor(Number(qty) || 0));
  const key = normalizeSizeKey(size);
  const idx = sizes.findIndex((s) => normalizeSizeKey(s.size) === key);
  if (idx < 0) return null;
  const current = Math.max(0, Math.floor(Number(sizes[idx].stock) || 0));
  if (current < need) return null;
  const next = sizes.map((s, i) => (i === idx ? { ...s, stock: current - need } : { ...s }));
  return { sizes: next, total: totalSizeStock(next) };
}

/** Restore qty for a size (creates the size row if missing). */
export function incrementSizeStock(
  sizes: SizeStock[],
  size: string,
  qty: number
): { sizes: SizeStock[]; total: number } {
  const add = Math.max(0, Math.floor(Number(qty) || 0));
  if (add < 1) return { sizes: sizes.map((s) => ({ ...s })), total: totalSizeStock(sizes) };
  const key = normalizeSizeKey(size);
  const idx = sizes.findIndex((s) => normalizeSizeKey(s.size) === key);
  if (idx < 0) {
    const next = [...sizes.map((s) => ({ ...s })), { size: size.trim(), stock: add }];
    return { sizes: next, total: totalSizeStock(next) };
  }
  const current = Math.max(0, Math.floor(Number(sizes[idx].stock) || 0));
  const next = sizes.map((s, i) => (i === idx ? { ...s, stock: current + add } : { ...s }));
  return { sizes: next, total: totalSizeStock(next) };
}

export function serializeSizeStocks(sizes: SizeStock[]): SizeStock[] {
  return sizes
    .filter((s) => typeof s.size === "string" && s.size.trim().length > 0)
    .map((s) => ({
      size: s.size.trim(),
      stock: Math.max(0, Math.floor(Number(s.stock) || 0)),
    }));
}
