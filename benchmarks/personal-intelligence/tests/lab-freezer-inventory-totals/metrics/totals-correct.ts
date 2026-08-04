import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readDeliverable } from "../../../../../src/lib/common-metrics/workspace-deliverable";
import {
  GRAND_TOTAL_UL,
  NAIVE_SUM_IF_TRAPS_MISSED,
  REAGENT_TOTALS_UL,
  TOTALS_PATH,
} from "../constants";

const METRIC_NAME = "totals-correct";

/** Matches a number allowing thousands separators: 2850, 2,850, 2 850. */
function mentionsNumber(text: string, value: number): boolean {
  const digits = String(value);
  const spaced = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "[,\\s]?");
  return new RegExp(`(?<![\\d.])${spaced}(?![\\d])`).test(text);
}

/**
 * The pure half of the metric: grade a memo's numbers.
 *
 * Four equally weighted checks, one per reagent. Getting these right
 * requires reconciling both planted defects — the duplicated sample and
 * team-09's mL rows — so this is the metric the traps actually bite on.
 *
 * The 11925 µL grand total is NOT scored, though it is still reported.
 * The user asks how much of each reagent was used, to place a reorder;
 * adding four different reagents together produces a number nobody
 * orders against, and no line of the scenario asks for it. A pod run
 * scored 0.80 with all four per-reagent totals correct, both traps
 * caught, and the only fault being the absence of a figure the user
 * never wanted.
 *
 * The un-reconciled sum is likewise reported and not scored. 11250.775
 * is a recognisable wrong answer, but a memo may legitimately name it to
 * explain why it is wrong — the same mention-versus-claim distinction
 * that `classifyScopeMentions` exists for in contractor-invoice-audit-
 * brief. A memo that actually believes it fails the per-reagent checks
 * on its own.
 */
export function gradeTotals(memo: string): {
  perReagent: (readonly [string, boolean])[];
  grandTotalStated: boolean;
  carriesNaiveSum: boolean;
} {
  const perReagent = Object.entries(REAGENT_TOTALS_UL).map(
    ([reagent, total]) => [reagent, mentionsNumber(memo, total)] as const,
  );
  return {
    perReagent,
    grandTotalStated: mentionsNumber(memo, GRAND_TOTAL_UL),
    carriesNaiveSum:
      memo.includes(String(NAIVE_SUM_IF_TRAPS_MISSED)) ||
      memo.includes("11250") ||
      memo.includes("11,250"),
  };
}

/** Are the reorder numbers right? See {@link gradeTotals}. */
export default async function scoreTotalsCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  const read = await readDeliverable(METRIC_NAME, input.runId, TOTALS_PATH, {
    noun: "memo",
  });
  if (!read.ok) return read.result;
  const memo = read.content;

  const { perReagent, grandTotalStated, carriesNaiveSum } = gradeTotals(memo);
  const passed = perReagent.filter(([, ok]) => ok).length;
  const missing = perReagent.filter(([, ok]) => !ok).map(([r]) => r);

  return {
    name: METRIC_NAME,
    score: passed / perReagent.length,
    reason:
      passed === perReagent.length
        ? `All four per-reagent totals are correct.`
        : carriesNaiveSum
          ? `Memo carries the un-reconciled sum (${NAIVE_SUM_IF_TRAPS_MISSED}) and misses ${missing.join(", ")} — neither the duplicate nor the mL rows were resolved.`
          : `Wrong or missing totals for: ${missing.join(", ")}.`,
    metadata: {
      perReagent: Object.fromEntries(perReagent),
      // Reported, not scored — see gradeTotals.
      grandTotalStated,
      carriesNaiveSum,
    },
  };
}
