/**
 * DIAGNOSTIC metric: how the run reached the pixels of an image.
 *
 * Not a pass/fail axis. A run that answers well without ever calling
 * `image_ask` is not worse than one that calls it five times, and the
 * reverse is equally true. Which of those two shapes wins is exactly
 * the question the caption-versus-handle-only comparison exists to
 * answer. So the score carries only "did this run produce an answer at
 * all", and the signal lives entirely in the metadata: the `image_ask`
 * call count, the broader vision-tool count, the questions asked, and
 * which images they targeted. Read it next to the accuracy metrics on
 * the same run, never on its own.
 *
 * `image_ask` is the turn-scoped tool the image-fallback plugin exposes
 * when the active model is text-only: the main model asks a vision
 * profile a specific question about one staged image. Under
 * `imageFallback.captionMode = caption` every image is described up
 * front and the tool is optional; under `handle-only` the image reaches
 * the model as a marker and the tool is the only way to see it.
 *
 * Pure policy over `AgentEvent[]`, so it is unit-testable without
 * Docker. Calls are read through {@link readToolCalls}, which unwraps
 * the `skill_execute` dispatch envelope. A metric that greps for the
 * `image_ask` tool name alone reports a confident zero on a run that
 * dispatched it through a skill.
 */

import type { AgentEvent } from "../adapter";
import {
  hasAssistantResponse,
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../metrics";
import { readToolCalls, type ToolCall } from "./tool-activity";

const METRIC_NAME = "image-ask-usage";

/** The turn-scoped tool the image-fallback plugin registers. */
export const IMAGE_ASK_TOOL = "image_ask";

/**
 * Deliberately loose: any tool whose name mentions an image, vision, or
 * a caption counts toward the broad total. A sibling or renamed vision
 * tool then still shows up in the diagnostic instead of vanishing from
 * it, and the exact tally of names is reported alongside the number so a
 * reader can see what was counted.
 */
const VISION_TOOL_PATTERN = /image|vision|caption/i;

/** How long an asked question is kept in the metadata. */
const QUESTION_PREVIEW_CHARS = 200;

export interface ImageAskUsage {
  /** Calls to {@link IMAGE_ASK_TOOL}, in stream order. */
  imageAskCalls: ToolCall[];
  /** Every call whose tool name mentions image/vision/caption. */
  visionToolCalls: ToolCall[];
  /** Call count per vision-ish tool name. */
  visionToolCounts: Record<string, number>;
  /** The question each `image_ask` asked, truncated for the report. */
  questions: string[];
  /** The image each `image_ask` named, in call order. */
  targets: string[];
  /** How many `image_ask` calls came back as errors. */
  errorCount: number;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/** Read the image-inspection activity out of an agent event stream. */
export function readImageAskUsage(events: AgentEvent[]): ImageAskUsage {
  const calls = readToolCalls(events);
  const imageAskCalls = calls.filter((call) => call.name === IMAGE_ASK_TOOL);
  const visionToolCalls = calls.filter((call) =>
    VISION_TOOL_PATTERN.test(call.name),
  );
  const visionToolCounts: Record<string, number> = {};
  for (const call of visionToolCalls) {
    visionToolCounts[call.name] = (visionToolCounts[call.name] ?? 0) + 1;
  }
  return {
    imageAskCalls,
    visionToolCalls,
    visionToolCounts,
    questions: imageAskCalls.map((call) =>
      (
        readString(call.input.question) ??
        readString(call.input.prompt) ??
        ""
      ).slice(0, QUESTION_PREVIEW_CHARS),
    ),
    targets: imageAskCalls.map(
      (call) =>
        readString(call.input.path) ??
        readString(call.input.image) ??
        readString(call.input.file_path) ??
        "",
    ),
    errorCount: imageAskCalls.filter((call) => call.isError === true).length,
  };
}

/**
 * Score 1 when the run produced an answer to grade, 0 when it produced
 * none. See the module doc: the number that matters is in the metadata,
 * not in the score.
 */
export function gradeImageAskUsage(
  events: AgentEvent[],
  answerProduced: boolean,
): MetricResult {
  const usage = readImageAskUsage(events);
  const metadata = {
    imageAskCallCount: usage.imageAskCalls.length,
    visionToolCallCount: usage.visionToolCalls.length,
    visionToolCounts: usage.visionToolCounts,
    imageAskQuestions: usage.questions,
    imageAskTargets: usage.targets,
    imageAskErrorCount: usage.errorCount,
    diagnostic: true,
  };
  if (!answerProduced) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "The run produced no assistant response, so there is no answer to " +
        "attribute the image-inspection activity to.",
      metadata,
    };
  }
  return {
    name: METRIC_NAME,
    score: 1,
    reason:
      `The run answered after ${usage.imageAskCalls.length} ${IMAGE_ASK_TOOL} ` +
      `call(s) and ${usage.visionToolCalls.length} image-related tool call(s) ` +
      "in total. Diagnostic only: read the counts next to the accuracy " +
      "metrics on this run.",
    metadata,
  };
}

/** See {@link gradeImageAskUsage}. */
export default async function scoreImageAskUsage(
  input: MetricInput,
): Promise<MetricResult> {
  const [events, answered] = await Promise.all([
    readAssistantEvents(input.runId),
    hasAssistantResponse(input.runId),
  ]);
  return gradeImageAskUsage(events, answered);
}
