import type { MetricInput, MetricResult } from "../../../../src/lib/metrics";
import { firstVisualAt, readVisualRun } from "./run-view";

const METRIC_NAME = "time-to-visual";

/**
 * Wall-clock from the user's question to a visual on screen that earns
 * full marks, in ms.
 *
 * 25s is roughly what the surface costs when the model writes the
 * fragment straight into the tool call: a skill load, a short plan, and
 * the markup streaming out. Runs that draft the whole fragment in the
 * reasoning channel first land in the minutes, which is exactly the
 * separation this metric exists to show.
 */
export const BASELINE_MS = 25_000;

/**
 * How quickly the user saw a picture.
 *
 * Measured from the simulator's message timestamp (stamped immediately
 * before `agent.send()`) to the first visual surface's `emittedAt`, so
 * it covers the agent's own latency and none of the harness's container
 * hatch.
 *
 * Past the baseline the score decays as `min(1, baseline / elapsed)` -
 * the same hyperbolic curve as `runtime-efficiency` and `assistant-cost`,
 * so the efficiency signals compose on one 0-1 axis. A run that showed
 * no visual at all scores 0: there is no latency to credit.
 */
export default async function scoreTimeToVisual(
  input: MetricInput,
): Promise<MetricResult> {
  const view = await readVisualRun(input.runId);
  const visualAt = firstVisualAt(view);

  if (view.askedAt === undefined) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "No user message timestamp to measure from.",
      metadata: { elapsedMs: null, baselineMs: BASELINE_MS },
    };
  }
  if (visualAt === undefined) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "No visual was shown.",
      metadata: { elapsedMs: null, baselineMs: BASELINE_MS },
    };
  }

  const elapsed = Math.max(0, visualAt - view.askedAt);
  // A visual stamped at or before the question is a clock artifact, not
  // an instant answer; credit it rather than dividing by zero.
  const score = elapsed === 0 ? 1 : Math.min(1, BASELINE_MS / elapsed);
  const seconds = (elapsed / 1000).toFixed(1);

  return {
    name: METRIC_NAME,
    score,
    reason: `First visual on screen ${seconds}s after the question (baseline ${BASELINE_MS / 1000}s).`,
    metadata: {
      elapsedMs: elapsed,
      baselineMs: BASELINE_MS,
      surfaceEvents: view.visualSurfaces.length,
    },
  };
}
