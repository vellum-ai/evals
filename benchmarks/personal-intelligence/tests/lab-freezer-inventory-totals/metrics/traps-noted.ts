import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readDeliverable } from "../../../../../src/lib/common-metrics/workspace-deliverable";
import {
  DUPLICATE_SAMPLE_ID,
  MISMATCHED_UNIT_TEAM,
  TOTALS_PATH,
} from "../constants";

const METRIC_NAME = "traps-noted";

/**
 * Did the memo SAY what was wrong with the data?
 *
 * The user asked to be told what looks off, and for a reorder they have
 * to sign off on, a silently-corrected number is worth less than a
 * flagged one: next quarter the same teams will file the same way.
 *
 * Separate from `totals-correct` on purpose. Quietly fixing the data and
 * reporting a right number is a different behaviour from noticing the
 * data is broken, and only one of them tells the user anything.
 *
 * `team-09` also matches a bare `09`-suffixed mention like "team 09", and
 * the mL flag counts if the memo mentions the unit mismatch at all.
 */
export default async function scoreTrapsNoted(
  input: MetricInput,
): Promise<MetricResult> {
  const read = await readDeliverable(METRIC_NAME, input.runId, TOTALS_PATH, {
    noun: "memo",
  });
  if (!read.ok) return read.result;
  const memo = read.content;

  const lower = memo.toLowerCase();
  const duplicateNoted = lower.includes(DUPLICATE_SAMPLE_ID.toLowerCase());
  const unitNoted =
    /team[-\s]?0?9\b/.test(lower) ||
    (lower.includes("ml") && /unit|convert|millilit/.test(lower));

  const checks = { duplicateNoted, unitNoted };
  const passed = Object.values(checks).filter(Boolean).length;
  const missed: string[] = [];
  if (!duplicateNoted) missed.push(`the duplicated ${DUPLICATE_SAMPLE_ID}`);
  if (!unitNoted) missed.push(`${MISMATCHED_UNIT_TEAM}'s mL units`);

  return {
    name: METRIC_NAME,
    score: passed / 2,
    reason:
      missed.length === 0
        ? "Memo flags both the duplicated sample and the mL/µL mismatch."
        : `Memo does not mention ${missed.join(" or ")}.`,
    metadata: checks,
  };
}
