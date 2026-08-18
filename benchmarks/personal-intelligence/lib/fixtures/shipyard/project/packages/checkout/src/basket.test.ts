import { describe, expect, test } from "bun:test";

import { basketSubtotal, isOrderable } from "./basket";

describe("basket", () => {
  test("a subtotal adds up the lines", () => {
    expect(basketSubtotal([{ sku: "RP-020", quantity: 3 }])).toBe(999);
  });

  test("an empty basket is not orderable", () => {
    expect(isOrderable([])).toBe(false);
    expect(isOrderable([{ sku: "RP-020", quantity: 0 }])).toBe(false);
    expect(isOrderable([{ sku: "RP-020", quantity: 1 }])).toBe(true);
  });
});
