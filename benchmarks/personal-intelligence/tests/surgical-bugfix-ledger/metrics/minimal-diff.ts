import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import { EXPECTED_CHANGED_LINES, TARGET_FILE } from "../constants";

const METRIC_NAME = "minimal-diff";

/** Changed lines may land this many lines away from an expected line. */
const SLACK_LINES = 2;

/** Score reaches 0 once this many unrelated lines have churned. */
const CHURN_ZERO_AT = 50;

export interface LineDiffGrade {
  score: number;
  /** Lines changed — max of the before/after regions (insertions count). */
  changedLineCount: number;
  /** 1-based line numbers of the changed region, in the BEFORE file. */
  changedLines: number[];
  /** Changed lines outside every expected line's ± slack window. */
  unrelatedChangedLines: number[];
  /** What the score decays on: unrelated lines plus net inserted lines. */
  unrelatedChurn: number;
}

/**
 * Grade how far a file drifted from its staged baseline, against the
 * line numbers the intended fix should touch.
 *
 * The diff is positional: strip the common prefix and suffix, and the
 * remaining middle is the changed region. A single edit (this case's
 * intended fix) is located exactly; multiple scattered edits get
 * bridged into one region that includes the untouched lines between
 * them, which *overstates* churn — acceptable here, because the
 * intended fix is one line and anything beyond it is churn by
 * definition. A pure insertion attributes to the line at the insertion
 * point and its inserted lines count toward churn.
 *
 * Scoring: 1 when every changed line sits within ± `SLACK_LINES` of an
 * expected line and no net lines were added; otherwise the score
 * declines linearly with the unrelated-churn count, reaching 0 at
 * `CHURN_ZERO_AT` — so a stray touched line costs little while a
 * wholesale regeneration of the file lands at 0 even if the fix line
 * itself is correct.
 */
export function gradeLineDiff(
  before: string,
  after: string,
  expectedChangedLines: number[],
): LineDiffGrade {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");

  let start = 0;
  while (
    start < beforeLines.length &&
    start < afterLines.length &&
    beforeLines[start] === afterLines[start]
  ) {
    start += 1;
  }
  let beforeEnd = beforeLines.length;
  let afterEnd = afterLines.length;
  while (
    beforeEnd > start &&
    afterEnd > start &&
    beforeLines[beforeEnd - 1] === afterLines[afterEnd - 1]
  ) {
    beforeEnd -= 1;
    afterEnd -= 1;
  }

  const beforeRegion = beforeEnd - start;
  const afterRegion = afterEnd - start;
  const changedLineCount = Math.max(beforeRegion, afterRegion);
  const changedLines =
    beforeRegion > 0
      ? Array.from({ length: beforeRegion }, (_, i) => start + 1 + i)
      : changedLineCount > 0
        ? [Math.min(start + 1, beforeLines.length)]
        : [];

  const allowed = new Set(
    expectedChangedLines.flatMap((line) =>
      Array.from(
        { length: SLACK_LINES * 2 + 1 },
        (_, i) => line - SLACK_LINES + i,
      ),
    ),
  );
  const unrelatedChangedLines = changedLines.filter(
    (line) => !allowed.has(line),
  );
  const insertedExcess = Math.max(0, afterRegion - beforeRegion);
  const unrelatedChurn = unrelatedChangedLines.length + insertedExcess;

  return {
    score:
      changedLineCount === 0
        ? 0
        : Math.max(0, 1 - unrelatedChurn / CHURN_ZERO_AT),
    changedLineCount,
    changedLines,
    unrelatedChangedLines,
    unrelatedChurn,
  };
}

/** The staged buggy ledger, the diff baseline. */
const BUGGY_FIXTURE = readFileSync(
  join(import.meta.dir, "..", "assets", "project", "src", "ledger.ts"),
  "utf8",
);

/**
 * How much of the target file churned beyond the intended one-line fix?
 * Reads the post-run `src/ledger.ts` out of the still-live container and
 * grades its line diff against the staged buggy fixture — see
 * {@link gradeLineDiff}. Complements `patch-not-rewrite`: that metric
 * classifies the *tool* used, this one measures the resulting bytes (a
 * `file_edit` that replaced the entire body still shows up here).
 */
export default async function scoreMinimalDiff(
  input: MetricInput,
): Promise<MetricResult> {
  let after: string | undefined;
  try {
    after = await readAssistantWorkspaceFile(input.runId, TARGET_FILE);
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) throw err;
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: `Assistant container not inspectable (non-vellum species?); cannot read the post-run ${TARGET_FILE}.`,
    };
  }
  if (after === undefined) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `${TARGET_FILE} no longer exists in the workspace — the staged file was deleted or moved.`,
      metadata: { targetMissing: true },
    };
  }

  const grade = gradeLineDiff(BUGGY_FIXTURE, after, EXPECTED_CHANGED_LINES);
  if (grade.changedLineCount === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: `${TARGET_FILE} is byte-identical to the staged fixture — nothing was changed, so there is no diff to grade.`,
      metadata: { changedLineCount: 0 },
    };
  }
  return {
    name: METRIC_NAME,
    score: grade.score,
    reason:
      grade.score === 1
        ? `Changed ${grade.changedLineCount} line(s), all within ±${SLACK_LINES} of the intended fix (line ${EXPECTED_CHANGED_LINES.join(", ")}).`
        : `Changed ${grade.changedLineCount} line(s) with ${grade.unrelatedChurn} line(s) of churn beyond the intended fix's ±${SLACK_LINES} window — unrelated churn degrades the score.`,
    metadata: {
      changedLineCount: grade.changedLineCount,
      changedLines: grade.changedLines.slice(0, 20),
      unrelatedChangedLines: grade.unrelatedChangedLines.slice(0, 20),
      unrelatedChurn: grade.unrelatedChurn,
      expectedChangedLines: EXPECTED_CHANGED_LINES,
    },
  };
}
