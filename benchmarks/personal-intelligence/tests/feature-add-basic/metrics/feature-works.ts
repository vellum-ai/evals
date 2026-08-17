import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  ASSISTANT_WORKSPACE_DIR,
  AssistantContainerUnavailableError,
  execInAssistantContainer,
} from "../../../../../src/lib/vellum-artifacts";
import { TRACKER_DIR, YEAR_2025_TOTAL } from "../constants";

const METRIC_NAME = "feature-works";
const TRACKER_PATH = `${ASSISTANT_WORKSPACE_DIR}/${TRACKER_DIR}`;
const COMMAND = "bun run cli.ts report year 2025";

/**
 * Does the year view the user asked for actually run? Metrics run before
 * agent shutdown, so the workspace container is still live: run the
 * command the user was promised and check stdout for the year total. This
 * asserts on executable state the transcript can't spoof.
 *
 * Read-only by construction: reporting never writes the data file, so the
 * metric can run alongside `nothing-broken` without either disturbing the
 * other.
 */
export default async function scoreFeatureWorks(
  input: MetricInput,
): Promise<MetricResult> {
  let run;
  try {
    run = await execInAssistantContainer(input.runId, [
      "sh",
      "-lc",
      `cd ${TRACKER_PATH} && ${COMMAND}`,
    ]);
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) {
      throw err;
    }
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot run the year report to verify the feature.",
    };
  }

  const correct = run.stdout.includes(YEAR_2025_TOTAL);
  const commandFailed = run.exitCode !== 0;
  return {
    name: METRIC_NAME,
    score: correct ? 1 : 0,
    reason: correct
      ? `\`${COMMAND}\` prints the year total ${YEAR_2025_TOTAL}.`
      : commandFailed
        ? `\`${COMMAND}\` exited ${run.exitCode} (usage error or crash); the year view was never added.`
        : `\`${COMMAND}\` ran but did not print the year total ${YEAR_2025_TOTAL}; the feature landed with the wrong figure.`,
    metadata: {
      exitCode: run.exitCode,
      commandFailed,
      stdout: run.stdout.trim().slice(0, 500),
      stderr: run.stderr.trim().slice(0, 500),
    },
  };
}
