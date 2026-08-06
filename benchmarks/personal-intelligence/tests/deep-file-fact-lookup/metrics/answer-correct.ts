import {
  readTranscript,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import { CORRECT_TOTAL, DEPRECATED_TABLE_TOTAL } from "../constants";

const METRIC_NAME = "answer-correct";

/**
 * Matches a dollar amount tolerantly: 20270, 20,270, 20 270, 20270.00.
 * Boundary-guarded so a longer number containing the total does not
 * count, and `20270.5` does not pass as `20270`.
 */
export function mentionsAmount(text: string, value: number): boolean {
  const spaced = String(value).replace(/\B(?=(\d{3})+(?!\d))/g, "[,\\s]?");
  return new RegExp(`(?<![\\d.])${spaced}(?:\\.0{1,2})?(?!\\.?\\d)`).test(text);
}

/**
 * The pure half of the metric: which total does the answer carry?
 *
 * The correct total wins when both appear — a good answer may name the
 * superseded table's sum precisely to explain why it is wrong, the same
 * mention-versus-claim allowance `lab-freezer-inventory-totals` makes
 * for its naive sum. An answer carrying ONLY the deprecated total is the
 * arithmetic signature of never paging past the truncation notice.
 */
export function gradeAnswer(text: string): {
  matched: "correct" | "deprecated-trap" | "none";
  mentionsDeprecated: boolean;
} {
  const mentionsDeprecated = mentionsAmount(text, DEPRECATED_TABLE_TOTAL);
  if (mentionsAmount(text, CORRECT_TOTAL)) {
    return { matched: "correct", mentionsDeprecated };
  }
  return {
    matched: mentionsDeprecated ? "deprecated-trap" : "none",
    mentionsDeprecated,
  };
}

/** Did the stated order total come from the current table? */
export default async function scoreAnswerCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  const transcript = await readTranscript(input.runId);
  const answer = transcript
    .filter((turn) => turn.role === "assistant")
    .map((turn) => turn.content)
    .join("\n");

  const { matched, mentionsDeprecated } = gradeAnswer(answer);
  const reason =
    matched === "correct"
      ? `Answer states the current-catalog total ($${CORRECT_TOTAL}).`
      : matched === "deprecated-trap"
        ? `Answer states the superseded table's total ($${DEPRECATED_TABLE_TOTAL}) — computed from the first read window, never paged to the current table.`
        : `Answer states neither the correct total ($${CORRECT_TOTAL}) nor the superseded one ($${DEPRECATED_TABLE_TOTAL}).`;

  return {
    name: METRIC_NAME,
    score: matched === "correct" ? 1 : 0,
    reason,
    metadata: {
      matched,
      mentionsDeprecated,
      correctTotal: CORRECT_TOTAL,
      deprecatedTableTotal: DEPRECATED_TABLE_TOTAL,
    },
  };
}
