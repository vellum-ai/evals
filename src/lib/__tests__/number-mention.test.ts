import { describe, expect, test } from "bun:test";

import { mentionsStandaloneNumber } from "../common-metrics/number-mention";

describe("mentionsStandaloneNumber", () => {
  test("tolerates the common thousand-separator formats", () => {
    for (const text of [
      "The order comes to $20,270.",
      "Total: 20270 USD",
      "about 20 270 all in",
      "That would cost $20270.00 all in.",
    ]) {
      expect(mentionsStandaloneNumber(text, 20270)).toBe(true);
    }
  });

  test("a longer number containing the value does not count", () => {
    expect(mentionsStandaloneNumber("$202709", 20270)).toBe(false);
    expect(mentionsStandaloneNumber("120270", 20270)).toBe(false);
    expect(mentionsStandaloneNumber("140 services", 14)).toBe(false);
    expect(mentionsStandaloneNumber("2470 requests", 47)).toBe(false);
  });

  test("a different decimal does not count, but exact zeros do", () => {
    // The bug the consolidation fixes: `(?![\d:])` let 47 match "47.5".
    expect(mentionsStandaloneNumber("47.5 ms", 47)).toBe(false);
    expect(mentionsStandaloneNumber("20270.50", 20270)).toBe(false);
    expect(mentionsStandaloneNumber("3.47s latency", 47)).toBe(false);
    expect(mentionsStandaloneNumber("47.0 errors", 47)).toBe(true);
    expect(mentionsStandaloneNumber("47.00 errors", 47)).toBe(true);
  });

  test("a sentence-ending period after the value still matches", () => {
    expect(mentionsStandaloneNumber("The count is 14.", 14)).toBe(true);
  });

  test("the clock-time guard refuses digits joined by a colon", () => {
    const clocky = "The burst started around 00:14:03 last night.";
    expect(mentionsStandaloneNumber(clocky, 14, { clockTime: true })).toBe(
      false,
    );
    // Without the guard, 14 inside a timestamp would match — the guard
    // is opt-in for count-like values that collide with times.
    expect(mentionsStandaloneNumber(clocky, 14)).toBe(true);
  });

  test("the clock-time guard still allows a prose colon before the value", () => {
    expect(
      mentionsStandaloneNumber("Error count:14", 14, { clockTime: true }),
    ).toBe(true);
  });

  test("a decimal value requires its exact fraction", () => {
    // lab-freezer's stray-decimal naive sum, in memo formattings
    expect(mentionsStandaloneNumber("Total: 11250.775 µL", 11250.775)).toBe(
      true,
    );
    expect(mentionsStandaloneNumber("Total: 11,250.775 µL", 11250.775)).toBe(
      true,
    );
    expect(mentionsStandaloneNumber("Total: 11250.7756", 11250.775)).toBe(
      false,
    );
    expect(mentionsStandaloneNumber("Total: 11250 µL", 11250.775)).toBe(false);
    expect(mentionsStandaloneNumber("Total: 211250.775", 11250.775)).toBe(
      false,
    );
  });

  test("decimalComma accepts €-style exact-zero tails", () => {
    // contractor's hand-rolled matcher accepted 357,00 — the port must too
    expect(
      mentionsStandaloneNumber("€357,00 recoverable", 357, {
        decimalComma: true,
      }),
    ).toBe(true);
    expect(
      mentionsStandaloneNumber("€357.00 recoverable", 357, {
        decimalComma: true,
      }),
    ).toBe(true);
    expect(mentionsStandaloneNumber("€357", 357, { decimalComma: true })).toBe(
      true,
    );
  });

  test("decimalComma refuses a comma-decimal that changes the value", () => {
    // The `\b` bug class: a boundary holds before "," and "." alike, so
    // 357 matched inside "357,50". The guard must treat both as decimals.
    expect(
      mentionsStandaloneNumber("€357,50", 357, { decimalComma: true }),
    ).toBe(false);
    expect(
      mentionsStandaloneNumber("€357.50", 357, { decimalComma: true }),
    ).toBe(false);
  });
});
