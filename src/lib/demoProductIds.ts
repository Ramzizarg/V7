/**
 * Map collection demo `Product.id` strings (p1…p10) to API numeric `products.id` for
 * wishlist / panier in localStorage.
 */
export const DEMO_PRODUCT_STRING_TO_ID: Record<string, number> = {
  p1: 1,
  p2: 2,
  p3: 3,
  p4: 4,
  p5: 5,
  p6: 6,
  p7: 7,
  p8: 8,
  p9: 9,
  p10: 10,
};

export function demoStringIdToNumeric(s: string): number {
  return DEMO_PRODUCT_STRING_TO_ID[s] ?? 0;
}
