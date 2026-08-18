import { describe, expect, test } from "bun:test";

import { invoiceTotal, lineCents, renderTotal, type Line } from "./invoice";

const THREE_SMALL_LINES: Line[] = [
  { description: "Rope, 20m", dollars: 3.33, quantity: 1 },
  { description: "Deck cleat", dollars: 3.33, quantity: 1 },
  { description: "Shackle, 8mm", dollars: 3.33, quantity: 1 },
];

describe("invoice", () => {
  test("a line is its unit price times its quantity", () => {
    expect(
      lineCents({ description: "Sail tape", dollars: 12.5, quantity: 4 }),
    ).toBe(5000);
  });

  test("tax is charged on what the customer actually owes", () => {
    // Subtotal $9.99, tax 10%: $10.989 -> $10.99 on the invoice.
    expect(invoiceTotal(THREE_SMALL_LINES, 0.1)).toBe(1099);
  });

  test("the printed total reads as dollars", () => {
    expect(renderTotal(THREE_SMALL_LINES, 0.1)).toBe("$10.99");
  });
});
