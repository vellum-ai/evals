import type { MetricInput, MetricResult } from "../../../../src/lib/metrics";
import { measureMarkup } from "./markup";
import { allThinking, readVisualRun } from "./run-view";

const METRIC_NAME = "markup-in-thinking";

/**
 * Markup volume in the reasoning channel at which the score bottoms out.
 *
 * A whole drafted fragment is thousands of characters (the visual
 * validator's own ceiling is 24000), and a stray `<div>` mentioned while
 * planning is tens. 1500 puts the floor where "drafted the thing twice"
 * lives while still separating a small leak from a large one.
 */
export const MARKUP_CHAR_BUDGET = 1500;

/**
 * The headline pathology metric: did the model compose the visual in its
 * head before writing it into the tool call.
 *
 * Reasoning *about* a visual is healthy and expected ("a flow diagram
 * reads better here than a table"). Reasoning that *contains* the
 * fragment is the failure - it burns thousands of thinking tokens,
 * delays the surface by tens of seconds, and on a bad turn hits
 * `max_tokens` mid-draft so the user sees nothing at all.
 *
 * Clean reasoning scores 1 and the score falls linearly to 0 at
 * `MARKUP_CHAR_BUDGET`. The boolean and the raw character count are both
 * in `metadata`, because the boolean is what a variant has to flip and
 * the count is what shows whether a variant helped before it flipped.
 */
export default async function scoreMarkupInThinking(
  input: MetricInput,
): Promise<MetricResult> {
  const view = await readVisualRun(input.runId);
  const thinking = allThinking(view);

  if (thinking.length === 0) {
    return {
      name: METRIC_NAME,
      score: 1,
      reason: "Assistant emitted no thinking; no markup to find.",
      metadata: {
        markupInThinking: false,
        markupChars: 0,
        markupTokens: 0,
        thinkingChars: 0,
      },
    };
  }

  const measurement = measureMarkup(thinking);
  const metadata = {
    markupInThinking: measurement.present,
    markupChars: measurement.markupChars,
    markupTokens: measurement.tokenCount,
    thinkingChars: measurement.totalChars,
    markupCharFraction:
      measurement.totalChars === 0
        ? 0
        : measurement.markupChars / measurement.totalChars,
    firstMarkupLine: measurement.sample ?? null,
  };

  if (!measurement.present) {
    return {
      name: METRIC_NAME,
      score: 1,
      reason: `No markup in ${measurement.totalChars} chars of thinking.`,
      metadata,
    };
  }

  const score = Math.max(0, 1 - measurement.markupChars / MARKUP_CHAR_BUDGET);
  return {
    name: METRIC_NAME,
    score,
    reason: `Drafted ${measurement.markupChars} chars of markup inside thinking (${measurement.tokenCount} markup tokens).`,
    metadata,
  };
}
