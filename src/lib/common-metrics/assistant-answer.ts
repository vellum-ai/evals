/**
 * Shared readers for "what the assistant said", in the three shapes
 * answer metrics need: the whole narration, the final answer message,
 * and the interleaved conversation.
 *
 * Text-matching answer metrics must share the narration fallback:
 * grading the transcript alone silently scores 0 on exactly the runs
 * whose adapter streamed a fine answer that never landed as a transcript
 * turn — the failure `oversized-log-triage` was hardened against while
 * its sibling `deep-file-fact-lookup` still fell to it.
 *
 * Metrics that need message *boundaries* (e.g. cross-file-survey's
 * last-service-naming-message selection) keep their own case-specific
 * readers; these are the shared policies.
 */

import {
  readAssistantEvents,
  readAssistantNarration,
  readTranscript,
} from "../metrics";
import {
  buildTranscriptView,
  type TranscriptViewItem,
} from "../transcript-view";

/** The assistant's answer text: transcript join, narration fallback. */
export async function readAssistantAnswerText(runId: string): Promise<string> {
  const transcript = await readTranscript(runId);
  const answer = transcript
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.content)
    .join("\n");
  return answer.trim() === "" ? await readAssistantNarration(runId) : answer;
}

/**
 * The text of the assistant's LAST message, or undefined when it sent
 * none.
 *
 * The Vellum stream lands one transcript turn per `assistant_text_delta`,
 * so the final answer is spread across many fragment turns.
 * `buildTranscriptView` folds consecutive deltas back into whole messages
 * (splitting only on simulator turns) and keeps thinking blocks separate,
 * so the last assistant message's text blocks are the actual answer
 * rather than a trailing token or an internal reasoning fragment.
 *
 * Use this when a running figure mentioned mid-work must not count, so
 * only the answer the assistant finally committed to is graded.
 */
export async function readFinalAssistantMessageText(
  runId: string,
): Promise<string | undefined> {
  const [turns, events] = await Promise.all([
    readTranscript(runId),
    readAssistantEvents(runId),
  ]);
  const finalMessage = buildTranscriptView(turns, events)
    .filter((item) => item.role === "assistant")
    .at(-1);
  if (!finalMessage) return undefined;
  return finalMessage.blocks
    .filter((block) => block.kind === "text")
    .map((block) => block.text)
    .join("");
}

/**
 * The answer a metric should grade: the final assistant message, falling
 * back to the whole narration when that message carries no text (a
 * tool-only or thinking-only last message, or an adapter whose replies
 * never landed as transcript turns).
 */
export async function readAnswerTextForGrading(runId: string): Promise<string> {
  const finalMessage = await readFinalAssistantMessageText(runId);
  if (finalMessage !== undefined && finalMessage.trim() !== "") {
    return finalMessage;
  }
  return readAssistantAnswerText(runId);
}

/**
 * Render an interleaved transcript as plain `User:` / `Assistant:`
 * blocks, dropping thinking and tool blocks.
 *
 * This is what a judge needs when a case asks several questions in one
 * conversation and each metric grades the reply to its own question: the
 * concatenated answer text alone loses which reply answered what.
 */
export function formatConversationText(items: TranscriptViewItem[]): string {
  const blocks: string[] = [];
  for (const item of items) {
    if (item.role === "simulator") {
      blocks.push(`User: ${item.content.trim()}`);
      continue;
    }
    const text = item.blocks
      .filter((block) => block.kind === "text")
      .map((block) => block.text)
      .join("")
      .trim();
    if (text !== "") blocks.push(`Assistant: ${text}`);
  }
  return blocks.join("\n\n");
}

/** {@link formatConversationText} over a run's persisted artifacts. */
export async function readConversationText(runId: string): Promise<string> {
  const [turns, events] = await Promise.all([
    readTranscript(runId),
    readAssistantEvents(runId),
  ]);
  return formatConversationText(buildTranscriptView(turns, events));
}
