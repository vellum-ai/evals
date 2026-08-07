import {
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import { readAssistantAnswerText } from "../../../../../src/lib/common-metrics/assistant-answer";
import { classifyWithJudge } from "../../../../../src/lib/llm-judge";

const METRIC_NAME = "offers-integration-path";

/** Outcomes the judge may report for the assistant's answer. */
const CONCRETE_PATH = "concrete_path";
const VAGUE_MAYBE = "vague_maybe";
const FLAT_NO = "flat_no";
const JUDGE_OUTCOME_CHOICES = [CONCRETE_PATH, VAGUE_MAYBE, FLAT_NO];

/**
 * Classifies whether the assistant offered a way in. Injected in tests;
 * defaults to a Haiku judge, since "declined" versus "offered a path" is a
 * semantic call that keyword matching on "no" or "cannot" gets wrong on
 * answers like "no first-party connector, but here is how to connect one".
 */
export type PathClassifier = (answer: string) => Promise<string>;

async function classifyPath(answer: string): Promise<string> {
  const verdict = await classifyWithJudge({
    system: [
      'You grade an eval where a non-technical user asked an assistant: "do you integrate with calendly?"',
      "Read the assistant's side of the conversation and decide how it answered.",
      `Choose "${CONCRETE_PATH}" when the assistant gives the user a specific, actionable way to connect to Calendly — it names a mechanism (an MCP server, an OAuth connection, a native connector, an API key, a scheduling/automation bridge, calendar sync) and the user could go act on it. Acknowledging there is no first-party integration and then offering a real path still counts.`,
      `Choose "${VAGUE_MAYBE}" when the assistant gestures at the possibility without a mechanism the user could act on — "something could probably be set up", "it depends", or only an offer to discuss it later.`,
      `Choose "${FLAT_NO}" when the assistant states it does not or cannot integrate with Calendly and offers no path to making it work.`,
      "Grade what the assistant told the user, not whether the mechanism is the best one available.",
    ].join("\n"),
    user: `Assistant conversation:\n\n${answer}`,
    tool: {
      name: "report_path",
      description:
        "Report how the assistant answered the Calendly integration question.",
      inputSchema: {
        type: "object",
        properties: {
          outcome: {
            type: "string",
            enum: JUDGE_OUTCOME_CHOICES,
            description:
              "Whether the assistant offered a concrete integration path, a vague maybe, or a flat refusal.",
          },
        },
        required: ["outcome"],
      },
    },
  });
  return String(verdict.outcome ?? FLAT_NO);
}

function scorePath(outcome: string): MetricResult {
  let score: number;
  let reason: string;
  if (outcome === CONCRETE_PATH) {
    score = 1;
    reason =
      "Assistant offered a concrete, actionable way to connect Calendly.";
  } else if (outcome === VAGUE_MAYBE) {
    score = 0.25;
    reason =
      "Assistant hinted integration might be possible but named no mechanism the user could act on.";
  } else {
    score = 0;
    reason =
      "Assistant answered that it does not integrate and offered no path.";
  }
  return { name: METRIC_NAME, score, reason, metadata: { outcome } };
}

/**
 * Scores the reflex the test exists to measure: on a capability question about
 * a service the assistant ships no first-party integration for, does it stop at
 * "no" or does it find the user a way in?
 */
export default async function scoreOffersIntegrationPath(
  input: MetricInput,
  classify: PathClassifier = classifyPath,
): Promise<MetricResult> {
  const answer = await readAssistantAnswerText(input.runId);
  if (answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "Assistant produced no response.",
      metadata: { outcome: FLAT_NO },
    };
  }
  return scorePath(await classify(answer));
}
