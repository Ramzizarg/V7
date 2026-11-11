import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  incrementSizeStock,
  parseSizeStocks,
  serializeSizeStocks,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";

const TUNIS_TZ = "Africa/Tunis";

type OldOrderItem = {
  order_id: number;
  status: string;
  product_id: number | string | null;
  quantity: number | string | null;
  size: string | null;
};

type ProductStockRow = {
  id: number | string;
  stock: number | string | null;
  sizes: unknown;
};

function tunisParts(now: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TUNIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** Instant for a Tunis wall-clock datetime (UTC+1, no DST). */
function tunisWallTimeMs(year: number, month: number, day: number, hour = 0, minute = 0, second = 0) {
  return Date.parse(
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}+01:00`
  );
}

/** Keep only the current Tunis calendar month; older months are purged. */
export function ordersRetentionCutoff(now = new Date()): Date {
  const t = tunisParts(now);
  return new Date(tunisWallTimeMs(t.year, t.month, 1));
}

function stockStillHeld(status: string) {
  const s = status.trim().toLowerCase();
  return s === "pending" || s === "occuper" || s === "confirmed" || s === "occupe" || s === "occupé";
}

/**
 * Delete orders older than the retention cutoff.
 * Restores size stock only for open statuses (pending / occupé) that still hold inventory.
 */
export async function purgeOldOrders(now = new Date()) {
  if (!resolveDatabaseUrl()) {
    return { skipped: true as const, deleted: 0, cutoff: null as string | null };
  }

  const cutoff = ordersRetentionCutoff(now);
  const cutoffIso = cutoff.toISOString();

  const countRes = await neonQuery<{ n: string }>(
    `SELECT COUNT(*)::text AS n FROM orders WHERE created_at < $1::timestamptz`,
    [cutoffIso]
  );
  const toDelete = Number(countRes.rows[0]?.n || 0);
  if (!Number.isFinite(toDelete) || toDelete < 1) {
    return { skipped: false as const, deleted: 0, cutoff: cutoffIso };
  }

  // Restore stock for open orders that still deducted inventory
  const itemsRes = await neonQuery<OldOrderItem>(
    `SELECT o.id AS order_id, o.status, oi.product_id, oi.quantity, oi.size
     FROM orders o
     JOIN order_items oi ON oi.order_id = o.id
     WHERE o.created_at < $1::timestamptz`,
    [cutoffIso]
  );

  const restore = new Map<string, { productId: number; size: string; qty: number }>();
  for (const item of itemsRes.rows ?? []) {
    if (!stockStillHeld(item.status || "")) continue;
    const productId = Number(item.product_id);
    const qty = Math.floor(Number(item.quantity) || 0);
    const size = typeof item.size === "string" ? item.size.trim() : "";
    if (!Number.isFinite(productId) || productId < 1 || qty < 1 || !size) continue;
    const key = `${productId}::${size.toUpperCase()}`;
    const prev = restore.get(key);
    if (prev) prev.qty += qty;
    else restore.set(key, { productId, size, qty });
  }

  const productIds = [...new Set([...restore.values()].map((r) => r.productId))];
  if (productIds.length > 0) {
    const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
    const { rows: productRows } = await neonQuery<ProductStockRow>(
      `SELECT id, stock, sizes FROM products WHERE id IN (${placeholders})`,
      productIds
    );
    const byId = new Map(
      (productRows ?? [])
        .map((r) => [Number(r.id), r] as const)
        .filter(([id]) => Number.isFinite(id) && id > 0)
    );
    const nextByProduct = new Map<number, { sizes: SizeStock[]; total: number }>();

    for (const r of restore.values()) {
      const row = byId.get(r.productId);
      if (!row) continue;
      let state = nextByProduct.get(r.productId);
      if (!state) {
        const parsed = parseSizeStocks(row.sizes, Number(row.stock) || 0);
        const sizes =
          parsed && parsed.length > 0
            ? parsed.map((s) => ({ ...s }))
            : [{ size: r.size, stock: Math.max(0, Math.floor(Number(row.stock) || 0)) }];
        state = { sizes, total: totalSizeStock(sizes) };
        nextByProduct.set(r.productId, state);
      }
      const incremented = incrementSizeStock(state.sizes, r.size, r.qty);
      state.sizes = incremented.sizes;
      state.total = incremented.total;
    }

    for (const [productId, state] of nextByProduct) {
      const sizesJson = JSON.stringify(serializeSizeStocks(state.sizes));
      await neonQuery(`UPDATE products SET sizes = $1::jsonb, stock = $2 WHERE id = $3`, [
        sizesJson,
        state.total,
        productId,
      ]);
    }
  }

  // order_items cascade on delete
  const deletedRes = await neonQuery<{ id: number }>(
    `DELETE FROM orders WHERE created_at < $1::timestamptz RETURNING id`,
    [cutoffIso]
  );

  return {
    skipped: false as const,
    deleted: deletedRes.rows.length,
    cutoff: cutoffIso,
  };
}
