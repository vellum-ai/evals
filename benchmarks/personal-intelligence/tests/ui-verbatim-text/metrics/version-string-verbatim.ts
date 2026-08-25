import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAllAssistantMessagesText } from "../../../../../src/lib/common-metrics/assistant-answer";
import { gradeVerbatimMention } from "../../../../../src/lib/common-metrics/verbatim-match";
import { UI_VERSION_STRING } from "../constants";

const METRIC_NAME = "version-string-verbatim";

/**
 * The pure half: is the printed version line in the answer, character
 * for character?
 *
 * Case counts here. A version string goes into a bug report and gets
 * matched against release records, so `V3.14.2` is a different string
 * from what the screen shows. Only whitespace is normalized, for a reply
 * that wrapped the line.
 */
export function gradeVersionString(answer: string): MetricResult {
  return gradeVerbatimMention({
    metricName: METRIC_NAME,
    label: "the version string",
    expected: UI_VERSION_STRING,
    answer,
    caseSensitive: true,
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
 * Scores whether the assistant copied the version string exactly.
 */
export default async function scoreVersionStringVerbatim(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeVersionString(await readAllAssistantMessagesText(input.runId));
}
