import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAnswerTextForGrading } from "../../../../../src/lib/common-metrics/assistant-answer";
import {
  extractClaimedNumber,
  gradeClaimedNumber,
} from "../../../../../src/lib/common-metrics/claim-extraction";
import {
  ASKED_BAR_LABEL,
  ASKED_BAR_VALUE,
  BAR_VALUE_TOLERANCE,
} from "../constants";

const METRIC_NAME = "bar-value";

/** Extracts the bar value an answer claims. Injected in tests. */
export type BarValueExtractor = (answer: string) => Promise<number | null>;

/**
 * The pure half: is the claimed value the one printed above the bar?
 *
 * The tolerance is half of the printed precision, so a rounded reading
 * (47 for 47.3) fails: reading the height off the axis instead of the
 * printed label is exactly the shortcut this case is built to catch.
 */
export function gradeClaimedBarValue(claimed: number | null): MetricResult {
  return gradeClaimedNumber({
    metricName: METRIC_NAME,
    label: `the ${ASKED_BAR_LABEL} bar's value`,
    expected: ASKED_BAR_VALUE,
    claimed,
    tolerance: BAR_VALUE_TOLERANCE,
    format: (value) => value.toFixed(1),
    wrongAnswerHint: "the value is printed above the bar",
  });
}

async function extractBarValue(answer: string): Promise<number | null> {
  return extractClaimedNumber({
    answer,
    task: "read the value of one named bar off a bar chart",
    claim: `the value the answer gives for the ${ASKED_BAR_LABEL} bar`,
    notes: [
      "Ignore the other bars, the axis ticks and any total: report only the " +
        `figure the answer attributes to the ${ASKED_BAR_LABEL} bar.`,
      "Keep the decimal part exactly as the answer states it.",
    ],
    toolName: "report_claimed_bar_value",
  });
}

/** Scores whether the assistant read the named bar's printed value. */
export default async function scoreBarValue(
  input: MetricInput,
  extract: BarValueExtractor = extractBarValue,
): Promise<MetricResult> {
  const answer = await readAnswerTextForGrading(input.runId);
  if (answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "The assistant produced no answer.",
      metadata: { expected: ASKED_BAR_VALUE, claimed: null },
    };
  }
  return gradeClaimedBarValue(await extract(answer));
}
