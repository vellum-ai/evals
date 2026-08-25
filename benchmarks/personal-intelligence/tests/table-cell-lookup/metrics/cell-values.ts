import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAnswerTextForGrading } from "../../../../../src/lib/common-metrics/assistant-answer";
import { extractClaimedNumberPair } from "../../../../../src/lib/common-metrics/claim-extraction";
import {
  CELL_TOLERANCE,
  TABLE_DECIMAL_CELL,
  TABLE_NEGATIVE_CELL,
} from "../constants";

const METRIC_NAME = "cell-values";

export interface ClaimedCells {
  /** What the answer gave for the negative cell (South Q2). */
  negative: number | null;
  /** What the answer gave for the decimal cell (West Q3). */
  decimal: number | null;
}

/** Extracts both claimed cells from an answer. Injected in tests. */
export type CellExtractor = (answer: string) => Promise<ClaimedCells>;

function matches(claimed: number | null, expected: number): boolean {
  return claimed !== null && Math.abs(claimed - expected) < CELL_TOLERANCE;
}

function describe(cell: {
  region: string;
  column: string;
  value: number;
}): string {
  return `${cell.region} ${cell.column} (${cell.value.toFixed(2)})`;
}

/**
 * The pure half: both cells right scores 1, one right scores 0.5, none
 * scores 0.
 *
 * Half credit is deliberate. The two cells fail in different ways (a
 * dropped minus sign and a rounded decimal), and a run that reads one
 * correctly has demonstrably reached the table, which is worth
 * distinguishing from a run that read nothing.
 */
export function gradeClaimedCells(claimed: ClaimedCells): MetricResult {
  const negativeCorrect = matches(claimed.negative, TABLE_NEGATIVE_CELL.value);
  const decimalCorrect = matches(claimed.decimal, TABLE_DECIMAL_CELL.value);
  const correctCount = Number(negativeCorrect) + Number(decimalCorrect);
  const wrong: string[] = [];
  if (!negativeCorrect) {
    wrong.push(
      `${describe(TABLE_NEGATIVE_CELL)} came back as ${claimed.negative ?? "no figure"}`,
    );
  }
  if (!decimalCorrect) {
    wrong.push(
      `${describe(TABLE_DECIMAL_CELL)} came back as ${claimed.decimal ?? "no figure"}`,
    );
  }
  return {
    name: METRIC_NAME,
    score: correctCount / 2,
    reason:
      correctCount === 2
        ? `Both asked cells were read exactly: ${describe(TABLE_NEGATIVE_CELL)} and ${describe(TABLE_DECIMAL_CELL)}.`
        : `${correctCount} of 2 asked cells were read exactly. ${wrong.join("; ")}.`,
    metadata: {
      expectedNegative: TABLE_NEGATIVE_CELL,
      expectedDecimal: TABLE_DECIMAL_CELL,
      claimedNegative: claimed.negative,
      claimedDecimal: claimed.decimal,
      negativeCorrect,
      decimalCorrect,
    },
  };
}

async function extractCells(answer: string): Promise<ClaimedCells> {
  const pair = await extractClaimedNumberPair({
    answer,
    task: "read two named cells out of a screenshotted revenue table",
    claim: "the two cell figures the answer states",
    first: `The figure the answer gives for ${TABLE_NEGATIVE_CELL.region} ${TABLE_NEGATIVE_CELL.column}, with its sign`,
    second: `The figure the answer gives for ${TABLE_DECIMAL_CELL.region} ${TABLE_DECIMAL_CELL.column}, with its decimals`,
    notes: [
      "Report the numbers exactly as the answer presents them, keeping any " +
        "minus sign and any decimal part, without a currency mark or " +
        "thousands separator.",
    ],
    toolName: "report_claimed_cells",
  });
  return { negative: pair.first, decimal: pair.second };
}

/** Scores whether the assistant read both asked cells exactly. */
export default async function scoreCellValues(
  input: MetricInput,
  extract: CellExtractor = extractCells,
): Promise<MetricResult> {
  const answer = await readAnswerTextForGrading(input.runId);
  if (answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "The assistant produced no answer.",
      metadata: { claimedNegative: null, claimedDecimal: null },
    };
  }
  return gradeClaimedCells(await extract(answer));
}
