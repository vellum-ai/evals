/**
 * Shared reader for "the assistant's answer, as text" — the persisted
 * transcript when it has assistant turns, else the full narration
 * (streamed text/thinking deltas) for runs whose responses never made it
 * into the transcript.
 *
 * Text-matching answer metrics must share this fallback: grading the
 * transcript alone silently scores 0 on exactly the runs whose adapter
 * streamed a fine answer that never landed as a transcript turn — the
 * failure `oversized-log-triage` was hardened against while its sibling
 * `deep-file-fact-lookup` still fell to it.
 *
 * Metrics that need message *boundaries* (e.g. cross-file-survey's
 * last-service-naming-message selection) keep their own case-specific
 * readers; this is the plain concatenated-text policy.
 */

import { readAssistantNarration, readTranscript } from "../metrics";

/** The assistant's answer text: transcript join, narration fallback. */
export async function readAssistantAnswerText(runId: string): Promise<string> {
  const transcript = await readTranscript(runId);
  const answer = transcript
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.content)
    .join("\n");
  return answer.trim() === "" ? await readAssistantNarration(runId) : answer;
}
