import { describe, expect, test } from "bun:test";

import { dayTotal, daySummary } from "./daily";

const ROWS = [
  { orderId: "ORD-1", cents: 1099, refunded: false },
  { orderId: "ORD-2", cents: 2500, refunded: true },
  { orderId: "ORD-3", cents: 495, refunded: false },
];

describe("daily", () => {
  test("refunds do not count toward the day", () => {
    expect(dayTotal(ROWS)).toBe(1594);
  });

  test("the summary counts the orders it kept", () => {
    expect(daySummary(ROWS)).toBe("2 order(s), $15.94");
  });
});
