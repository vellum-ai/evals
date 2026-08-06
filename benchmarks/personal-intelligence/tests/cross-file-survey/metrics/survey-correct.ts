import {
  readAssistantEvents,
  readTranscript,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import { buildTranscriptView } from "../../../../../src/lib/transcript-view";
import {
  EXPECTED_COUNT,
  NAIVE_COUNT_IF_OVERRIDES_MISSED,
  SERVICES_OVER_THRESHOLD,
  SERVICES_UNDER_THRESHOLD,
} from "../constants";

const METRIC_NAME = "survey-correct";

/**
 * Matches a service name as its own token: `billing-api` in "billing-api
 * (95s)" but not inside `billing-api-v2` or `oauth-api`.
 */
function mentionsName(text: string, name: string): boolean {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?<![\\w-])${escaped}(?![\\w-])`, "i").test(text);
}

/** Matches a count as its own number: `14` in "14 services" but not in `140`. */
function mentionsCount(text: string, value: number): boolean {
  return new RegExp(`(?<![\\d.])${value}(?![\\d.])`).test(text);
}

export interface SurveyGrade {
  /** Over-threshold services the answer names (correct memberships). */
  reported: string[];
  /** Over-threshold services the answer fails to name. */
  missing: string[];
  /** Under-threshold services the answer names anyway. */
  falsePositives: string[];
  /** |reported ∩ expected| / |reported ∪ expected| — 1.0 on an exact set. */
  score: number;
  statesExpectedCount: boolean;
  /**
   * The trap tell: the answer carries 10, the count a pass that takes
   * every top-of-file literal at face value produces.
   */
  statesNaiveCount: boolean;
}

/**
 * The pure half of the metric: grade an answer's service set.
 *
 * Scored as set membership (Jaccard): exact set = 1.0, partial credit as
 * the fraction of correct memberships, and every under-threshold service
 * named grows the denominator — a false positive costs, it doesn't just
 * fail to help. Getting the set exactly right requires resolving both
 * planted traps (the three in-file overrides and the shared constants),
 * so this is the metric they bite on.
 *
 * The counts are reported, not scored: the set already carries the
 * arithmetic, and `statesNaiveCount` flags the recognisable
 * traps-missed answer for the report to aggregate on.
 */
export function gradeSurvey(answer: string): SurveyGrade {
  const expected = Object.keys(SERVICES_OVER_THRESHOLD);
  const reported = expected.filter((name) => mentionsName(answer, name));
  const missing = expected.filter((name) => !reported.includes(name));
  const falsePositives = SERVICES_UNDER_THRESHOLD.filter((name) =>
    mentionsName(answer, name),
  );
  return {
    reported,
    missing,
    falsePositives,
    score: reported.length / (expected.length + falsePositives.length),
    statesExpectedCount: mentionsCount(answer, EXPECTED_COUNT),
    statesNaiveCount: mentionsCount(answer, NAIVE_COUNT_IF_OVERRIDES_MISSED),
  };
}

/**
 * The assistant's answer message: the LAST assistant message that names
 * any known service. The Vellum stream lands one transcript turn per
 * text delta, so `buildTranscriptView` folds the fragments back into
 * whole messages first. Taking the last service-naming message skips a
 * trailing pleasantry ("glad that helped") without grading an early
 * in-passing mention as the answer.
 */
async function readSurveyAnswer(runId: string): Promise<string | undefined> {
  const [turns, events] = await Promise.all([
    readTranscript(runId),
    readAssistantEvents(runId),
  ]);
  const allNames = [
    ...Object.keys(SERVICES_OVER_THRESHOLD),
    ...SERVICES_UNDER_THRESHOLD,
  ];
  const messages = buildTranscriptView(turns, events)
    .filter((item) => item.role === "assistant")
    .map((item) =>
      item.blocks
        .filter((block) => block.kind === "text")
        .map((block) => block.text)
        .join(""),
    );
  const lastNaming = [...messages]
    .reverse()
    .find((text) => allNames.some((name) => mentionsName(text, name)));
  return lastNaming ?? messages.at(-1);
}

/** Is the reported over-threshold set right? See {@link gradeSurvey}. */
export default async function scoreSurveyCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  const answer = await readSurveyAnswer(input.runId);
  if (answer === undefined || answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "Assistant produced no answer turn.",
      metadata: { expected: SERVICES_OVER_THRESHOLD },
    };
  }

  const grade = gradeSurvey(answer);
  const exact = grade.missing.length === 0 && grade.falsePositives.length === 0;
  const trapHit = grade.statesNaiveCount && !grade.statesExpectedCount;
  return {
    name: METRIC_NAME,
    score: grade.score,
    reason: exact
      ? `Named exactly the ${EXPECTED_COUNT} services over the threshold.`
      : trapHit
        ? `Answer carries the naive count (${NAIVE_COUNT_IF_OVERRIDES_MISSED}) — the in-file overrides and shared constants were not resolved. Missing: ${grade.missing.join(", ")}.`
        : `Missing: ${grade.missing.join(", ") || "none"}; false positives: ${grade.falsePositives.join(", ") || "none"}.`,
    metadata: {
      expected: SERVICES_OVER_THRESHOLD,
      reported: grade.reported,
      missing: grade.missing,
      falsePositives: grade.falsePositives,
      statesExpectedCount: grade.statesExpectedCount,
      // The trap tell — an answer counting exactly what the top-of-file
      // literals say. Reported for aggregation, not scored on its own.
      statesNaiveCount: grade.statesNaiveCount,
    },
  };
}
