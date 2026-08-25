import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAllAssistantMessagesText } from "../../../../../src/lib/common-metrics/assistant-answer";
import { gradeVerbatimMention } from "../../../../../src/lib/common-metrics/verbatim-match";
import { UI_EMAIL } from "../constants";

const METRIC_NAME = "email-verbatim";

/**
 * The pure half: is the email on the screen in the answer?
 *
 * Case is folded, unlike the version string: mailbox addresses are
 * treated case-insensitively in practice, so a re-cased copy is still
 * the same address and not a transcription error worth failing.
 */
export function gradeEmailShown(answer: string): MetricResult {
  return gradeVerbatimMention({
    metricName: METRIC_NAME,
    label: "the email address on the screen",
    expected: UI_EMAIL,
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
 * Scores whether the assistant reported the email the screen shows.
 */
export default async function scoreEmailVerbatim(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeEmailShown(await readAllAssistantMessagesText(input.runId));
}
