import { NextRequest, NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  decrementSizeStock,
  incrementSizeStock,
  parseSizeStocks,
  serializeSizeStocks,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";

export const runtime = "nodejs";

const MANUAL_STATUSES = new Set(["pending", "occuper", "rejected"]);

type OrderRow = {
  id: number;
  status: string;
  calirex_code_colis: string | null;
};

type OrderItemRow = {
  product_id: number | string | null;
  quantity: number | string | null;
  size: string | null;
};

type ProductStockRow = {
  id: number | string;
  name: string;
  stock: number | string | null;
  sizes: unknown;
};

function normalizeStatus(status: string) {
  const s = status?.toLowerCase?.() ?? "";
  if (MANUAL_STATUSES.has(s)) return s;
  if (s === "shipped" || s === "out_for_delivery") return "out_for_delivery";
  if (s === "delivered") return "delivered";
  return "pending";
}

export async function POST(req: NextRequest) {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }

    const body = (await req.json()) as { orderId?: number | string; status?: string };
    const orderId = Number(body.orderId);
    const nextStatus = String(body.status ?? "")
      .trim()
      .toLowerCase();

    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    }
    if (!MANUAL_STATUSES.has(nextStatus)) {
      return NextResponse.json(
        { error: "Statut manuel invalide. Utilisez pending, occuper ou rejected." },
        { status: 400 }
      );
    }

    const orderRes = await neonQuery<OrderRow>(
      `SELECT id, status, calirex_code_colis FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    const order = orderRes.rows[0];
    if (!order) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }
    if (order.calirex_code_colis) {
      return NextResponse.json(
        { error: "Commande déjà expédiée via Calirex — le statut suit le transporteur." },
        { status: 409 }
      );
    }

    const previousStatus = normalizeStatus(order.status);
    if (previousStatus === nextStatus) {
      return NextResponse.json({ success: true, orderId, status: nextStatus, unchanged: true });
    }

    const wasRejected = previousStatus === "rejected";
    const willReject = nextStatus === "rejected";
    const needsRestore = willReject && !wasRejected;
    const needsDeduct = wasRejected && !willReject;

    if (needsRestore || needsDeduct) {
      const itemsRes = await neonQuery<OrderItemRow>(
        `SELECT product_id, quantity, size FROM order_items WHERE order_id = $1`,
        [orderId]
      );
      const items = itemsRes.rows ?? [];
      const demand = new Map<string, { productId: number; size: string; qty: number }>();
      for (const item of items) {
        const productId = Number(item.product_id);
        const qty = Math.floor(Number(item.quantity) || 0);
        const size = typeof item.size === "string" ? item.size.trim() : "";
        if (!Number.isFinite(productId) || productId < 1 || qty < 1 || !size) continue;
        const key = `${productId}::${size.toUpperCase()}`;
        const prev = demand.get(key);
        if (prev) prev.qty += qty;
        else demand.set(key, { productId, size, qty });
      }

      const productIds = [...new Set([...demand.values()].map((d) => d.productId))];
      if (productIds.length > 0) {
        const placeholders = productIds.map((_, i) => `$${i + 1}`).join(", ");
        const { rows: productRows } = await neonQuery<ProductStockRow>(
          `SELECT id, name, stock, sizes FROM products WHERE id IN (${placeholders})`,
          productIds
        );
        const byId = new Map(
          (productRows ?? [])
            .map((r) => [Number(r.id), r] as const)
            .filter(([id]) => Number.isFinite(id) && id > 0)
        );
        const nextByProduct = new Map<number, { sizes: SizeStock[]; total: number; name: string }>();

        for (const d of demand.values()) {
          const row = byId.get(d.productId);
          if (!row) continue;

          let state = nextByProduct.get(d.productId);
          if (!state) {
            const parsed = parseSizeStocks(row.sizes, Number(row.stock) || 0);
            const sizes =
              parsed && parsed.length > 0
                ? parsed.map((s) => ({ ...s }))
                : [{ size: d.size, stock: Math.max(0, Math.floor(Number(row.stock) || 0)) }];
            state = { sizes, total: totalSizeStock(sizes), name: row.name };
            nextByProduct.set(d.productId, state);
          }

          if (needsRestore) {
            const incremented = incrementSizeStock(state.sizes, d.size, d.qty);
            state.sizes = incremented.sizes;
            state.total = incremented.total;
          } else {
            const decremented = decrementSizeStock(state.sizes, d.size, d.qty);
            if (!decremented) {
              return NextResponse.json(
                { error: `Rupture de stock pour « ${state.name} » (${d.size}).` },
                { status: 409 }
              );
            }
            state.sizes = decremented.sizes;
            state.total = decremented.total;
          }
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
    }

    await neonQuery(`UPDATE orders SET status = $1 WHERE id = $2`, [nextStatus, orderId]);

    return NextResponse.json({
      success: true,
      orderId,
      status: nextStatus,
      previousStatus,
      stockAdjusted: needsRestore || needsDeduct,
    });
  } catch (err) {
    console.error("[update-order-status]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Impossible de changer le statut." },
      { status: 500 }
    );
  }
}
