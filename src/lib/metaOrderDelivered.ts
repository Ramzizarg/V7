import { neonQuery } from "@/lib/neon-db";
import { META_PIXEL_CURRENCY } from "@/lib/metaPixel.shared";
import { isMetaCapiConfigured, sendMetaServerEvent } from "@/lib/metaConversionsApi";

type OrderRow = {
  id: number;
  full_name: string | null;
  email: string | null;
  phone_number: string | null;
  city: string | null;
  governorate: string | null;
  total_price: number | string | null;
};

type ItemRow = {
  product_id: number | null;
  product_name: string | null;
  quantity: number | null;
  price: number | string | null;
};

/**
 * Sends Meta custom event `order_delivered` (CAPI) when a COD order is actually delivered.
 * Use this as the Ads Manager conversion event for best ROAS on cash-on-delivery.
 * Deduped with event_id `order-delivered-{orderId}`.
 */
export async function sendMetaOrderDelivered(orderId: number): Promise<{ sent: boolean; skipped?: boolean; error?: string }> {
  if (!Number.isFinite(orderId) || orderId < 1) {
    return { sent: false, skipped: true };
  }
  if (!isMetaCapiConfigured()) {
    return { sent: false, skipped: true };
  }

  try {
    const orderRes = await neonQuery<OrderRow>(
      `SELECT id, full_name, email, phone_number, city, governorate, total_price
       FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    const order = orderRes.rows[0];
    if (!order) return { sent: false, skipped: true };

    const itemsRes = await neonQuery<ItemRow>(
      `SELECT product_id, product_name, quantity, price FROM order_items WHERE order_id = $1`,
      [orderId]
    );
    const items = itemsRes.rows ?? [];
    const value = Number(order.total_price) || 0;
    const contents = items
      .filter((it) => it.product_id != null)
      .map((it) => ({
        id: String(it.product_id),
        quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
        item_price: Number(it.price) || undefined,
      }));
    const contentIds = contents.map((c) => c.id);
    const numItems = contents.reduce((sum, c) => sum + c.quantity, 0);

    const result = await sendMetaServerEvent({
      eventName: "order_delivered",
      eventId: `order-delivered-${orderId}`,
      eventSourceUrl: "https://vero-7.com/",
      customData: {
        value,
        currency: META_PIXEL_CURRENCY,
        content_ids: contentIds.length ? contentIds : undefined,
        content_type: "product",
        content_name: items.map((it) => it.product_name).filter(Boolean).join(", ") || undefined,
        contents: contents.length ? contents : undefined,
        num_items: numItems || undefined,
        order_id: String(orderId),
        order_source: "delivered",
      },
      userData: {
        email: order.email ?? undefined,
        phone: order.phone_number ?? undefined,
        fullName: order.full_name ?? undefined,
        city: order.city ?? undefined,
        state: order.governorate ?? undefined,
        country: "tn",
      },
    });

    if (result.skipped) return { sent: false, skipped: true };
    if (!result.ok) return { sent: false, error: result.error };
    return { sent: true };
  } catch (err) {
    console.error("[meta-order-delivered]", err);
    return { sent: false, error: err instanceof Error ? err.message : "error" };
  }
}

/** Fire only on first transition into delivered (not on every resync). */
export async function maybeSendMetaOrderDelivered(
  orderId: number,
  previousStatus: string,
  nextStatus: string
) {
  const prev = previousStatus.toLowerCase();
  const next = nextStatus.toLowerCase();
  if (next !== "delivered" || prev === "delivered") return;
  await sendMetaOrderDelivered(orderId);
}
