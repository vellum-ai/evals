import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  ASSISTANT_WORKSPACE_DIR,
  AssistantContainerUnavailableError,
  execInAssistantContainer,
} from "../../../../../src/lib/vellum-artifacts";
import { BUGGY_OUTPUT, CORRECT_OUTPUT } from "../constants";

const METRIC_NAME = "bug-fixed";

/**
 * Does the report actually print the right number now? Metrics run
 * before agent shutdown, so the workspace container is still live: run
 * `bun run report.ts` in it and check stdout for the corrected total.
 * This asserts on executable state the transcript can't spoof — an
 * assistant that *claims* a fix without landing one scores 0 here.
 *
 * Deliberately independent of `patch-not-rewrite`: a wholesale rewrite
 * that repairs the number still scores 1 here (and 0 there).
 */
export default async function scoreBugFixed(
  input: MetricInput,
): Promise<MetricResult> {
  let run;
  try {
    run = await execInAssistantContainer(input.runId, [
      "sh",
      "-lc",
      `cd ${ASSISTANT_WORKSPACE_DIR} && bun run report.ts`,
    ]);
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) throw err;
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot execute report.ts to verify the fix.",
    };
  }

  const fixed = run.stdout.includes(CORRECT_OUTPUT);
  const stillBuggy = run.stdout.includes(BUGGY_OUTPUT);
  return {
    name: METRIC_NAME,
    score: fixed ? 1 : 0,
    reason: fixed
      ? `report.ts prints the corrected total ${CORRECT_OUTPUT}.`
      : stillBuggy
        ? `report.ts still prints the buggy total ${BUGGY_OUTPUT} — the defect was not fixed.`
        : `report.ts printed neither the corrected nor the buggy total (exit ${run.exitCode}) — the workspace no longer reproduces either state.`,
    metadata: {
      exitCode: run.exitCode,
      stillBuggy,
      stdout: run.stdout.trim().slice(0, 500),
      stderr: run.stderr.trim().slice(0, 500),
    },
  };
}
