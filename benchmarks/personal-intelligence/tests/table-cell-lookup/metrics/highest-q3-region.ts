import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAnswerTextForGrading } from "../../../../../src/lib/common-metrics/assistant-answer";
import { extractClaimedString } from "../../../../../src/lib/common-metrics/claim-extraction";
import { HIGHEST_Q3_REGION, HIGHEST_Q3_VALUE } from "../constants";

const METRIC_NAME = "highest-q3-region";

/** Extracts the region an answer names. Injected in tests. */
export type RegionExtractor = (answer: string) => Promise<string | null>;

/**
 * The pure half: did the answer name the right region?
 *
 * Region names are single words the table prints in one case, so the
 * comparison folds case and trims but nothing else: "east", "East" and
 * "East " are the same answer, "East region" is not scored differently
 * because the extractor is asked for the name alone.
 */
export function gradeClaimedRegion(claimed: string | null): MetricResult {
  const normalized = claimed?.trim().toLowerCase() ?? null;
  const correct = normalized === HIGHEST_Q3_REGION.toLowerCase();
  const metadata = {
    expectedRegion: HIGHEST_Q3_REGION,
    expectedValue: HIGHEST_Q3_VALUE,
    claimedRegion: claimed,
  };
  if (correct) {
    return {
      name: METRIC_NAME,
      score: 1,
      reason: `The answer named ${HIGHEST_Q3_REGION}, whose Q3 figure (${HIGHEST_Q3_VALUE.toFixed(2)}) is the largest.`,
      metadata,
    };
  }
  if (claimed === null) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `The answer named no region for the highest Q3 (expected ${HIGHEST_Q3_REGION}).`,
      metadata,
    };
  }
  return {
    name: METRIC_NAME,
    score: 0,
    reason: `The answer named ${claimed} instead of ${HIGHEST_Q3_REGION} as the highest Q3.`,
    metadata,
  };
}

async function extractRegion(answer: string): Promise<string | null> {
  return extractClaimedString({
    answer,
    task: "find which region has the largest Q3 figure in a screenshotted table",
    claim: "the region the answer names as having the highest Q3 figure",
    notes: [
      "Report the region name alone, with no quarter, figure or extra words.",
    ],
    toolName: "report_claimed_region",
  });
}

/** Scores whether the assistant named the region with the highest Q3. */
export default async function scoreHighestQ3Region(
  input: MetricInput,
  extract: RegionExtractor = extractRegion,
): Promise<MetricResult> {
  const answer = await readAnswerTextForGrading(input.runId);
  if (answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "The assistant produced no answer.",
      metadata: { expectedRegion: HIGHEST_Q3_REGION, claimedRegion: null },
    };
  }
  return gradeClaimedRegion(await extract(answer));
}
