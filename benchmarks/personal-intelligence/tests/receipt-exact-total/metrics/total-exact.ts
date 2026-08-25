import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAnswerTextForGrading } from "../../../../../src/lib/common-metrics/assistant-answer";
import {
  extractClaimedNumber,
  gradeClaimedNumber,
} from "../../../../../src/lib/common-metrics/claim-extraction";
import { EXPECTED_TOTAL_USD, SUBTOTAL_USD } from "../constants";

const METRIC_NAME = "total-exact";

/** Extracts the total an answer claims. Injected in tests. */
export type TotalExtractor = (answer: string) => Promise<number | null>;

const formatUsd = (value: number): string => `$${value.toFixed(2)}`;

/**
 * The pure half: is the claimed total the printed one, to the cent?
 *
 * The comparison is numeric and exact here rather than in a prompt, so
 * the pass/fail line stays in code. The subtotal is called out by name
 * on a miss because "stopped one line above the total" is the specific
 * mistake this case is built to catch.
 */
export function gradeClaimedTotal(claimed: number | null): MetricResult {
  const result = gradeClaimedNumber({
    metricName: METRIC_NAME,
    label: "the receipt total",
    expected: EXPECTED_TOTAL_USD,
    claimed,
    format: formatUsd,
    wrongAnswerHint: `the subtotal one line above it is ${formatUsd(SUBTOTAL_USD)}`,
  });
  return {
    ...result,
    metadata: { ...result.metadata, subtotalUsd: SUBTOTAL_USD },
  };
}

async function extractTotal(answer: string): Promise<number | null> {
  return extractClaimedNumber({
    answer,
    task: "read the total off a photographed store receipt",
    claim: "the TOTAL the answer states for the receipt",
    notes: [
      "Ignore per-item amounts, the subtotal and the tax line: report only " +
        "the figure the answer gives as the receipt's total.",
      "If the answer gives the subtotal as the total, report the number it " +
        "presented as the total.",
    ],
    toolName: "report_claimed_total",
  });
}

/**
 * Scores whether the assistant reported the receipt's printed total.
 *
 * Grades the assistant's final answer message, so a figure mentioned
 * while it works does not count.
 */
export default async function scoreTotalExact(
  input: MetricInput,
  extract: TotalExtractor = extractTotal,
): Promise<MetricResult> {
  const answer = await readAnswerTextForGrading(input.runId);
  if (answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "The assistant produced no answer.",
      metadata: { expected: EXPECTED_TOTAL_USD, claimed: null },
    };
  }
  return gradeClaimedTotal(await extract(answer));
}
