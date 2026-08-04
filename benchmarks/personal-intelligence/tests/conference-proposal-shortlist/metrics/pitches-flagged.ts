import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import { PITCH_IDS, SHORTLIST_PATH } from "../constants";

const METRIC_NAME = "pitches-flagged";

/**
 * Did the shortlist find the five vendor pitches hidden in the pile?
 *
 * Recall only. Each planted pitch names a product and tells the reader
 * to book a demo at the sponsor booth, so identifying one takes no
 * taste. Which of the remaining 33 talks deserve a shortlist slot is a
 * matter of opinion and is deliberately ungraded — a metric that
 * pretended otherwise would be measuring whoever wrote the answer key.
 *
 * Scored as the fraction found, since finding four of five is genuinely
 * better than finding none.
 */
export default async function scorePitchesFlagged(
  input: MetricInput,
): Promise<MetricResult> {
  let shortlist: string;
  try {
    shortlist = await readAssistantWorkspaceFile(input.runId, SHORTLIST_PATH);
  } catch (err) {
    if (err instanceof AssistantContainerUnavailableError) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason:
          "Assistant container not inspectable (non-vellum species?); cannot grade the shortlist.",
      };
    }
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `No shortlist at ${SHORTLIST_PATH} — the deliverable was never written.`,
      metadata: { shortlistExists: false },
    };
  }

  const haystack = shortlist.toLowerCase();
  const found = PITCH_IDS.filter((id) => haystack.includes(id.toLowerCase()));
  const missing = PITCH_IDS.filter((id) => !found.includes(id));
  return {
    name: METRIC_NAME,
    score: found.length / PITCH_IDS.length,
    reason:
      missing.length === 0
        ? "All five vendor pitches were identified."
        : `Missed ${missing.length} of ${PITCH_IDS.length} vendor pitches: ${missing.join(", ")}.`,
    metadata: { found, missing },
  };
}
