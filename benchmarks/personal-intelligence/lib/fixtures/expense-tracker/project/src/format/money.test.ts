import { describe, expect, test } from "bun:test";

import { formatUsd, sumUsd } from "./money";

describe("formatUsd", () => {
  test("always shows two decimals", () => {
    expect(formatUsd(4)).toBe("$4.00");
    expect(formatUsd(4.5)).toBe("$4.50");
  });

  test("groups thousands with commas", () => {
    expect(formatUsd(1234.56)).toBe("$1,234.56");
    expect(formatUsd(1234567.8)).toBe("$1,234,567.80");
  });

  test("rounds to the nearest cent", () => {
    expect(formatUsd(0.005)).toBe("$0.01");
  });

  test("keeps the sign in front of the dollar mark", () => {
    expect(formatUsd(-12.3)).toBe("-$12.30");
  });
});

describe("sumUsd", () => {
  test("adds in cents so the total stays exact", () => {
    expect(sumUsd([0.1, 0.2])).toBe(0.3);
    expect(formatUsd(sumUsd([12.75, 6.25, 21.3]))).toBe("$40.30");
  });

  test("an empty list comes to zero", () => {
    expect(sumUsd([])).toBe(0);
  });
});
