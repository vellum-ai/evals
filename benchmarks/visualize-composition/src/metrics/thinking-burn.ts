import type { MetricInput, MetricResult } from "../../../../src/lib/metrics";
import { readVisualRun, thinkingBeforeFirstUiShow } from "./run-view";

const METRIC_NAME = "thinking-burn";

/**
 * Reasoning volume, in characters, that earns full marks.
 *
 * Deciding *that* a visual helps and *what* it should show is a few
 * sentences of reasoning. 1200 characters is generous for that and far
 * below what composing a fragment costs.
 */
export const BASELINE_CHARS = 1200;

/**
 * How much reasoning the model spent before committing to the tool call.
 *
 * Measured in characters, not tokens: the daemon's usage events carry
 * flat per-turn totals with no reasoning breakdown, and the harness's
 * authoritative usage comes from the egress jail's recorded HTTP
 * traffic, which cannot be attributed to a thinking span. Characters are
 * what the artifacts actually support, and they track tokens closely
 * enough to rank variants.
 *
 * The window runs from the `skill_load` result (or the user's question,
 * when no skill was loaded) to the first `ui_show` call. When the run
 * never called `ui_show`, or the events carry no usable stamps, it falls
 * back to the whole turn's thinking and says so in `metadata.attributed`
 * - a run that thought for pages and never drew is exactly the case this
 * metric must not silently score as clean.
 *
 * Score decays as `min(1, baseline / chars)`, matching the other
 * efficiency metrics in the harness.
 */
export default async function scoreThinkingBurn(
  input: MetricInput,
): Promise<MetricResult> {
  const view = await readVisualRun(input.runId);
  const { thinking, attributed } = thinkingBeforeFirstUiShow(view);
  const chars = thinking.length;
  const metadata = {
    thinkingChars: chars,
    baselineChars: BASELINE_CHARS,
    attributed,
    skillLoads: view.skillLoads.length,
    uiShowCalls: view.uiShowCalls.length,
  };

  if (chars === 0) {
    return {
      name: METRIC_NAME,
      score: 1,
      reason: "No thinking emitted before the tool call.",
      metadata,
    };
  }

  const score = Math.min(1, BASELINE_CHARS / chars);
  const window = attributed
    ? "before the first ui_show call"
    : "across the whole turn (no ui_show call to bound the window)";
  return {
    name: METRIC_NAME,
    score,
    reason: `${chars} chars of thinking ${window} (baseline ${BASELINE_CHARS}).`,
    metadata,
  };
}
