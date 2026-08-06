import { mentionsStandaloneNumber } from "../../../../../src/lib/common-metrics/number-mention";
import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readDeliverable } from "../../../../../src/lib/common-metrics/workspace-deliverable";
import {
  GRAND_TOTAL_UL,
  NAIVE_SUM_IF_TRAPS_MISSED,
  REAGENT_TOTALS_UL,
  TOTALS_PATH,
} from "../constants";

const METRIC_NAME = "totals-correct";

/**
 * Spellings of the un-reconciled sum a memo might carry: exact
 * (11250.775), rounded to 2 dp — both true decimal rounding (11250.78)
 * and the float-artifact `toFixed` spelling (11250.77) — and the integer
 * roundings (11251 rounded, 11250 truncated). A memo that rounded the
 * stray-decimal number still carries the tell.
 */
const NAIVE_SUM_SPELLINGS = [
  NAIVE_SUM_IF_TRAPS_MISSED,
  Math.round(NAIVE_SUM_IF_TRAPS_MISSED * 100) / 100,
  Number(NAIVE_SUM_IF_TRAPS_MISSED.toFixed(2)),
  Math.round(NAIVE_SUM_IF_TRAPS_MISSED),
  Math.trunc(NAIVE_SUM_IF_TRAPS_MISSED),
];

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
    ([reagent, total]) =>
      [reagent, mentionsStandaloneNumber(memo, total)] as const,
  );
  return {
    perReagent,
    grandTotalStated: mentionsStandaloneNumber(memo, GRAND_TOTAL_UL),
    // The stray-decimal sum in any spelling — exact, 2-dp rounded, or
    // integer-rounded ({@link NAIVE_SUM_SPELLINGS}).
    carriesNaiveSum: NAIVE_SUM_SPELLINGS.some((spelling) =>
      mentionsStandaloneNumber(memo, spelling),
    ),
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
