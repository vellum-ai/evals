import {
  readAssistantEvents,
  readTranscript,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import { buildTranscriptView } from "../../../../../src/lib/transcript-view";
import { classifyWithJudge } from "../../../../../src/lib/llm-judge";
import { EXPECTED_TOTAL_USD, EXPECTED_TRANSACTION_COUNT } from "../constants";

const METRIC_NAME = "total-sum-correct";

/**
 * Two totals within half a cent are the same dollar amount; anything looser
 * would forgive a genuinely wrong cent digit.
 */
const CENTS_TOLERANCE = 0.005;

/**
 * Extracts the total dollar amount an answer claims, or null when it claims
 * none. Injected in tests; defaults to a Haiku judge so phrasing variance
 * ("$256.93", "256.93 USD", "two hundred fifty-six dollars and 93 cents")
 * is resolved on meaning rather than by a currency regex.
 */
export type ClaimedTotalExtractor = (answer: string) => Promise<number | null>;

/**
 * Reconstructs the assistant's final answer message.
 *
 * The Vellum stream lands one transcript turn per `assistant_text_delta`, so
 * the final answer is spread across many fragment turns. `buildTranscriptView`
 * folds consecutive deltas back into whole messages (splitting only on
 * simulator turns) and keeps thinking blocks separate, so the last assistant
 * message's text blocks are the actual answer rather than a trailing token
 * or an internal reasoning fragment.
 */
async function readFinalAnswer(runId: string): Promise<string | undefined> {
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

async function extractClaimedTotal(answer: string): Promise<number | null> {
  const verdict = await classifyWithJudge({
    system: [
      "You grade an eval answer where an assistant summed card transactions from two screenshots.",
      "Extract the single dollar amount the answer claims as the TOTAL of all transactions combined.",
      "Judge only the grand-total claim: ignore per-transaction amounts, subtotals for one screenshot, and rewards-points figures.",
      "If the answer states no combined total (e.g. it says it cannot read the screenshots), report null.",
    ].join("\n"),
    user: `Assistant answer:\n\n${answer}`,
    tool: {
      name: "report_claimed_total",
      description:
        "Report the grand-total dollar amount the assistant claimed, or null if it claimed none.",
      inputSchema: {
        type: "object",
        properties: {
          totalUsd: {
            type: ["number", "null"],
            description:
              "The claimed total in dollars (e.g. 256.93), or null when the answer states no combined total.",
          },
        },
        required: ["totalUsd"],
      },
    },
  });
  const total = verdict.totalUsd;
  return typeof total === "number" && Number.isFinite(total) ? total : null;
}

function scoreClaimedTotal(claimed: number | null): MetricResult {
  const correct =
    claimed !== null &&
    Math.abs(claimed - EXPECTED_TOTAL_USD) < CENTS_TOLERANCE;
  let reason: string;
  if (correct) {
    reason = `Assistant reported the correct total ($${EXPECTED_TOTAL_USD.toFixed(2)}) across all ${EXPECTED_TRANSACTION_COUNT} transactions.`;
  } else if (claimed === null) {
    reason = `Assistant reported no combined total (expected $${EXPECTED_TOTAL_USD.toFixed(2)}).`;
  } else {
    reason = `Assistant reported a total of $${claimed.toFixed(2)} instead of $${EXPECTED_TOTAL_USD.toFixed(2)} — the known failure mode is summing only a subset of the transactions in the screenshots.`;
  }
  return {
    name: METRIC_NAME,
    score: correct ? 1 : 0,
    reason,
    metadata: {
      expectedTotalUsd: EXPECTED_TOTAL_USD,
      claimedTotalUsd: claimed,
    },
  };
}

/**
 * Scores whether the assistant reported the correct total across every
 * transaction in both screenshots.
 *
 * Grades the agent's *final* answer message rather than the whole transcript,
 * so a running subtotal mentioned while it works does not count. The claimed
 * total is extracted by an LLM judge and compared numerically here, so the
 * pass/fail line (exact to the cent) stays in code rather than in a prompt.
 */
export default async function scoreTotalSumCorrect(
  input: MetricInput,
  extract: ClaimedTotalExtractor = extractClaimedTotal,
): Promise<MetricResult> {
  const finalAnswer = await readFinalAnswer(input.runId);

  if (finalAnswer === undefined || finalAnswer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "Assistant produced no answer turn.",
      metadata: { expectedTotalUsd: EXPECTED_TOTAL_USD },
    };
  }

  const claimed = await extract(finalAnswer);
  return scoreClaimedTotal(claimed);
}
