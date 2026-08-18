import { describe, expect, test } from "bun:test";

import { buildCharge, describeCharge } from "./charge";

describe("charge", () => {
  test("the surcharge rounds once", () => {
    expect(buildCharge("INV-1", 999, 0.1).cents).toBe(1099);
  });

  test("a statement line names the invoice", () => {
    expect(describeCharge(buildCharge("INV-2", 2500, 0))).toBe("INV-2 $25.00");
  });
});
