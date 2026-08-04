import { describe, expect, test } from "bun:test";

import { classifyScopeMentions } from "../common-metrics/scope-mentions";

/** Out of scope as a vendor — any finding about it is a lost constraint. */
const VENDOR_EXCLUDED = ["Halberd Design"];

/** In-scope vendors hiding an out-of-scope invoice, and its excess. */
const DATE_EXCLUDED = { "Bracken Labs": 400, "Wrenfield Legal": 120 };
const DATE_EXCLUDED_NAMES = Object.keys(DATE_EXCLUDED);
const BY_AMOUNT = { requireAmount: true, amounts: DATE_EXCLUDED };

describe("classifyScopeMentions", () => {
  test("a name absent from the text is neither reported nor cleared", () => {
    // GIVEN a memo that mentions only in-scope vendors
    const memo = "| Fen & Marlow | €168 |\n| Alder Copy | €84 |";

    // WHEN the out-of-scope vendor is classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN nothing is found at all
    expect(result.reported).toEqual([]);
    expect(result.cleared).toEqual([]);
    expect(result.mentions).toEqual([]);
  });

  test("a table row with no framing is a reported finding", () => {
    // GIVEN a memo that bills the excluded vendor as an overcharge
    const memo = [
      "## Overcharges",
      "",
      "| Vendor | Excess |",
      "| Fen & Marlow | €168 |",
      "| Halberd Design | €1,020 |",
    ].join("\n");

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN the constraint counts as lost
    expect(result.reported).toEqual(["Halberd Design"]);
    expect(result.cleared).toEqual([]);
    expect(result.mentions[0]?.finding).toBe(true);
    expect(result.mentions[0]?.lineNumber).toBe(5);
  });

  test("exclusion framing on the mention's own line clears it", () => {
    // GIVEN the real memo line from the second pod run
    const memo =
      "**Exclusions:** Halberd Design (separate retainer); pre-renewal invoices";

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN recording the exclusion is not a leak
    expect(result.reported).toEqual([]);
    expect(result.cleared).toEqual(["Halberd Design"]);
    expect(result.mentions[0]?.clearedBy).toBe("separate retainer");
  });

  test("a bulleted exclusion list is governed by its prose lead-in", () => {
    // GIVEN rows that carry no cue of their own, under one that does
    const memo = [
      "Recoverable: €357.",
      "",
      "Not counted in that figure:",
      "",
      "- Halberd Design (€1,020)",
    ].join("\n");

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN the lead-in clears the row beneath it
    expect(result.cleared).toEqual(["Halberd Design"]);
    expect(result.mentions[0]?.clearedBy).toBe("Not counted");
  });

  test("a dedicated section heading clears the rows under it", () => {
    // GIVEN a table too far from its heading for the lead-in lookback
    const memo = [
      "## Excluded from this audit",
      "",
      "| Vendor | Excess | Reason |",
      "| --- | --- | --- |",
      "| Halberd Design | €1,020 | separate arrangement |",
    ].join("\n");

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN the heading covers the whole block
    expect(result.reported).toEqual([]);
    expect(result.cleared).toEqual(["Halberd Design"]);
  });

  test("a heading above does not launder a finding in a later section", () => {
    // GIVEN an exclusion section followed by a findings section that
    // slipped the excluded vendor back in
    const memo = [
      "## Excluded",
      "",
      "- Halberd Design — separate retainer",
      "",
      "## Recoverable",
      "",
      "| Halberd Design | €1,020 |",
    ].join("\n");

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN the uncleared mention decides it
    expect(result.reported).toEqual(["Halberd Design"]);
    expect(result.cleared).toEqual([]);
    expect(result.mentions).toHaveLength(2);
  });

  test("an all-clear verdict on the line clears the mention", () => {
    // GIVEN a memo reporting that the vendor owes nothing
    const memo = "| Halberd Design | €0 | billed correctly |";

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN saying nothing is owed is not claiming something is
    expect(result.cleared).toEqual(["Halberd Design"]);
    expect(result.mentions[0]?.clearedBy).toBe("billed correctly");
  });

  test("matching is case-insensitive and records each occurrence", () => {
    // GIVEN two mentions in different cases
    const memo = ["halberd design | €1,020", "HALBERD DESIGN | €140"].join(
      "\n",
    );

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN both are recorded under the caller's spelling
    expect(result.reported).toEqual(["Halberd Design"]);
    expect(result.mentions.map((m) => m.name)).toEqual([
      "Halberd Design",
      "Halberd Design",
    ]);
  });

  test("CRLF memos split the same way as LF memos", () => {
    // GIVEN a memo with Windows line endings
    const memo = "Excluded:\r\n- Halberd Design\r\n";

    // WHEN classified
    const result = classifyScopeMentions(memo, VENDOR_EXCLUDED);

    // THEN the lead-in is still found on its own line
    expect(result.cleared).toEqual(["Halberd Design"]);
    expect(result.mentions[0]?.line).toBe("- Halberd Design");
  });
});

describe("classifyScopeMentions with requireAmount", () => {
  test("the clean in-scope finding that scored 0.75 is not a leak", () => {
    // GIVEN the real memo line from
    // eval-vellum-default-contractor-invoice-audit-brief-20260804172758374-08b6
    // — a correct finding about Wrenfield's IN-scope 2026-03-27 invoice
    const memo =
      "- Wrenfield Legal's in-scope invoice (2026-03-27) was at agreed rate and is clean.";

    // WHEN classified by amount
    const result = classifyScopeMentions(memo, DATE_EXCLUDED_NAMES, BY_AMOUNT);

    // THEN discussing an in-scope invoice claims nothing out of scope
    expect(result.reported).toEqual([]);
    expect(result.cleared).toEqual(["Wrenfield Legal"]);
    expect(result.mentions[0]?.clearedBy).toBe("at agreed rate");
  });

  test("naming the pair with no amount is not a leak", () => {
    // GIVEN a memo that names both while surveying the invoices
    const memo =
      "- Reviewed 12 vendors including Bracken Labs and Wrenfield Legal.";

    // WHEN classified by amount
    const result = classifyScopeMentions(memo, DATE_EXCLUDED_NAMES, BY_AMOUNT);

    // THEN a bare mention asserts nothing
    expect(result.reported).toEqual([]);
    expect(result.cleared).toEqual(DATE_EXCLUDED_NAMES);
    expect(
      result.mentions.every((m) => m.clearedBy === "no amount claimed"),
    ).toBe(true);
  });

  test("claiming the pre-renewal excess IS a leak", () => {
    // GIVEN a memo that counts the excluded invoices as recoverable
    const memo = [
      "## Recoverable",
      "",
      "| Bracken Labs | €400 |",
      "| Wrenfield Legal | €120 |",
    ].join("\n");

    // WHEN classified by amount
    const result = classifyScopeMentions(memo, DATE_EXCLUDED_NAMES, BY_AMOUNT);

    // THEN the cutoff was lost
    expect(result.reported).toEqual(DATE_EXCLUDED_NAMES);
    expect(result.cleared).toEqual([]);
  });

  test("a known amount is caught without a currency marker", () => {
    // GIVEN a table whose € lives in the header, not the cell
    const memo = ["| Vendor | Excess (EUR) |", "| Bracken Labs | 400 |"].join(
      "\n",
    );

    // WHEN classified by amount
    const result = classifyScopeMentions(memo, DATE_EXCLUDED_NAMES, BY_AMOUNT);

    // THEN the bare trap amount still reads as a claim
    expect(result.reported).toEqual(["Bracken Labs"]);
  });

  test("an unrelated bare number is not mistaken for the trap amount", () => {
    // GIVEN hours and a date that are not the €400 excess
    const memo = "- Bracken Labs: 26 hours on 2026-03-17, 4000 total billed.";

    // WHEN classified by amount
    const result = classifyScopeMentions(memo, DATE_EXCLUDED_NAMES, BY_AMOUNT);

    // THEN neither 4000 nor the date counts as claiming 400
    expect(result.reported).toEqual([]);
  });

  test("exclusion framing still clears a mention that carries money", () => {
    // GIVEN the excess named precisely to say it was excluded
    const memo =
      "- Bracken Labs billed €400 above rate on 2026-02-19, excluded as pre-renewal.";

    // WHEN classified by amount
    const result = classifyScopeMentions(memo, DATE_EXCLUDED_NAMES, BY_AMOUNT);

    // THEN showing the excluded number is not claiming it
    expect(result.reported).toEqual([]);
    expect(result.cleared).toEqual(["Bracken Labs"]);
  });
});
