import { describe, expect, test } from "bun:test";

import { applyRate, formatUsd, sumCents, toCents } from "./money";

describe("money", () => {
  test("dollars convert to cents once", () => {
    expect(toCents(3.33)).toBe(333);
    expect(toCents(0.1)).toBe(10);
  });

  test("cents sum as integers", () => {
    expect(sumCents([333, 333, 333])).toBe(999);
    expect(sumCents([])).toBe(0);
  });

  test("a rate rounds once, at the end", () => {
    // 999 * 1.10 = 1098.9 -> 1099. Rounding each 333 first gives 1098.
    expect(applyRate(999, 0.1)).toBe(1099);
  });

  test("cents format as dollars", () => {
    expect(formatUsd(1099)).toBe("$10.99");
    expect(formatUsd(123456)).toBe("$1,234.56");
    expect(formatUsd(-500)).toBe("-$5.00");
  });
});
