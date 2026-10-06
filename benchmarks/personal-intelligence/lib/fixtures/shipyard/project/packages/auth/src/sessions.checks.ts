import { describe, expect, test } from "bun:test";

import { canTakePayment, isActive, type Session } from "./sessions";

const NOW = 1_700_000_000_000;
const session = (role: Session["role"], ageHours: number): Session => ({
  user: "sam",
  role,
  issuedAt: NOW - ageHours * 60 * 60 * 1000,
});

describe("sessions", () => {
  test("a session lapses after eight hours", () => {
    expect(isActive(session("staff", 7), NOW)).toBe(true);
    expect(isActive(session("staff", 9), NOW)).toBe(false);
  });

  test("a reader may not take payment", () => {
    expect(canTakePayment(session("reader", 1), NOW)).toBe(false);
    expect(canTakePayment(session("staff", 1), NOW)).toBe(true);
  });
});
