import { mentionsStandaloneNumber } from "../../../../../src/lib/common-metrics/number-mention";
import {
  classifyScopeMentions,
  wholeTokenPattern,
  type ScopeMention,
} from "../../../../../src/lib/common-metrics/scope-mentions";
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
 * (95s)" but not inside `billing-api-v2` or `oauth-api` — the same
 * boundary `classifyScopeMentions` uses under `wholeToken`.
 */
function mentionsName(text: string, name: string): boolean {
  return wholeTokenPattern(name).test(text);
}

/** A count as its own number: `14` in "14 services" but not in `140`. */
function mentionsCount(text: string, value: number): boolean {
  return mentionsStandaloneNumber(text, value);
}

/**
 * A stated seconds value at or under the scenario's 30s threshold
 * (constants.ts documents the cutoff; the shared cue list above spells
 * it "30-?s" the same way): an integer 0–30, digit-bounded so `95s` and
 * `300s` cannot ride the cue. Keeps the value-stating cues below from
 * clearing a WRONG membership claim — "resolves to 95s, exceeding the
 * threshold" is a false positive, not an exclusion explained.
 */
const AT_OR_UNDER_THRESHOLD = "(?:[12]?\\d|30)(?!\\d)";

/**
 * Exclusion framing in this scenario's own vocabulary, OR'd into the
 * shared cue list (`scope-mentions.ts`). The fixtures deliberately plant
 * profiles-api as a looks-big-resolves-under near-miss, so the BEST
 * answers say things like "profiles-api resolves to 20s and stays under
 * the threshold" — naming it to show the work, not misreporting it. The
 * value-stating cues only clear a value at or under the threshold: a
 * stated over-threshold value is a claim, whatever verb carries it.
 */
const UNDER_THRESHOLD_FRAMING = [
  "stays? under",
  "staying under",
  "remains? under",
  "(?:under|below|within) (?:the |its )?(?:30-?s\\w* )?(?:threshold|limit|cutoff)",
  "(?:under|below|at or under) 30",
  "less than 30",
  "not (?:over|above) (?:the )?(?:threshold|30)",
  "does(?:n't| not) exceed",
  `resolves? to ${AT_OR_UNDER_THRESHOLD}\\s*s\\w*`,
  `effective(?:ly)? ${AT_OR_UNDER_THRESHOLD}\\s*s\\w*`,
];

export interface SurveyGrade {
  /** Over-threshold services the answer names (correct memberships). */
  reported: string[];
  /** Over-threshold services the answer fails to name. */
  missing: string[];
  /** Under-threshold services the answer CLAIMS are over — uncleared. */
  falsePositives: string[];
  /**
   * Under-threshold services the answer names only to explain their
   * exclusion ("resolves to 20s and stays under"). Reported, not
   * penalised — the mention-versus-claim distinction
   * `classifyScopeMentions` exists for.
   */
  explanatoryMentions: ScopeMention[];
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
 * CLAIMED grows the denominator — a false positive costs, it doesn't
 * just fail to help. Getting the set exactly right requires resolving
 * both planted traps (the three in-file overrides and the shared
 * constants), so this is the metric they bite on.
 *
 * A mention is only a false positive when it lacks exclusion framing
 * (`classifyScopeMentions` with this scenario's own cues): "profiles-api
 * resolves to 20s and stays under" is the best answer showing its work,
 * not a wrong membership. Explanatory mentions land in
 * `explanatoryMentions`, unpenalised.
 *
 * The counts are reported, not scored: the set already carries the
 * arithmetic, and `statesNaiveCount` flags the recognisable
 * traps-missed answer for the report to aggregate on.
 */
export function gradeSurvey(answer: string): SurveyGrade {
  const expected = Object.keys(SERVICES_OVER_THRESHOLD);
  const reported = expected.filter((name) => mentionsName(answer, name));
  const missing = expected.filter((name) => !reported.includes(name));
  const underMentions = classifyScopeMentions(
    answer,
    SERVICES_UNDER_THRESHOLD,
    { wholeToken: true, extraExclusionCues: UNDER_THRESHOLD_FRAMING },
  );
  return {
    reported,
    missing,
    falsePositives: underMentions.reported,
    explanatoryMentions: underMentions.mentions.filter(
      (mention) => !mention.finding,
    ),
    score: reported.length / (expected.length + underMentions.reported.length),
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
      // Under-threshold services named WITH exclusion framing — the
      // near-miss explained, not misreported. Recorded, never penalised.
      explanatoryMentions: grade.explanatoryMentions,
      statesExpectedCount: grade.statesExpectedCount,
      // The trap tell — an answer counting exactly what the top-of-file
      // literals say. Reported for aggregation, not scored on its own.
      statesNaiveCount: grade.statesNaiveCount,
    },
  };
}
