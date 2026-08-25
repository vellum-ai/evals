import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAnswerTextForGrading } from "../../../../../src/lib/common-metrics/assistant-answer";
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

/** Scores whether the assistant reported the email the screen shows. */
export default async function scoreEmailVerbatim(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeEmailShown(await readAnswerTextForGrading(input.runId));
}
