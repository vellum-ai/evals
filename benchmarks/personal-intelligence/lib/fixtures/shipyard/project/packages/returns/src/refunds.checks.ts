import { describe, expect, test } from "bun:test";

import { refundCents, refundNote } from "./refunds";

const LINES = [
  { sku: "RP-020", cents: 333, restocked: true },
  { sku: "DC-001", cents: 333, restocked: false },
  { sku: "SH-008", cents: 333, restocked: true },
];

describe("refunds", () => {
  test("only restocked lines are refunded", () => {
    expect(refundCents(LINES)).toBe(666);
  });

  test("the note states the amount", () => {
    expect(refundNote(LINES)).toBe("Refunding $6.66");
  });
});
