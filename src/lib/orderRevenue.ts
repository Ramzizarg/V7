/** Fixed delivery cost deducted per order for net revenue. */
export const ORDER_DELIVERY_COST_DT = 8;

/** Fee deducted from each order total (e.g. payment / platform). */
export const ORDER_REVENUE_FEE_RATE = 0.03;

/**
 * Net revenue per order: −8 DT delivery cost, then −3% on the remainder.
 */
export function netOrderRevenue(totalPrice: number): number {
  const gross = Number(totalPrice);
  if (!Number.isFinite(gross)) return 0;
  return (gross - ORDER_DELIVERY_COST_DT) * (1 - ORDER_REVENUE_FEE_RATE);
}

export function sumNetOrderRevenue(orders: { total_price: number }[]): number {
  return orders.reduce((sum, order) => sum + netOrderRevenue(order.total_price), 0);
}
