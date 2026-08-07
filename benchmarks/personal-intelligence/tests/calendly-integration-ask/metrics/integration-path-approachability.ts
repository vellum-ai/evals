import {
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import { readAssistantAnswerText } from "../../../../../src/lib/common-metrics/assistant-answer";
import { classifyWithJudge } from "../../../../../src/lib/llm-judge";

const METRIC_NAME = "integration-path-approachability";

/** Mechanisms the judge may report, ordered from friendliest to none. */
const MCP = "mcp";
const OAUTH = "oauth";
const OTHER_WORKABLE = "other_workable";
const API_KEY_ONLY = "api_key_only";
const NONE = "none";
const JUDGE_MECHANISM_CHOICES = [
  MCP,
  OAUTH,
  OTHER_WORKABLE,
  API_KEY_ONLY,
  NONE,
];

/**
 * How approachable each mechanism is for the non-technical user the SPEC
 * simulates. MCP, OAuth, and any other genuinely workable route all score
 * full marks. An API-key-only answer is docked marginally rather than
 * failed: it works, but it makes the user go mint and paste a secret when
 * friendlier options exist.
 */
const MECHANISM_SCORES: Record<string, number> = {
  [MCP]: 1,
  [OAUTH]: 1,
  [OTHER_WORKABLE]: 1,
  [API_KEY_ONLY]: 0.75,
  [NONE]: 0,
};

/** Classifies the friendliest mechanism offered. Injected in tests. */
export type MechanismClassifier = (answer: string) => Promise<string>;

async function classifyMechanism(answer: string): Promise<string> {
  const verdict = await classifyWithJudge({
    system: [
      'You grade an eval where a non-technical user asked an assistant: "do you integrate with calendly?"',
      "Read the assistant's side of the conversation and report the friendliest integration mechanism it actually offered the user.",
      `Choose "${MCP}" if it offers to connect through an MCP server / MCP connector for Calendly.`,
      `Choose "${OAUTH}" if it offers an OAuth or "sign in with your Calendly account" style connection, with no MCP option offered.`,
      `Choose "${OTHER_WORKABLE}" if the friendliest option is some other genuinely workable route — a native/built-in connector, a Zapier-or-similar automation bridge, or syncing Calendly events through a connected calendar.`,
      `Choose "${API_KEY_ONLY}" if the only route it offers requires the user to generate a Calendly API key / personal access token and hand it over.`,
      `Choose "${NONE}" if it offers no workable mechanism at all.`,
      "If several mechanisms are offered, report the friendliest one for a non-technical user, using the order above.",
      "Report only mechanisms actually offered as a way to connect. A mechanism named while explaining why it will not work does not count.",
    ].join("\n"),
    user: `Assistant conversation:\n\n${answer}`,
    tool: {
      name: "report_mechanism",
      description:
        "Report the friendliest Calendly integration mechanism the assistant offered.",
      inputSchema: {
        type: "object",
        properties: {
          mechanism: {
            type: "string",
            enum: JUDGE_MECHANISM_CHOICES,
            description:
              "The friendliest integration mechanism the assistant actually offered.",
          },
        },
        required: ["mechanism"],
      },
    },
  });
  return String(verdict.mechanism ?? NONE);
}

function scoreMechanism(mechanism: string): MetricResult {
  const score = MECHANISM_SCORES[mechanism] ?? 0;
  let reason: string;
  if (mechanism === API_KEY_ONLY) {
    reason =
      "Assistant offered only an API-key route; workable, but more friction than an MCP or OAuth connection.";
  } else if (mechanism === NONE) {
    reason = "Assistant offered no workable integration mechanism.";
  } else {
    reason = `Assistant offered a non-technical-friendly route (${mechanism}).`;
  }
  return { name: METRIC_NAME, score, reason, metadata: { mechanism } };
}

/**
 * Scores how approachable the offered integration route is, given that the
 * user asking is non-technical. Separate from `offers-integration-path` so a
 * run that answers well but routes the user through a raw API key is visibly
 * docked without collapsing into the same number as a flat refusal.
 */
export default async function scoreIntegrationPathApproachability(
  input: MetricInput,
  classify: MechanismClassifier = classifyMechanism,
): Promise<MetricResult> {
  const answer = await readAssistantAnswerText(input.runId);
  if (answer.trim() === "") {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "Assistant produced no response.",
      metadata: { mechanism: NONE },
    };
  }
  return scoreMechanism(await classify(answer));
}
