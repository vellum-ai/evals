import { sumCents } from "../../core/src/money";
import { priceCents } from "../../catalog/src/products";

/** What a shopper has picked up. */
export interface BasketItem {
  sku: string;
  quantity: number;
}

/** The basket subtotal in cents. */
export function basketSubtotal(items: BasketItem[]): number {
  return sumCents(items.map((item) => priceCents(item.sku) * item.quantity));
}

/** A basket with nothing in it is not an order. */
export function isOrderable(items: BasketItem[]): boolean {
  return items.length > 0 && items.every((item) => item.quantity > 0);
}
