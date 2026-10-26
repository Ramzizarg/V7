/** Flash sale: 1920 Champions Jersey after Club Africain CL qualification. */

export const CHAMPIONS_JERSEY_PRODUCT_ID = 1;
export const CHAMPIONS_JERSEY_SALE_PRICE = 65;
export const STANDARD_SHIPPING_FEE = 8;
export const FREE_SHIPPING_FROM = 200;

/** Set to false to turn the 65 DT jersey offer off. */
export const CHAMPIONS_JERSEY_SALE_ENABLED = true;

const TUNIS_TZ = "Africa/Tunis";
const TUNIS_OFFSET = "+01:00";

function tunisParts(now: number) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TUNIS_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(now));
  const map: Record<string, string> = {};
  for (const part of parts) {
    if (part.type !== "literal") map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

function tunisWallTimeMs(year: number, month: number, day: number, hour: number, minute: number, second: number) {
  return Date.parse(
    `${year}-${pad2(month)}-${pad2(day)}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}${TUNIS_OFFSET}`
  );
}

function nextCalendarDay(year: number, month: number, day: number) {
  const next = new Date(Date.UTC(year, month - 1, day + 1));
  return { year: next.getUTCFullYear(), month: next.getUTCMonth() + 1, day: next.getUTCDate() };
}

/**
 * Tonight 23:59:59 Africa/Tunis. After midnight the clock restarts
 * automatically for the next night — same “ends tonight” feeling every day.
 */
export function championsJerseyOfferEndsAt(now = Date.now()): number {
  const t = tunisParts(now);
  let end = tunisWallTimeMs(t.year, t.month, t.day, 23, 59, 59);
  if (now >= end) {
    const n = nextCalendarDay(t.year, t.month, t.day);
    end = tunisWallTimeMs(n.year, n.month, n.day, 23, 59, 59);
  }
  return end;
}

/** Live “ends tonight” instant — prefer championsJerseyOfferEndsAt(now). */
export const CHAMPIONS_JERSEY_OFFER_ENDS_AT = championsJerseyOfferEndsAt();

export function isChampionsJerseyProduct(productId: number | string | null | undefined): boolean {
  return Number(productId) === CHAMPIONS_JERSEY_PRODUCT_ID;
}

export function isChampionsJerseyFlashSaleActive(now = Date.now()): boolean {
  return CHAMPIONS_JERSEY_SALE_ENABLED && now < championsJerseyOfferEndsAt(now);
}

export function remainingOfferMs(now = Date.now()): number {
  if (!CHAMPIONS_JERSEY_SALE_ENABLED) return 0;
  return Math.max(0, championsJerseyOfferEndsAt(now) - now);
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
