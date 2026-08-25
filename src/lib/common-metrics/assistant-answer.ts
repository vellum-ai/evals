/**
 * Shared readers for "what the assistant said", in the shapes answer
 * metrics need: the whole narration, the final answer message, every
 * message folded and joined, and the interleaved conversation.
 *
 * Which one a metric wants follows from what it grades. A claimed figure
 * uses the final message, so a running number mentioned mid-work does
 * not count. A verbatim string uses every message, because the ask is
 * whether the assistant ever put that string in front of the user and a
 * quoted string has no draft form a later message supersedes.
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
 * Every assistant message's text, folded back into whole messages and
 * joined, with the narration fallback when none carries text.
 *
 * The join is on message boundaries, not on stream deltas. Joining the
 * raw transcript turns instead splits a reply between every streamed
 * fragment, and a verbatim comparison then sees `v 3 . 14 . 2` where the
 * assistant wrote `v3.14.2`.
 *
 * This is what a verbatim metric grades: the question is whether the
 * assistant ever put the string in front of the user, and unlike a
 * running figure a quoted string has no draft form that a later message
 * supersedes. A conversation that answers and is then asked to confirm
 * ends on the confirmation, so grading the last message alone reports
 * the string as never given.
 */
export async function readAllAssistantMessagesText(
  runId: string,
): Promise<string> {
  const [turns, events] = await Promise.all([
    readTranscript(runId),
    readAssistantEvents(runId),
  ]);
  const text = joinAssistantMessagesText(buildTranscriptView(turns, events));
  return text.trim() === "" ? await readAssistantNarration(runId) : text;
}

/** The pure half of {@link readAllAssistantMessagesText}. */
export function joinAssistantMessagesText(items: TranscriptViewItem[]): string {
  return items
    .filter((item) => item.role === "assistant")
    .map((item) =>
      item.blocks
        .filter((block) => block.kind === "text")
        .map((block) => block.text)
        .join(""),
    )
    .filter((text) => text.trim() !== "")
    .join("\n");
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
