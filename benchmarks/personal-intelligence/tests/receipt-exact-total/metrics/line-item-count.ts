import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAnswerTextForGrading } from "../../../../../src/lib/common-metrics/assistant-answer";
import {
  extractClaimedNumber,
  gradeClaimedNumber,
} from "../../../../../src/lib/common-metrics/claim-extraction";
import { EXPECTED_LINE_ITEM_COUNT, SUMMED_QUANTITY } from "../constants";

const METRIC_NAME = "line-item-count";

/** Extracts the item count an answer claims. Injected in tests. */
export type CountExtractor = (answer: string) => Promise<number | null>;

/** A count is a whole number: anything but the exact one is wrong. */
const COUNT_TOLERANCE = 0.5;

/**
 * The pure half: did the answer count the product rows?
 *
 * A miss names the summed quantity column, because reporting 15 is not a
 * random wrong number. It is the run that added the quantities instead
 * of counting the rows, and the two failures deserve different reading.
 */
export function gradeClaimedItemCount(claimed: number | null): MetricResult {
  return gradeClaimedNumber({
    metricName: METRIC_NAME,
    label: "the line-item count",
    expected: EXPECTED_LINE_ITEM_COUNT,
    claimed,
    tolerance: COUNT_TOLERANCE,
    wrongAnswerHint: `the quantity column sums to ${SUMMED_QUANTITY}`,
  });
}

async function extractCount(answer: string): Promise<number | null> {
  return extractClaimedNumber({
    answer,
    task: "count the line items on a photographed store receipt",
    claim: "the number of line items the answer says the receipt lists",
    notes: [
      "Report the count of product rows the answer claims, not the total " +
        "quantity of units and not any dollar amount.",
    ],
    toolName: "report_claimed_item_count",
  });
}

/** Scores whether the assistant counted the receipt's product rows. */
export default async function scoreLineItemCount(
  input: MetricInput,
  extract: CountExtractor = extractCount,
): Promise<MetricResult> {
  const answer = await readAnswerTextForGrading(input.runId);
  if (answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "The assistant produced no answer.",
      metadata: { expected: EXPECTED_LINE_ITEM_COUNT, claimed: null },
    };
  }
  return gradeClaimedItemCount(await extract(answer));
}
