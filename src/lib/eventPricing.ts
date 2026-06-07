/**
 * Fixed school lunch pricing model.
 *
 * Each event lists 3-4 interchangeable dishes. A customer picks 1-3 of them:
 *   - First dish (the "main") = $8
 *   - Each additional dish    = +$2
 *   - Maximum 3 dishes per order ($12 max).
 *
 * MUST match BASE_PRICE_CENTS / EXTRA_PRICE_CENTS in
 * supabase/functions/pay-order/index.ts — the server re-computes and verifies
 * the total before charging, so any drift causes every order to be rejected.
 */
export const EVENT_BASE_PRICE_CENTS = 800;
export const EVENT_EXTRA_PRICE_CENTS = 200;
export const EVENT_MAX_DISHES = 3;

/** Dollar values derived from cents — use for display only. */
export const EVENT_BASE_PRICE = EVENT_BASE_PRICE_CENTS / 100;
export const EVENT_EXTRA_PRICE = EVENT_EXTRA_PRICE_CENTS / 100;

/** Total in cents for `count` dishes (0 → 0, 1 → 800, 2 → 1000, 3 → 1200). */
export function totalCentsForDishCount(count: number): number {
  if (count <= 0) return 0;
  return EVENT_BASE_PRICE_CENTS + Math.max(0, Math.min(count, EVENT_MAX_DISHES) - 1) * EVENT_EXTRA_PRICE_CENTS;
}

/** Total in dollars for `count` dishes — convenience wrapper for display. */
export function priceForDishCount(count: number): number {
  return totalCentsForDishCount(count) / 100;
}

/** Price contribution in dollars of the dish at `index` (0-based). */
export function priceForDishAt(index: number): number {
  return index === 0 ? EVENT_BASE_PRICE : EVENT_EXTRA_PRICE;
}
