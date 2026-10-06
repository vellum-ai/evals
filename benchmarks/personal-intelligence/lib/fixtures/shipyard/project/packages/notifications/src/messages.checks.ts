import { describe, expect, test } from "bun:test";

import { receiptMessage, shippedMessage } from "./messages";

describe("messages", () => {
  test("a shipping note carries the tracking number", () => {
    const message = shippedMessage("skipper@example.test", "ORD-9", "TRK-1");
    expect(message.subject).toBe("Order ORD-9 is on its way");
    expect(message.body).toContain("TRK-1");
  });

  test("a receipt states the amount as dollars", () => {
    expect(
      receiptMessage("skipper@example.test", "ORD-9", 1099).body,
    ).toContain("$10.99");
  });
});
