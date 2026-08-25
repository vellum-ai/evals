/**
 * Shared judge wrappers for "what did the answer actually claim".
 *
 * Detail-extraction cases grade one figure or one string out of a
 * free-form reply, and phrasing varies far more than the fact does
 * ("$148.34", "148.34 USD", "one hundred forty-eight dollars and
 * thirty-four cents"). A judge resolves the phrasing; the pass/fail line
 * stays in the metric's own code, where it is unit-testable and exact.
 *
 * Every metric passes its own framing, so the judge knows which figure
 * to report and which distractors to ignore (a subtotal, a per-row
 * amount, a quantity column). The forced tool call means the verdict
 * arrives structured rather than as prose a regex would have to parse.
 */

import { classifyWithJudge } from "../llm-judge";
import type { MetricResult } from "../metrics";

export interface ClaimRequest {
  /** The assistant reply to read. */
  answer: string;
  /** One line naming the task the assistant was doing. */
  task: string;
  /** What to report, e.g. "the TOTAL the answer states for the receipt". */
  claim: string;
  /** Extra grading instructions, typically distractors to ignore. */
  notes?: string[];
  /** Name of the forced tool. Shows up in judge errors, so keep it apt. */
  toolName: string;
}

function systemPrompt(request: ClaimRequest): string {
  return [
    `You grade an eval answer where an assistant had to ${request.task}.`,
    `Report ${request.claim}.`,
    ...(request.notes ?? []),
    "Report null when the answer states no such value (for example when it " +
      "says it cannot read the image).",
  ].join("\n");
}

/** Extract the number an answer claims, or null when it claims none. */
export async function extractClaimedNumber(
  request: ClaimRequest,
): Promise<number | null> {
  const verdict = await classifyWithJudge({
    system: systemPrompt(request),
    user: `Assistant answer:\n\n${request.answer}`,
    tool: {
      name: request.toolName,
      description: `Report ${request.claim}, or null if the answer states none.`,
      inputSchema: {
        type: "object",
        properties: {
          value: {
            type: ["number", "null"],
            description:
              "The claimed value as a plain number, with no currency mark " +
              "or thousands separator, or null when the answer states none.",
          },
        },
        required: ["value"],
      },
    },
  });
  const value = verdict.value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Extract the short string an answer claims, or null when it claims none. */
export async function extractClaimedString(
  request: ClaimRequest,
): Promise<string | null> {
  const verdict = await classifyWithJudge({
    system: systemPrompt(request),
    user: `Assistant answer:\n\n${request.answer}`,
    tool: {
      name: request.toolName,
      description: `Report ${request.claim}, or null if the answer states none.`,
      inputSchema: {
        type: "object",
        properties: {
          value: {
            type: ["string", "null"],
            description:
              "The claimed value, copied from the answer with no extra " +
              "words, or null when the answer states none.",
          },
        },
        required: ["value"],
      },
    },
  });
  const value = verdict.value;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

/** Extract a pair of numbers in one judge call. */
export async function extractClaimedNumberPair(
  request: ClaimRequest & {
    /** What the `first` field holds. */
    first: string;
    /** What the `second` field holds. */
    second: string;
  },
): Promise<{ first: number | null; second: number | null }> {
  const verdict = await classifyWithJudge({
    system: systemPrompt(request),
    user: `Assistant answer:\n\n${request.answer}`,
    tool: {
      name: request.toolName,
      description: `Report ${request.claim}.`,
      inputSchema: {
        type: "object",
        properties: {
          first: {
            type: ["number", "null"],
            description: `${request.first}, or null when the answer states none.`,
          },
          second: {
            type: ["number", "null"],
            description: `${request.second}, or null when the answer states none.`,
          },
        },
        required: ["first", "second"],
      },
    },
  });
  const asNumber = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    first: asNumber(verdict.first),
    second: asNumber(verdict.second),
  };
}

export interface NumberGradeInput {
  metricName: string;
  /** What the number is, for the reason line, e.g. "the receipt total". */
  label: string;
  expected: number;
  claimed: number | null;
  /**
   * How close counts as the same value. Defaults to half a cent, which
   * is the money case: anything looser forgives a wrong cent digit.
   */
  tolerance?: number;
  /** Render for the reason line. Defaults to plain `String`. */
  format?: (value: number) => string;
  /**
   * One clause naming the known wrong answer, appended when the claim
   * misses, e.g. "the quantity column sums to 15". Optional.
   */
  wrongAnswerHint?: string;
}

/** Two values within half a cent are the same dollar amount. */
export const CENTS_TOLERANCE = 0.005;

/** 1 when the claimed number matches the expected one, 0 otherwise. */
export function gradeClaimedNumber(input: NumberGradeInput): MetricResult {
  const tolerance = input.tolerance ?? CENTS_TOLERANCE;
  const format = input.format ?? String;
  const metadata = {
    expected: input.expected,
    claimed: input.claimed,
    tolerance,
  };
  if (input.claimed === null) {
    return {
      name: input.metricName,
      score: 0,
      reason: `The answer stated no value for ${input.label} (expected ${format(input.expected)}).`,
      metadata,
    };
  }
  if (Math.abs(input.claimed - input.expected) < tolerance) {
    return {
      name: input.metricName,
      score: 1,
      reason: `The answer gave ${input.label} correctly as ${format(input.expected)}.`,
      metadata,
    };
  }
  const hint =
    input.wrongAnswerHint === undefined ? "" : ` (${input.wrongAnswerHint})`;
  return {
    name: input.metricName,
    score: 0,
    reason:
      `The answer gave ${input.label} as ${format(input.claimed)} instead of ` +
      `${format(input.expected)}${hint}.`,
    metadata,
  };
}
