import { describe, expect, test } from "bun:test";

import {
  namesTheCheapest,
  normalize,
} from "../../../benchmarks/personal-intelligence/tests/supplier-quote-verdicts/metrics/summary-correct";
import { QUOTE_TRUTH } from "../../../benchmarks/personal-intelligence/lib/fixtures/supplier-quotes/truth";

const SUPPLIERS = QUOTE_TRUTH.map((quote) => quote.supplier);

describe("summary reading", () => {
  test("formatting is noise", () => {
    // The buyer does not care how the figure is laid out, so neither
    // does the check: only the arithmetic has to be right.
    const text = normalize("**Kestrel Marine Parts** — $1,438.75\n\n");
    expect(text).toContain("kestrel marine parts");
    expect(text).toContain("$1438.75");
  });

  test("the cheapest claim has to name the supplier that is cheapest", () => {
    const right = normalize(
      "| Kestrel Marine Parts | $438.75 | 11 days |\nCheapest: Kestrel Marine Parts.",
    );
    expect(namesTheCheapest(right, "Kestrel Marine Parts", SUPPLIERS)).toBe(
      true,
    );
  });

  test("a cheapest claim naming someone else does not count", () => {
    const wrong = normalize(
      "Kestrel Marine Parts quotes $438.75. The cheapest is Pelican Trading.",
    );
    expect(namesTheCheapest(wrong, "Kestrel Marine Parts", SUPPLIERS)).toBe(
      false,
    );
  });

  test("a table that never says which is cheapest does not count", () => {
    const listing = normalize(
      "| Kestrel Marine Parts | $438.75 |\n| Pelican Trading | $448.25 |",
    );
    expect(namesTheCheapest(listing, "Kestrel Marine Parts", SUPPLIERS)).toBe(
      false,
    );
  });

  test("a later cheapest claim is found, not just the first", () => {
    const late = normalize(
      `The lowest lead time is Saltbox Marine at five days. ${"filler ".repeat(60)} On price, the cheapest is Kestrel Marine Parts.`,
    );
    expect(namesTheCheapest(late, "Kestrel Marine Parts", SUPPLIERS)).toBe(
      true,
    );
  });

  test("any of the phrasings a person would use counts", () => {
    for (const phrasing of [
      "lowest total is kestrel marine parts",
      "kestrel marine parts is the least expensive",
      "best price: kestrel marine parts",
    ]) {
      expect(
        namesTheCheapest(
          normalize(phrasing),
          "Kestrel Marine Parts",
          SUPPLIERS,
        ),
      ).toBe(true);
    }
  });
});
