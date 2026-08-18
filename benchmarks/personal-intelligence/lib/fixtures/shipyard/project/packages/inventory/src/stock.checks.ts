import { describe, expect, test } from "bun:test";

import { available, release, reserve } from "./stock";

const LEVEL = { sku: "RP-020", onHand: 10, reserved: 2 };

describe("stock", () => {
  test("availability is on hand less reserved", () => {
    expect(available(LEVEL)).toBe(8);
  });

  test("reserving what is there moves it to reserved", () => {
    expect(reserve(LEVEL, 3).reserved).toBe(5);
  });

  test("reserving more than there is fails loudly", () => {
    expect(() => reserve(LEVEL, 9)).toThrow("Only 8");
  });

  test("releasing never goes below zero", () => {
    expect(release(LEVEL, 5).reserved).toBe(0);
  });
});
