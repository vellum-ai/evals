import {
  readAssistantNarration,
  readTranscript,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import {
  CORRECT_ERROR_COUNT,
  FIRST_ERROR_MESSAGE,
  TRAP_ERROR_COUNT,
  TRAP_FIRST_MESSAGE,
} from "../constants";

const METRIC_NAME = "incident-answer-correct";

/**
 * Matches a standalone number: not embedded in a longer number, a
 * decimal, or a clock time (the trap count 14 would otherwise match a
 * quoted timestamp like "00:14:03").
 */
function mentionsNumber(text: string, value: number): boolean {
  return new RegExp(`(?<![\\d.:])${value}(?![\\d:])`).test(text);
}

/**
 * Whether the answer states an error message. Tolerant of paraphrase:
 * the full message verbatim, or the two tokens that only co-occur in
 * that message anywhere in the log — `generate.ts` guarantees each
 * kernel's second token appears in exactly one line.
 */
function mentionsMessage(
  lower: string,
  full: string,
  kernel: [string, string],
): boolean {
  return (
    lower.includes(full.toLowerCase()) ||
    kernel.every((token) => lower.includes(token))
  );
}

/**
 * The pure half of the metric: grade the assistant's answer text.
 *
 * Both facts right → 1. Exactly one → 0.5. Neither → 0, and when the
 * trap burst's count or first message is what the answer carries
 * instead, `trapHit` says so — that is the truncation-blind failure
 * this case plants: the old burst sits inside the default 2000-line
 * read window, the real incident in the final 5% of the file.
 */
export function gradeIncidentAnswer(answer: string): MetricResult {
  const lower = answer.toLowerCase();
  const countStated = mentionsNumber(answer, CORRECT_ERROR_COUNT);
  const messageStated = mentionsMessage(lower, FIRST_ERROR_MESSAGE, [
    "payments-gateway",
    "certificate expired",
  ]);
  const trapCountStated = mentionsNumber(answer, TRAP_ERROR_COUNT);
  const trapMessageStated = mentionsMessage(lower, TRAP_FIRST_MESSAGE, [
    "connection pool exhausted",
    "checkout-db-2",
  ]);

  const passed = Number(countStated) + Number(messageStated);
  const trapHit = passed === 0 && (trapCountStated || trapMessageStated);

  return {
    name: METRIC_NAME,
    score: passed / 2,
    reason:
      passed === 2
        ? "Both the incident's error count and its first message are in the answer."
        : trapHit
          ? "Answer carries the OLD burst's numbers — the trap inside the default read window — not the incident's."
          : passed === 1
            ? `Only one of the two facts is right (${countStated ? "count" : "first message"}).`
            : "Neither the incident's count nor its first message is in the answer.",
    metadata: {
      countStated,
      messageStated,
      trapCountStated,
      trapMessageStated,
      trapHit,
    },
  };
}

/** Did the answer come from the real incident? See {@link gradeIncidentAnswer}. */
export default async function scoreIncidentAnswer(
  input: MetricInput,
): Promise<MetricResult> {
  // Prefer the persisted transcript (the answer as the user saw it);
  // fall back to the full narration for runs whose responses never made
  // it into the transcript.
  const transcript = await readTranscript(input.runId);
  const answer = transcript
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.content)
    .join("\n");
  return gradeIncidentAnswer(
    answer.trim() === "" ? await readAssistantNarration(input.runId) : answer,
  );
}
