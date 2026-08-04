import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import { BLURB_PATH, BLURB_RIGHT_DATE, BLURB_WRONG_DATE } from "../constants";

const METRIC_NAME = "blurb-fixed";

/**
 * Did phase 2's one-line fix actually land?
 *
 * Both halves matter: the new date present AND the old one gone. An edit
 * that appends the correction without removing the original leaves the
 * blurb self-contradicting, which for a date that appears on tickets and
 * venue signage is worse than not touching it.
 */
export default async function scoreBlurbFixed(
  input: MetricInput,
): Promise<MetricResult> {
  let blurb: string;
  try {
    blurb = await readAssistantWorkspaceFile(input.runId, BLURB_PATH);
  } catch (err) {
    if (err instanceof AssistantContainerUnavailableError) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason:
          "Assistant container not inspectable (non-vellum species?); cannot grade the blurb.",
      };
    }
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `${BLURB_PATH} is missing from the workspace.`,
    };
  }

  const hasRight = blurb.includes(BLURB_RIGHT_DATE);
  const hasWrong = blurb.includes(BLURB_WRONG_DATE);
  const checks = { newDatePresent: hasRight, oldDateRemoved: !hasWrong };
  const passed = Object.values(checks).filter(Boolean).length;
  return {
    name: METRIC_NAME,
    score: passed / 2,
    reason: hasRight
      ? hasWrong
        ? `Blurb says ${BLURB_RIGHT_DATE} but still also says ${BLURB_WRONG_DATE} — it now contradicts itself.`
        : `Blurb corrected to ${BLURB_RIGHT_DATE}.`
      : `Blurb still says ${BLURB_WRONG_DATE}.`,
    metadata: checks,
  };
}
