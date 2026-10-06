/** What the shop holds of one sku. */
export interface StockLevel {
  sku: string;
  onHand: number;
  reserved: number;
}

/** What can still be sold: on hand less what is already spoken for. */
export function available(level: StockLevel): number {
  return Math.max(0, level.onHand - level.reserved);
}

/** Reserve stock for an order, or report why it cannot be reserved. */
export function reserve(level: StockLevel, quantity: number): StockLevel {
  if (quantity <= 0) {
    throw new Error("Reserve a positive quantity.");
  }
  if (available(level) < quantity) {
    throw new Error(`Only ${available(level)} of ${level.sku} available.`);
  }
  return { ...level, reserved: level.reserved + quantity };
}

/** Release a reservation an order no longer needs. */
export function release(level: StockLevel, quantity: number): StockLevel {
  return { ...level, reserved: Math.max(0, level.reserved - quantity) };
}
