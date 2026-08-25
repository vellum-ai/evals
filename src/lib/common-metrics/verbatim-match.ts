/**
 * Shared policy for "did the answer reproduce this string exactly".
 *
 * Verbatim cases grade transcription, not comprehension: a version
 * string, an axis label, an address. The only latitude allowed is
 * whitespace, because a reply may wrap a line or pad a table cell where
 * the image had a single space. Case is latitude only where the string
 * itself is case-insensitive in the world (an email address); on a build
 * number it is part of the fact.
 *
 * Pure string policy, so it is unit-testable without a network or a
 * judge. For a verbatim claim, a judge would only add variance.
 */

import type { MetricResult } from "../metrics";

/** Collapse every whitespace run to one space and trim the ends. */
export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

export interface VerbatimMatch {
  /** The expected string appears, whitespace collapsed on both sides. */
  matched: boolean;
  /**
   * It appears when case is ignored too. Equal to `matched` for a
   * case-insensitive comparison; a `true` here with `matched: false` is
   * the near miss worth seeing in the report: the agent read the string
   * but re-cased it.
   */
  matchedIgnoringCase: boolean;
}

/** Whether `answer` reproduces `expected`. */
export function matchVerbatim(
  answer: string,
  expected: string,
  opts?: { caseSensitive?: boolean },
): VerbatimMatch {
  const haystack = collapseWhitespace(answer);
  const needle = collapseWhitespace(expected);
  const matchedIgnoringCase = haystack
    .toLowerCase()
    .includes(needle.toLowerCase());
  const caseSensitive = opts?.caseSensitive ?? true;
  return {
    matched: caseSensitive ? haystack.includes(needle) : matchedIgnoringCase,
    matchedIgnoringCase,
  };
}

export interface VerbatimGradeInput {
  metricName: string;
  /** What the string is, for the reason line, e.g. "the version string". */
  label: string;
  expected: string;
  answer: string;
  /** Defaults to true. Set false for strings that are case-insensitive. */
  caseSensitive?: boolean;
}

/** 1 when the answer reproduces the expected string, 0 otherwise. */
export function gradeVerbatimMention(input: VerbatimGradeInput): MetricResult {
  const caseSensitive = input.caseSensitive ?? true;
  const match = matchVerbatim(input.answer, input.expected, { caseSensitive });
  const metadata = {
    expected: input.expected,
    matched: match.matched,
    matchedIgnoringCase: match.matchedIgnoringCase,
    caseSensitive,
  };
  if (match.matched) {
    return {
      name: input.metricName,
      score: 1,
      reason: `The answer reproduced ${input.label} exactly ("${input.expected}").`,
      metadata,
    };
  }
  if (match.matchedIgnoringCase) {
    return {
      name: input.metricName,
      score: 0,
      reason:
        `The answer carried ${input.label} but re-cased it, so it is not ` +
        `what the image shows ("${input.expected}").`,
      metadata,
    };
  }
  return {
    name: input.metricName,
    score: 0,
    reason: `The answer never reproduced ${input.label} ("${input.expected}").`,
    metadata,
  };
}
