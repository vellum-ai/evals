import type { MetricInput, MetricResult } from "../../../../src/lib/metrics";
import { readVisualRun, showedVisual, visualUiShowCalls } from "./run-view";

const METRIC_NAME = "visual-shown";

/**
 * Did a visual actually reach the user.
 *
 * The outcome-side companion to `markup-in-thinking`: a SKILL.md variant
 * that stops the model drafting markup in its reasoning but also stops
 * it drawing has not fixed anything, and only this metric will say so.
 *
 * Scored on delivery, not on intent. A run that called `ui_show` and had
 * every attempt rejected by the visual validator scores 0 - the user saw
 * nothing either way - but the reason string distinguishes "never tried"
 * from "tried and was rejected" so the failure is diagnosable at a glance.
 */
export default async function scoreVisualShown(
  input: MetricInput,
): Promise<MetricResult> {
  const view = await readVisualRun(input.runId);
  const attempts = visualUiShowCalls(view);
  const shown = showedVisual(view);
  const metadata = {
    shown,
    surfaceEvents: view.visualSurfaces.length,
    pendingVisualEvents: view.pendingVisuals.length,
    visualUiShowCalls: attempts.length,
    rejectedCalls: attempts.filter((call) => call.isError === true).length,
  };

  if (shown) {
    return {
      name: METRIC_NAME,
      score: 1,
      reason: `Rendered ${view.visualSurfaces.length || 1} visual surface(s).`,
      metadata,
    };
  }

  if (attempts.length === 0 && view.pendingVisuals.length > 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "Started composing a visual into the tool call but the turn ended before the call landed.",
      metadata,
    };
  }

  return {
    name: METRIC_NAME,
    score: 0,
    reason:
      attempts.length === 0
        ? "No visual was attempted."
        : `All ${attempts.length} visual attempt(s) came back as errors.`,
    metadata,
  };
}
