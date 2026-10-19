import { META_PIXEL_CURRENCY } from "@/lib/metaPixel.shared";
import { isMetaCapiConfigured, sendMetaServerEvent } from "@/lib/metaConversionsApi";
import { sendMetaAppendClickAttribution } from "@/lib/metaAppendClickAttribution";

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
  fbc?: string;
  fbp?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
};

/**
 * Server-side Purchase (CAPI), then AppendClickAttribution when `_fbc` is present
 * (Meta Payload Helper / developer task for custom click attribution).
 */
export async function sendMetaOrderPurchase(input: PurchaseInput) {
  if (!isMetaCapiConfigured()) {
    return { sent: false as const, skipped: true as const, appended: false as const };
  }
  if (!Number.isFinite(input.orderId) || input.orderId < 1) {
    return { sent: false as const, skipped: true as const, appended: false as const };
  }

  const contents = input.items
    .filter((it) => Number.isFinite(it.productId) && it.productId > 0)
    .map((it) => ({
      id: String(it.productId),
      quantity: Math.max(1, Math.floor(Number(it.quantity) || 1)),
      item_price: Number(it.price) || 0,
    }));
  const numItems = contents.reduce((sum, c) => sum + c.quantity, 0);
  const value = Number(input.total) || 0;
  const purchaseEventTime = Math.floor(Date.now() / 1000);
  const customBase = {
    content_ids: contents.map((c) => c.id),
    content_type: "product" as const,
    content_name: input.items.map((it) => it.product_name).filter(Boolean).join(", ") || undefined,
    contents: contents.length ? contents : undefined,
    num_items: numItems || undefined,
    order_source: input.orderSource,
  };
  const userData = {
    email: input.email,
    phone: input.phone,
    fullName: input.fullName,
    city: input.city,
    state: input.governorate,
    country: "tn",
    fbc: input.fbc,
    fbp: input.fbp,
    clientIpAddress: input.clientIpAddress,
    clientUserAgent: input.clientUserAgent,
  };

  try {
    const result = await sendMetaServerEvent({
      eventName: "Purchase",
      eventId: `order-${input.orderId}`,
      eventTime: purchaseEventTime,
      eventSourceUrl: input.eventSourceUrl || "https://vero-7.com/",
      customData: {
        value,
        currency: META_PIXEL_CURRENCY,
        ...customBase,
        order_id: String(input.orderId),
      },
      userData,
    });

    if (result.skipped) return { sent: false as const, skipped: true as const, appended: false as const };
    if (!result.ok) {
      return { sent: false as const, skipped: false as const, appended: false as const, error: result.error };
    }

    // Same Purchase params + attribution_share (Meta developer task / Payload Helper)
    const append = await sendMetaAppendClickAttribution({
      orderId: input.orderId,
      purchaseEventTime,
      value,
      currency: META_PIXEL_CURRENCY,
      fbc: input.fbc,
      fbp: input.fbp,
      userData: {
        email: input.email,
        phone: input.phone,
        fullName: input.fullName,
        city: input.city,
        state: input.governorate,
        country: "tn",
        clientIpAddress: input.clientIpAddress,
        clientUserAgent: input.clientUserAgent,
      },
      customData: customBase,
      eventSourceUrl: input.eventSourceUrl,
      attributionShare: 1,
    });

    return {
      sent: true as const,
      skipped: false as const,
      appended: append.sent,
      appendSkipped: append.skipped,
      appendError: append.error,
    };
  } catch (err) {
    console.error("[meta-order-purchase]", err);
    return {
      sent: false as const,
      skipped: false as const,
      appended: false as const,
      error: err instanceof Error ? err.message : "error",
    };
  }
}
