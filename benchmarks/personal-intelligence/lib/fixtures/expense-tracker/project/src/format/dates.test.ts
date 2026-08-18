import { describe, expect, test } from "bun:test";

import { isValidDate, isValidMonth, monthOf } from "./dates";

describe("isValidDate", () => {
  test("accepts a YYYY-MM-DD date", () => {
    expect(isValidDate("2025-03-18")).toBe(true);
  });

  test("rejects other shapes and impossible months or days", () => {
    expect(isValidDate("2025-3-18")).toBe(false);
    expect(isValidDate("18/03/2025")).toBe(false);
    expect(isValidDate("2025-13-01")).toBe(false);
    expect(isValidDate("2025-03-00")).toBe(false);
  });
});

describe("isValidMonth", () => {
  test("accepts a YYYY-MM month", () => {
    expect(isValidMonth("2025-03")).toBe(true);
  });

  test("rejects a full date and an impossible month", () => {
    expect(isValidMonth("2025-03-18")).toBe(false);
    expect(isValidMonth("2025-00")).toBe(false);
  });
});

describe("monthOf", () => {
  test("takes the month key off a date", () => {
    expect(monthOf("2025-03-18")).toBe("2025-03");
  });
});
