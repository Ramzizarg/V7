import { NextRequest, NextResponse } from "next/server";
import { requireBackofficeSession } from "@/lib/requireBackofficeSession";
import { neonQuery, resolveDatabaseUrl } from "@/lib/neon-db";
import {
  isValidTunisiaPhone,
  normalizeTunisiaPhoneDigits,
  TUNISIA_PHONE_ERROR,
} from "@/lib/phoneValidation";
import {
  decrementSizeStock,
  incrementSizeStock,
  parseSizeStocks,
  serializeSizeStocks,
  totalSizeStock,
  type SizeStock,
} from "@/lib/productSizeStock";

export const runtime = "nodejs";
export const maxDuration = 60;

type UpdateItem = {
  productId?: number | string;
  product_name?: string;
  quantity?: number | string;
  price?: number | string;
  size?: string | null;
  color?: string | null;
};

type ProductStockRow = {
  id: number | string;
  name: string;
  stock: number | string | null;
  sizes: unknown;
};

type OldItem = {
  product_id: number | string | null;
  quantity: number | string | null;
  size: string | null;
};

export async function POST(req: NextRequest) {
  const denied = await requireBackofficeSession();
  if (denied) return denied;

  try {
    if (!resolveDatabaseUrl()) {
      return NextResponse.json({ error: "DATABASE_URL manquant." }, { status: 503 });
    }

    const body = (await req.json()) as {
      orderId?: number | string;
      fullName?: string;
      email?: string;
      phone?: string;
      phone2?: string;
      address?: string;
      city?: string;
      governorate?: string;
      total?: number;
      subtotal?: number;
      shipping?: number;
      items?: UpdateItem[];
    };

    const orderId = Number(body.orderId);
    if (!Number.isFinite(orderId) || orderId < 1) {
      return NextResponse.json({ error: "Commande invalide." }, { status: 400 });
    }

    const fullName = body.fullName?.trim() ?? "";
    const email = body.email?.trim() ?? "";
    const phone = normalizeTunisiaPhoneDigits(body.phone ?? "");
    const phone2Raw = normalizeTunisiaPhoneDigits(body.phone2 ?? "");
    const phone2 = phone2Raw.length > 0 ? phone2Raw : "";
    const address = body.address?.trim() ?? "";
    const city = body.city?.trim() ?? "";
    const governorate = body.governorate?.trim() ?? "";
    const items = Array.isArray(body.items) ? body.items : [];

    if (!fullName || !phone || !address || !city || !governorate) {
      return NextResponse.json({ error: "Champs client manquants." }, { status: 400 });
    }
    if (!isValidTunisiaPhone(phone)) {
      return NextResponse.json({ error: TUNISIA_PHONE_ERROR }, { status: 400 });
    }
    if (phone2 && !isValidTunisiaPhone(phone2)) {
      return NextResponse.json({ error: "Le 2ᵉ téléphone doit contenir exactement 8 chiffres." }, { status: 400 });
    }
    if (items.length === 0) {
      return NextResponse.json({ error: "Ajoutez au moins un produit." }, { status: 400 });
    }

    const orderCheck = await neonQuery<{ id: number; calirex_code_colis: string | null }>(
      `SELECT id, calirex_code_colis FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    if (!orderCheck.rows[0]?.id) {
      return NextResponse.json({ error: "Commande introuvable." }, { status: 404 });
    }

    for (const item of items) {
      const productId = Number(item.productId);
      const qty = Math.floor(Number(item.quantity) || 0);
      if (!Number.isFinite(productId) || productId < 1 || qty < 1) {
        return NextResponse.json({ error: "Article invalide." }, { status: 400 });
      }
      if (!item.size || !String(item.size).trim()) {
        return NextResponse.json(
          { error: `Taille manquante pour « ${item.product_name || "produit"} ».` },
          { status: 400 }
        );
      }
    }

    const oldItemsRes = await neonQuery<OldItem>(
      `SELECT product_id, quantity, size FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const oldItems = oldItemsRes.rows ?? [];

    // Net demand after restoring old lines into available stock
    const restore = new Map<string, { productId: number; size: string; qty: number }>();
    for (const item of oldItems) {
      const productId = Number(item.product_id);
      const qty = Math.floor(Number(item.quantity) || 0);
      const size = typeof item.size === "string" ? item.size.trim() : "";
      if (!Number.isFinite(productId) || productId < 1 || qty < 1 || !size) continue;
      const key = `${productId}::${size.toUpperCase()}`;
      const prev = restore.get(key);
      if (prev) prev.qty += qty;
      else restore.set(key, { productId, size, qty });
    }

    const demand = new Map<string, { productId: number; size: string; qty: number; name: string; price: number; color: string | null }>();
    for (const item of items) {
      const productId = Number(item.productId);
      const size = String(item.size).trim();
      const qty = Math.floor(Number(item.quantity) || 0);
      const key = `${productId}::${size.toUpperCase()}`;
      const prev = demand.get(key);
      if (prev) prev.qty += qty;
      else {
        demand.set(key, {
          productId,
          size,
          qty,
          name: item.product_name || "",
          price: Number(item.price) || 0,
          color: item.color ? String(item.color) : null,
        });
      }
    }

    const productIds = [
      ...new Set([
        ...[...restore.values()].map((r) => r.productId),
        ...[...demand.values()].map((d) => d.productId),
      ]),
    ];

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

    const ensureState = (productId: number, fallbackSize?: string) => {
      let state = nextByProduct.get(productId);
      if (state) return state;
      const row = byId.get(productId);
      if (!row) return null;
      const parsed = parseSizeStocks(row.sizes, Number(row.stock) || 0);
      const sizes =
        parsed && parsed.length > 0
          ? parsed.map((s) => ({ ...s }))
          : fallbackSize
            ? [{ size: fallbackSize, stock: Math.max(0, Math.floor(Number(row.stock) || 0)) }]
            : [];
      state = { sizes, total: totalSizeStock(sizes), name: row.name };
      nextByProduct.set(productId, state);
      return state;
    };

    // Restore old order stock first
    for (const r of restore.values()) {
      const state = ensureState(r.productId, r.size);
      if (!state) continue;
      const inc = incrementSizeStock(state.sizes, r.size, r.qty);
      state.sizes = inc.sizes;
      state.total = inc.total;
    }

    // Then apply new demand
    for (const d of demand.values()) {
      const state = ensureState(d.productId, d.size);
      if (!state) {
        return NextResponse.json(
          { error: `Produit introuvable : ${d.name || d.productId}.` },
          { status: 400 }
        );
      }
      if (!state.sizes.length) {
        return NextResponse.json({ error: `Rupture de stock pour « ${state.name} ».` }, { status: 409 });
      }
      const dec = decrementSizeStock(state.sizes, d.size, d.qty);
      if (!dec) {
        return NextResponse.json(
          { error: `Stock insuffisant pour « ${state.name} » (taille ${d.size}).` },
          { status: 409 }
        );
      }
      state.sizes = dec.sizes;
      state.total = dec.total;
    }

    const total = Number(body.total ?? 0);

    await neonQuery(
      `UPDATE orders SET
         full_name = $1,
         email = $2,
         phone_number = $3,
         phone_number_2 = $4,
         address = $5,
         city = $6,
         governorate = $7,
         total_price = $8
       WHERE id = $9`,
      [fullName, email || null, phone, phone2 || null, address, city, governorate, total, orderId]
    );

    await neonQuery(`DELETE FROM order_items WHERE order_id = $1`, [orderId]);

    for (const item of items) {
      await neonQuery(
        `INSERT INTO order_items (
          order_id, product_id, product_name, quantity, price, size, color
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          orderId,
          Number(item.productId),
          item.product_name || "",
          Math.floor(Number(item.quantity) || 0),
          Number(item.price) || 0,
          item.size ?? null,
          item.color ?? null,
        ]
      );
    }

    for (const [productId, state] of nextByProduct) {
      const sizesJson = JSON.stringify(serializeSizeStocks(state.sizes));
      await neonQuery(`UPDATE products SET sizes = $1::jsonb, stock = $2 WHERE id = $3`, [
        sizesJson,
        state.total,
        productId,
      ]);
    }

    return NextResponse.json({
      success: true,
      orderId,
      calirex_code_colis: orderCheck.rows[0].calirex_code_colis,
    });
  } catch (err) {
    console.error("[update-order]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur interne." },
      { status: 500 }
    );
  }
}
