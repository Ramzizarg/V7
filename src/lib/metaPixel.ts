import type { CartItem } from "@/lib/types";
import { createMetaEventId, META_PIXEL_CURRENCY, META_PIXEL_ID } from "@/lib/metaPixel.shared";

export { META_PIXEL_CURRENCY, META_PIXEL_ID, createMetaEventId };

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

export type MetaUserData = {
  email?: string;
  phone?: string;
  fullName?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  state?: string;
  country?: string;
};

type TrackOptions = {
  eventId?: string;
  userData?: MetaUserData;
};

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

function readCookie(name: string) {
  if (typeof document === "undefined") return undefined;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : undefined;
}

function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "", lastName: "" };
  if (parts.length === 1) return { firstName: parts[0]!, lastName: "" };
  return { firstName: parts[0]!, lastName: parts.slice(1).join(" ") };
}

function advancedMatchingParams(userData?: MetaUserData) {
  if (!userData) return undefined;
  const { firstName: splitFn, lastName: splitLn } = splitFullName(userData.fullName ?? "");
  const fn = userData.firstName ?? splitFn;
  const ln = userData.lastName ?? splitLn;
  const params: Record<string, string> = {};
  if (userData.email?.trim()) params.em = userData.email.trim().toLowerCase();
  if (userData.phone?.trim()) params.ph = userData.phone.trim();
  if (fn) params.fn = fn;
  if (ln) params.ln = ln;
  if (userData.city?.trim()) params.ct = userData.city.trim();
  if (userData.state?.trim()) params.st = userData.state.trim();
  params.country = (userData.country ?? "tn").trim().toLowerCase();
  return Object.keys(params).length > 0 ? params : undefined;
}

export function setMetaAdvancedMatching(userData: MetaUserData) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  const params = advancedMatchingParams(userData);
  if (!params) return;
  window.fbq("init", META_PIXEL_ID, params);
}

function relayToConversionsApi(
  eventName: string,
  eventId: string,
  customData?: Record<string, unknown>,
  userData?: MetaUserData,
) {
  if (typeof window === "undefined") return;
  fetch("/api/meta/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      eventName,
      eventId,
      eventSourceUrl: window.location.href,
      customData,
      userData: {
        ...userData,
        fbp: readCookie("_fbp"),
        fbc: readCookie("_fbc"),
      },
    }),
  }).catch(() => {});
}

function trackDual(
  eventName: string,
  customData: Record<string, unknown> | undefined,
  options?: TrackOptions,
): string {
  const eventId = options?.eventId ?? createMetaEventId(eventName.toLowerCase());
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    if (customData) {
      window.fbq("track", eventName, customData, { eventID: eventId });
    } else {
      window.fbq("track", eventName, undefined, { eventID: eventId });
    }
  }
  relayToConversionsApi(eventName, eventId, customData, options?.userData);
  return eventId;
}

export function trackMetaPageView() {
  return trackDual("PageView", undefined);
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

  trackDual("ViewContent", {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: "product",
    content_category: product.category_name?.trim() || undefined,
    value,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaViewCategory(categoryName: string, contentIds: string[] = []) {
  trackDual("ViewCategory", {
    content_name: categoryName,
    content_type: "product_group",
    content_ids: contentIds.length > 0 ? contentIds : undefined,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaSearch(searchString: string) {
  trackDual("Search", {
    search_string: searchString,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaAddToCart(item: Omit<CartItem, "quantity"> & { quantity?: number }) {
  const quantity = item.quantity != null && item.quantity > 0 ? Math.floor(item.quantity) : 1;
  const unit = item.discountPrice != null && item.discountPrice < item.price ? item.discountPrice : item.price;

  trackDual("AddToCart", {
    content_ids: [String(item.productId)],
    content_name: item.name,
    content_type: "product",
    contents: [{ id: String(item.productId), quantity, item_price: unit }],
    value: unit * quantity,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaAddToWishlist(product: { id: number; name: string; price: number; discountPrice?: number | null }) {
  const value =
    product.discountPrice != null && product.discountPrice < product.price
      ? product.discountPrice
      : product.price;

  trackDual("AddToWishlist", {
    content_ids: [String(product.id)],
    content_name: product.name,
    content_type: "product",
    value,
    currency: META_PIXEL_CURRENCY,
  });
}

export function trackMetaInitiateCheckout(items: CartItem[], value: number, userData?: MetaUserData) {
  if (items.length === 0) return;

  trackDual(
    "InitiateCheckout",
    {
      content_ids: items.map((item) => String(item.productId)),
      contents: cartContents(items),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      value,
      currency: META_PIXEL_CURRENCY,
    },
    { userData },
  );
}

export function trackMetaPurchase(
  orderId: number | string,
  items: CartItem[],
  value: number,
  userData?: MetaUserData,
) {
  if (items.length === 0) return;

  trackDual(
    "Purchase",
    {
      content_ids: items.map((item) => String(item.productId)),
      contents: cartContents(items),
      num_items: items.reduce((sum, item) => sum + item.quantity, 0),
      value,
      currency: META_PIXEL_CURRENCY,
    },
    { eventId: `order-${orderId}`, userData },
  );
}

export function trackMetaLead(userData?: MetaUserData) {
  return trackDual("Lead", { currency: META_PIXEL_CURRENCY }, { userData });
}

export function cartSubtotal(items: CartItem[]) {
  return items.reduce((sum, item) => sum + lineValue(item), 0);
}
