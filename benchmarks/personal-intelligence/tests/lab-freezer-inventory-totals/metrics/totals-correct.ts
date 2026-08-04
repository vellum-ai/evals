import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
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
 * Are the reorder numbers right?
 *
 * Five equally weighted checks: the four per-reagent totals and the
 * grand total. Getting these right requires reconciling both planted
 * defects — the duplicated sample and team-09's mL rows — so this is the
 * metric the traps actually bite on.
 *
 * A run that summed the column as written is called out by name in the
 * reason, because 11250.775 is a specific and recognisable wrong answer
 * rather than a near miss.
 */
export default async function scoreTotalsCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  let memo: string;
  try {
    memo = await readAssistantWorkspaceFile(input.runId, TOTALS_PATH);
  } catch (err) {
    if (err instanceof AssistantContainerUnavailableError) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason:
          "Assistant container not inspectable (non-vellum species?); cannot grade the memo.",
      };
    }
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `No memo at ${TOTALS_PATH} — the deliverable was never written.`,
    };
  }

  const perReagent = Object.entries(REAGENT_TOTALS_UL).map(
    ([reagent, total]) => [reagent, mentionsNumber(memo, total)] as const,
  );
  const grandOk = mentionsNumber(memo, GRAND_TOTAL_UL);
  const naive =
    memo.includes(String(NAIVE_SUM_IF_TRAPS_MISSED)) ||
    memo.includes("11250") ||
    memo.includes("11,250");

  const passed = perReagent.filter(([, ok]) => ok).length + (grandOk ? 1 : 0);
  const missing = perReagent.filter(([, ok]) => !ok).map(([r]) => r);

  return {
    name: METRIC_NAME,
    score: passed / (perReagent.length + 1),
    reason:
      passed === perReagent.length + 1
        ? `All per-reagent totals and the ${GRAND_TOTAL_UL} µL grand total are correct.`
        : naive
          ? `Memo carries the un-reconciled sum (${NAIVE_SUM_IF_TRAPS_MISSED}) — neither the duplicate nor the mL rows were resolved.`
          : `Wrong or missing totals for: ${missing.join(", ") || "(grand total)"}.`,
    metadata: {
      perReagent: Object.fromEntries(perReagent),
      grandTotalCorrect: grandOk,
      carriesNaiveSum: naive,
    },
  };
}
