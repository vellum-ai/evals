import { describe, expect, test } from "bun:test";

import { findProduct, listProducts, priceCents } from "./products";

describe("products", () => {
  test("the catalogue lists what the shop stocks", () => {
    expect(listProducts()).toHaveLength(5);
  });

  test("a sku resolves to its price in cents", () => {
    expect(priceCents("RP-020")).toBe(333);
    expect(priceCents("AN-010")).toBe(18900);
  });

  test("an unknown sku is an error, not a zero", () => {
    expect(findProduct("NOPE")).toBeUndefined();
    expect(() => priceCents("NOPE")).toThrow("Unknown sku");
  });
});
