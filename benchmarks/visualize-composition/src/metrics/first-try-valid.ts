import type { MetricInput, MetricResult } from "../../../../src/lib/metrics";
import { readVisualRun, visualUiShowCalls } from "./run-view";

const METRIC_NAME = "first-try-valid";

/**
 * Did the first visual the model composed survive validation.
 *
 * `ui_show` rejects a visual fragment before it ever renders when it
 * breaks the sandbox contract - oversized markup, external resources,
 * hardcoded colours instead of design tokens, an `<svg>` with no
 * `viewBox`. The rejection comes back as an ordinary `tool_result` with
 * `isError: true` and a teaching string, and the model retries. Each
 * retry is another full fragment composed and streamed, so retries are
 * the second-largest cost in this benchmark after markup-in-thinking.
 *
 * Scores `1 / (1 + rejections)` on the rejections preceding the first
 * accepted call: clean first try 1, one retry 0.5, two retries 0.33. A
 * run whose visual was never accepted scores 0, and so does a run that
 * never attempted one - there is no first try to have been valid.
 */
export default async function scoreFirstTryValid(
  input: MetricInput,
): Promise<MetricResult> {
  const view = await readVisualRun(input.runId);
  const attempts = visualUiShowCalls(view);

  if (attempts.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "No visual ui_show call was made.",
      metadata: { attempts: 0, rejections: null, accepted: false },
    };
  }

  const acceptedIndex = attempts.findIndex((call) => call.isError === false);
  const rejections =
    acceptedIndex === -1
      ? attempts.filter((call) => call.isError === true).length
      : acceptedIndex;
  const firstRejection = attempts.find((call) => call.isError === true)?.result;
  const metadata = {
    attempts: attempts.length,
    rejections,
    accepted: acceptedIndex !== -1,
    firstRejectionMessage: firstRejection ?? null,
  };

  if (acceptedIndex === -1) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `All ${attempts.length} visual attempt(s) were rejected.`,
      metadata,
    };
  }

  return {
    name: METRIC_NAME,
    score: 1 / (1 + rejections),
    reason:
      rejections === 0
        ? "First visual attempt passed validation."
        : `Visual accepted after ${rejections} rejected attempt(s).`,
    metadata,
  };
}
