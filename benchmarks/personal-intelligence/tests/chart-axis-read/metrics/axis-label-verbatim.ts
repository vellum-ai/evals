import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAnswerTextForGrading } from "../../../../../src/lib/common-metrics/assistant-answer";
import { gradeVerbatimMention } from "../../../../../src/lib/common-metrics/verbatim-match";
import { CHART_Y_AXIS_LABEL } from "../constants";

const METRIC_NAME = "axis-label-verbatim";

/**
 * The pure half: did the answer reproduce the printed y-axis label?
 *
 * Whitespace is normalized and case is folded, because the user asked
 * what the axis measures and neither wrapping nor sentence casing
 * changes that. Everything else is exact: dropping the parenthesised
 * scale means the answer did not read the label, it guessed the topic.
 */
export function gradeAxisLabel(answer: string): MetricResult {
  return gradeVerbatimMention({
    metricName: METRIC_NAME,
    label: "the y-axis label",
    expected: CHART_Y_AXIS_LABEL,
    answer,
    caseSensitive: false,
  });
}

/** Scores whether the assistant reproduced the chart's y-axis label. */
export default async function scoreAxisLabelVerbatim(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeAxisLabel(await readAnswerTextForGrading(input.runId));
}
