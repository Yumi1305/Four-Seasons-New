/**
 * Fixed school lunch pricing model.
 *
 * Each event lists 3-4 interchangeable dishes. A customer picks 1-3 of them:
 *   - First dish (the "main") = $10
 *   - Each additional dish    = +$2
 *   - Maximum 3 dishes per order ($14 max).
 *
 * Mirror these constants in `supabase/functions/events/index.ts` if changed.
 */
export const EVENT_BASE_PRICE = 8;
export const EVENT_EXTRA_PRICE = 2;
export const EVENT_MAX_DISHES = 3;

/** Total price in dollars for `count` dishes (0 → 0, 1 → 10, 2 → 12, 3 → 14). */
export function priceForDishCount(count: number): number {
  if (count <= 0) return 0;
  return EVENT_BASE_PRICE + Math.max(0, Math.min(count, EVENT_MAX_DISHES) - 1) * EVENT_EXTRA_PRICE;
}

/** Price contribution of the dish at `index` (0-based): main = base, extras = extra. */
export function priceForDishAt(index: number): number {
  return index === 0 ? EVENT_BASE_PRICE : EVENT_EXTRA_PRICE;
}
