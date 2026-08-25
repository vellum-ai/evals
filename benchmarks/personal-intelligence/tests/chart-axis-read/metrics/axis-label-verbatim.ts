import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAllAssistantMessagesText } from "../../../../../src/lib/common-metrics/assistant-answer";
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

/**
 * A verbatim string is graded across every assistant message, not the
 * final one alone. The question is whether the assistant ever put the
 * string in front of the user; unlike a running figure, a quoted string
 * has no draft form that a later message supersedes. A conversation that
 * answers and is then asked to confirm ends on the confirmation, and
 * grading that last message alone reports the string as never given.
 *
 * Scores whether the assistant reproduced the chart's y-axis label.
 */
export default async function scoreAxisLabelVerbatim(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeAxisLabel(await readAllAssistantMessagesText(input.runId));
}
