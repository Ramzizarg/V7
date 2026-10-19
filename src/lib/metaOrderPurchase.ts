import { META_PIXEL_CURRENCY } from "@/lib/metaPixel.shared";
import { isMetaCapiConfigured, sendMetaServerEvent } from "@/lib/metaConversionsApi";

type PurchaseItem = {
  productId: number;
  product_name: string;
  quantity: number;
  price: number;
};

type PurchaseInput = {
  orderId: number;
  total: number;
  email?: string;
  phone?: string;
  fullName?: string;
  city?: string;
  governorate?: string;
  items: PurchaseItem[];
  /** Same event_id as the browser Purchase so Meta dedupes. */
  orderSource?: "cart" | "product_page";
  eventSourceUrl?: string;
};

/**
 * Server-side Purchase (CAPI). Fired from place-order so Meta gets a real Purchase
 * even if the browser only logs SubscribedButtonClick / ad blockers block the pixel.
 */
export async function sendMetaOrderPurchase(input: PurchaseInput) {
  if (!isMetaCapiConfigured()) {
    return { sent: false as const, skipped: true as const };
  }
  if (!Number.isFinite(input.orderId) || input.orderId < 1) {
    return { sent: false as const, skipped: true as const };
  }

  const contents = input.items
    .filter((it) => Number.isFinite(it.productId) && it.productId > 0)
    .map((it) => ({
      id: String(it.productId),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      item_price: Number(it.price) || 0,
    }));
  const numItems = contents.reduce((sum, c) => sum + c.quantity, 0);

  try {
    const result = await sendMetaServerEvent({
      eventName: "Purchase",
      eventId: `order-${input.orderId}`,
      eventSourceUrl: input.eventSourceUrl || "https://vero-7.com/",
      customData: {
        value: Number(input.total) || 0,
        currency: META_PIXEL_CURRENCY,
        content_ids: contents.map((c) => c.id),
        content_type: "product",
        content_name: input.items.map((it) => it.product_name).filter(Boolean).join(", ") || undefined,
        contents: contents.length ? contents : undefined,
        num_items: numItems || undefined,
        order_id: String(input.orderId),
        order_source: input.orderSource,
      },
      userData: {
        email: input.email,
        phone: input.phone,
        fullName: input.fullName,
        city: input.city,
        state: input.governorate,
        country: "tn",
      },
    });

    if (result.skipped) return { sent: false as const, skipped: true as const };
    if (!result.ok) return { sent: false as const, skipped: false as const, error: result.error };
    return { sent: true as const, skipped: false as const };
  } catch (err) {
    console.error("[meta-order-purchase]", err);
    return {
      sent: false as const,
      skipped: false as const,
      error: err instanceof Error ? err.message : "error",
    };
  }
}
