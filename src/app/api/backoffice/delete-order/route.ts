import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  BACKOFFICE_SESSION_COOKIE,
  verifyBackofficeSessionToken,
} from "@/lib/backofficeAuth";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  incrementSizeStock,
  parseSizeStocks,
  serializeSizeStocks,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";

export const runtime = "nodejs";

type OrderItemRow = {
  product_id: number | string | null;
  quantity: number | string | null;
  size: string | null;
};

type ProductStockRow = {
  id: number | string;
  stock: number | string | null;
  sizes: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const jar = await cookies();
    const token = jar.get(BACKOFFICE_SESSION_COOKIE)?.value;
    if (!(await verifyBackofficeSessionToken(token))) {
      return NextResponse.json({ error: "Non autorisé." }, { status: 401 });
    }

    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }

    const body = (await req.json()) as { orderId?: number | string };
    const orderId = Number(body.orderId);
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    }

    const orderCheck = await neonQuery<{ id: number }>(
      `SELECT id FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    if (!orderCheck.rows[0]?.id) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    const itemsRes = await neonQuery<OrderItemRow>(
      `SELECT product_id, quantity, size FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const items = itemsRes.rows ?? [];

    const restore = new Map<string, { productId: number; size: string; qty: number }>();
    for (const item of items) {
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

    await neonQuery(`DELETE FROM orders WHERE id = $1`, [orderId]);

    return NextResponse.json({ success: true, orderId });
  } catch (err) {
    console.error("[delete-order] unexpected error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne." },
      { status: 500 }
    );
  }
}
