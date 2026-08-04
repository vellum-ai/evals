import { describe, expect, test } from "bun:test";

import { gradeTotals } from "../../../benchmarks/personal-intelligence/tests/lab-freezer-inventory-totals/metrics/totals-correct";

/** Every per-reagent total right, written the way a memo writes them. */
const CORRECT_MEMO = [
  "# Reagent usage — summer teams",
  "",
  "| Reagent | Used |",
  "| --- | --- |",
  "| Tris-HCl | 2,850 µL |",
  "| EDTA | 2,975 µL |",
  "| SDS | 3,100 µL |",
  "| Glycerol | 3,000 µL |",
].join("\n");

function passCount(memo: string): number {
  return gradeTotals(memo).perReagent.filter(([, ok]) => ok).length;
}

describe("lab-freezer totals-correct grading", () => {
  test("the run that scored 0.80 now grades all four reagents correct", () => {
    // GIVEN the numbers delivered by
    // eval-vellum-default-lab-freezer-inventory-totals-20260804170943286-6729,
    // which stated no cross-reagent grand total
    const result = gradeTotals(CORRECT_MEMO);

    // THEN every scored check passes, and the unscored total is absent
    expect(passCount(CORRECT_MEMO)).toBe(4);
    expect(result.grandTotalStated).toBe(false);
    expect(result.carriesNaiveSum).toBe(false);
  });

  test("stating the grand total is neither required nor penalised", () => {
    // GIVEN the same memo with a grand total added
    const withTotal = `${CORRECT_MEMO}\n\n**Total across reagents:** 11,925 µL`;

    // WHEN graded
    const result = gradeTotals(withTotal);

    // THEN the score is unchanged and the total is merely reported
    expect(passCount(withTotal)).toBe(passCount(CORRECT_MEMO));
    expect(result.grandTotalStated).toBe(true);
  });

  test("a memo that reconciled nothing misses the per-reagent totals", () => {
    // GIVEN the sums as written, with the stray decimal that gives it away
    const naive = [
      "| Tris-HCl | 2,850 µL |",
      "| EDTA | 2,975 µL |",
      "| SDS | 3,100 µL |",
      "| Glycerol | 2,325.775 µL |",
      "",
      "Total: 11250.775 µL",
    ].join("\n");

    // WHEN graded
    const result = gradeTotals(naive);

    // THEN the wrong reagent fails and the naive sum is flagged
    expect(passCount(naive)).toBe(3);
    expect(result.carriesNaiveSum).toBe(true);
    expect(result.perReagent).toContainEqual(["Glycerol", false]);
  });

  test("naming the un-reconciled sum to explain it does not fail the reagents", () => {
    // GIVEN a memo that shows its working — the same mention-versus-claim
    // distinction that bit audit-correct
    const explained = `${CORRECT_MEMO}\n\nSumming the column as written gives 11250.775 µL, which is wrong: S-006 is double-counted and team-09 logged mL.`;

    // WHEN graded
    const result = gradeTotals(explained);

    // THEN every scored check still passes
    expect(passCount(explained)).toBe(4);
    expect(result.carriesNaiveSum).toBe(true);
  });

  test("thousands separators and bare digits both match", () => {
    // GIVEN the totals written without separators
    const bare = "Tris-HCl 2850, EDTA 2975, SDS 3100, Glycerol 3000";

    // WHEN graded
    expect(passCount(bare)).toBe(4);
  });

  test("a longer number containing a total does not count as that total", () => {
    // GIVEN 28500 and 29750 — supersets of two real totals
    const inflated = "Tris-HCl 28500, EDTA 29750, SDS 3100, Glycerol 3000";

    // WHEN graded
    // THEN only the two genuine totals match
    expect(passCount(inflated)).toBe(2);
  });
});
