import type { CartItem } from "@/lib/types";

export const META_PIXEL_ID = "2193109231262918";
export const META_PIXEL_CURRENCY = "TND";

type FbqFn = (
  action: "init" | "track",
  eventName: string,
  params?: Record<string, unknown>,
  options?: { eventID?: string },
) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
    _fbq?: FbqFn;
  }
}

function lineValue(item: Pick<CartItem, "price" | "discountPrice" | "quantity">) {
  const unit = item.discountPrice != null && item.discountPrice < item.price ? item.discountPrice : item.price;
  return unit * item.quantity;
}

function cartContents(items: CartItem[]) {
  return items.map((item) => ({
    id: String(item.productId),
    quantity: item.quantity,
    item_price: item.discountPrice != null && item.discountPrice < item.price ? item.discountPrice : item.price,
  }));
}

function fbqTrack(eventName: string, params?: Record<string, unknown>, options?: { eventID?: string }) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  if (options?.eventID) {
    window.fbq("track", eventName, params, options);
    return;
  }
  window.fbq("track", eventName, params);
}

export function trackMetaPageView() {
  fbqTrack("PageView");
}

export function trackMetaViewContent(product: {
  id: number;
  name: string;
  price: number;
  discount_price?: number | null;
  category_name?: string | null;
}) {
  const value =
    product.discount_price != null && product.discount_price < product.price
      ? product.discount_price
      : product.price;

  fbqTrack("ViewContent", {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: "product",
    content_category: product.category_name?.trim() || undefined,
    value,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaAddToCart(item: Omit<CartItem, "quantity"> & { quantity?: number }) {
  const quantity = item.quantity != null && item.quantity > 0 ? Math.floor(item.quantity) : 1;
  const unit = item.discountPrice != null && item.discountPrice < item.price ? item.discountPrice : item.price;

  fbqTrack("AddToCart", {
    content_ids: [String(item.productId)],
    content_name: item.name,
    content_type: "product",
    contents: [
      {
        id: String(item.productId),
        quantity,
        item_price: unit,
      },
    ],
    value: unit * quantity,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaInitiateCheckout(items: CartItem[], value: number) {
  if (items.length === 0) return;

  fbqTrack("InitiateCheckout", {
    content_ids: items.map((item) => String(item.productId)),
    contents: cartContents(items),
    num_items: items.reduce((sum, item) => sum + item.quantity, 0),
    value,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaPurchase(orderId: number | string, items: CartItem[], value: number) {
  if (items.length === 0) return;

  fbqTrack(
    "Purchase",
    {
      content_ids: items.map((item) => String(item.productId)),
      contents: cartContents(items),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      value,
      currency: META_PIXEL_CURRENCY,
    },
    { eventID: `order-${orderId}` },
  );
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + lineValue(item), 0);
}
