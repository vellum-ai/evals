/**
 * Shared scorer for "did the run execute the proven workspace script,
 * rather than re-deriving the procedure?" Used by the procedure-reuse
 * tests (podcast-publish-skill, fantasy-league-recap-recurring).
 *
 * Two pieces of evidence, combined on a ladder rather than summed:
 *
 *   1. Execution evidence — the script's distinctive success line (its
 *      own stdout, e.g. `wrote shownotes/ep018.md and feed entry …`)
 *      appears in a tool RESULT. Matching on tool *inputs* proved
 *      gameable twice in smoke runs: an agent that hand-wrote the
 *      deliverable still name-dropped the script in file writes, and a
 *      `cat > SKILL.md <<EOF` heredoc put an invocation-shaped mention
 *      inside a bash command. Only a real execution echoes the script's
 *      stdout back through a tool result.
 *   2. Output fingerprint — the deliverable in the assistant container
 *      carries the version marker the script stamps into everything it
 *      writes. On its own this is weak (smoke run 1 hand-copied the
 *      marker from prior outputs), so marker-without-execution earns
 *      only a residual score.
 *
 *   executed + marker = 1.0   executed only = 0.75
 *   marker only       = 0.25  neither       = 0
 */

import type { AgentEvent } from "../adapter";
import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../vellum-artifacts";

/**
 * True when `text` references the script as something to RUN — the
 * filename preceded (same line) by a runner, a `{baseDir}` placeholder,
 * or a path prefix — rather than merely mentioning it in prose. Used by
 * the skill metrics so "the old build_shownotes.ts approach, done by
 * hand:" cannot score as reuse.
 */
export function containsScriptInvocation(
  text: string,
  scriptFilename: string,
): boolean {
  const escaped = scriptFilename.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const invocation = new RegExp(
    "(?:\\b(?:bun|bunx|node|deno|tsx?|sh|bash|python3?)\\b[^\\n]{0,160}" +
      "|\\{baseDir\\}[^\\n]{0,120}" +
      "|(?:scripts/|/workspace/[^\\n]{0,120}|\\./))" +
      escaped,
  );
  return invocation.test(text);
}

/**
 * True when some tool result carries the script's success stdout — the
 * script actually ran, as opposed to being named in a command or file
 * body. `executionStdout` must be a line the script itself prints and
 * that never appears inside its output files.
 */
export function hasExecutionResultEvidence(
  events: AgentEvent[],
  executionStdout: string,
): boolean {
  return events.some((event) => {
    const message = event.message as Record<string, unknown> | undefined;
    if (message === undefined) return false;
    if (
      typeof message.type !== "string" ||
      !message.type.includes("tool_result")
    ) {
      return false;
    }
    // Only shell-shaped tools can have executed the script; a file_read
    // result echoing a file that happens to contain the line must not
    // count.
    if (
      typeof message.toolName !== "string" ||
      !/bash|shell|exec|terminal|command|run/i.test(message.toolName)
    ) {
      return false;
    }
    return (
      typeof message.result === "string" &&
      message.result.includes(executionStdout)
    );
  });
}

export interface ScriptReuseMetricOptions {
  /** Metric name in the report; defaults to `script-reused`. */
  name?: string;
  /** Bare filename of the proven script, e.g. `build_shownotes.ts`. */
  scriptFilename: string;
  /**
   * Success line the script prints to stdout when it runs (and which
   * never appears in its output files), e.g. `wrote shownotes/ep018.md`.
   */
  executionStdout: string;
  /** Workspace-relative path of the deliverable the script writes. */
  outputPath: string;
  /** Version marker the script stamps into that deliverable. */
  outputMarker: string;
}

export function makeScriptReuseMetric(
  options: ScriptReuseMetricOptions,
): (input: MetricInput) => Promise<MetricResult> {
  const name = options.name ?? "script-reused";
  return async function scoreScriptReuse(
    input: MetricInput,
  ): Promise<MetricResult> {
    const events = await readAssistantEvents(input.runId);
    const executed = hasExecutionResultEvidence(
      events,
      options.executionStdout,
    );

    let markerPresent = false;
    let markerNote: string;
    try {
      const output = await readAssistantWorkspaceFile(
        input.runId,
        options.outputPath,
      );
      markerPresent = output?.includes(options.outputMarker) ?? false;
      markerNote = markerPresent
        ? `${options.outputPath} carries the script's version marker`
        : output === undefined
          ? `${options.outputPath} does not exist in the workspace`
          : `${options.outputPath} lacks the script's version marker`;
    } catch (err) {
      if (!(err instanceof AssistantContainerUnavailableError)) throw err;
      markerNote =
        "assistant container not inspectable (non-vellum species?); marker check skipped";
    }

    const score = executed
      ? markerPresent
        ? 1
        : 0.75
      : markerPresent
        ? 0.25
        : 0;
    return {
      name,
      score,
      reason:
        (executed
          ? `A tool result carries ${options.scriptFilename}'s success output — it really ran`
          : `No tool result carries ${options.scriptFilename}'s success output — it never ran` +
            (markerPresent
              ? " (the marker below was likely hand-copied from prior outputs)"
              : "")) + `; ${markerNote}.`,
      metadata: {
        scriptFilename: options.scriptFilename,
        executionEvidence: executed,
        outputMarkerPresent: markerPresent,
      },
    };
  };
}
