/** Flash sale: 1920 Champions Jersey after Club Africain CL qualification. */

export const CHAMPIONS_JERSEY_PRODUCT_ID = 1;
export const CHAMPIONS_JERSEY_SALE_PRICE = 65;
export const STANDARD_SHIPPING_FEE = 8;
export const FREE_SHIPPING_FROM = 200;

/** Ends Thursday 29 Oct 2026, 19:20 Africa/Tunis (72h from campaign start). */
export const CHAMPIONS_JERSEY_OFFER_ENDS_AT = Date.parse("2026-10-29T19:20:00+01:00");

export function isChampionsJerseyProduct(productId: number | string | null | undefined): boolean {
  return Number(productId) === CHAMPIONS_JERSEY_PRODUCT_ID;
}

export function isChampionsJerseyFlashSaleActive(now = Date.now()): boolean {
  return Number.isFinite(CHAMPIONS_JERSEY_OFFER_ENDS_AT) && now < CHAMPIONS_JERSEY_OFFER_ENDS_AT;
}

export function remainingOfferMs(now = Date.now()): number {
  return Math.max(0, CHAMPIONS_JERSEY_OFFER_ENDS_AT - now);
}

export function cartIncludesChampionsJerseyOffer(
  productIds: Array<number | string | null | undefined>,
  now = Date.now()
): boolean {
  return isChampionsJerseyFlashSaleActive(now) && productIds.some((id) => isChampionsJerseyProduct(id));
}

export function shippingForOrder(
  subtotal: number,
  productIds: Array<number | string | null | undefined> = [],
  now = Date.now()
): number {
  if (!(subtotal > 0)) return 0;
  if (cartIncludesChampionsJerseyOffer(productIds, now)) return 0;
  return subtotal >= FREE_SHIPPING_FROM ? 0 : STANDARD_SHIPPING_FEE;
}
