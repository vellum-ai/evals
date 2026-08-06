import type { AgentEvent } from "../../../../../src/lib/adapter";
import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import { readSubagentSpawns } from "../../../../../src/lib/common-metrics/subagent-activity";
import {
  CODE_SEARCH_TOOLS,
  fileReadCalls,
  isSpoolDerefRead,
  readToolCalls,
} from "../../../../../src/lib/common-metrics/tool-activity";

const METRIC_NAME = "slice-economy";

/** Mean file_read calls per distinct file at or under which score is 1. */
export const FULL_MARKS_MEAN = 1.5;

/** Mean at or past which score is 0 — the many-small-slices anti-pattern. */
export const ZERO_MARKS_MEAN = 4;

/**
 * The scoring curve: 1 at a mean of `FULL_MARKS_MEAN` reads per distinct
 * file or better, declining linearly to 0 at `ZERO_MARKS_MEAN` or worse.
 * A survey of many small files rewards reading each relevant file once
 * in one pass — the behaviour the researcher preamble asks for — while a
 * dozen tiny slices of the same file is the anti-pattern it targets.
 */
export function economyScore(meanReadsPerFile: number): number {
  if (meanReadsPerFile <= FULL_MARKS_MEAN) return 1;
  if (meanReadsPerFile >= ZERO_MARKS_MEAN) return 0;
  return (
    (ZERO_MARKS_MEAN - meanReadsPerFile) / (ZERO_MARKS_MEAN - FULL_MARKS_MEAN)
  );
}

/**
 * The pure half of the metric: grade slice economy over an event stream.
 *
 * OBSERVABILITY SCOPE: this stream is the parent conversation's. Subagent
 * tool calls travel as `skill_execute {tool: "subagent_*"}` envelopes
 * (see `subagent-activity.ts`) — a subagent's own file reads never appear
 * here. So the metric grades the reads it can see and always says what
 * that scope was in `metadata.scope`; when the run delegated and left
 * nothing observable to grade, it returns `applicable: false` rather
 * than a confident zero.
 *
 * Spool-deref reads (of `.tool-results/` stubs) are round-trips forced
 * by result spooling, not slicing choices, so they are excluded from the
 * mean and counted separately in metadata.
 */
export function gradeSliceEconomy(events: AgentEvent[]): MetricResult {
  const codeSearchCalls = readToolCalls(events).filter((call) =>
    CODE_SEARCH_TOOLS.has(call.name),
  ).length;
  const subagentSpawnCount = readSubagentSpawns(events).length;

  // Reads-per-file, as in `readsPerFile`, but split so spool derefs stay
  // out of the mean.
  const perFileReadCounts: Record<string, number> = {};
  let workspaceReadCount = 0;
  let spoolDerefReadCount = 0;
  let spooledReadCount = 0;
  for (const read of fileReadCalls(events)) {
    if (read.spooled) spooledReadCount += 1;
    if (isSpoolDerefRead(read)) {
      spoolDerefReadCount += 1;
    } else {
      perFileReadCounts[read.path] = (perFileReadCounts[read.path] ?? 0) + 1;
      workspaceReadCount += 1;
    }
  }
  const distinctFiles = Object.keys(perFileReadCounts).length;

  const scope =
    subagentSpawnCount > 0
      ? "parent-events-only: subagent-internal tool calls do not appear in " +
        "the parent's event stream, so only the parent's own reads are graded."
      : "parent-events-only: no subagents were spawned, so every read is " +
        "observable here.";

  const metadata = {
    perFileReadCounts,
    codeSearchCalls,
    spooledReadCount,
    spoolDerefReadCount,
    subagentSpawnCount,
    scope,
  };

  if (distinctFiles === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        subagentSpawnCount > 0
          ? `Not applicable: no file reads are observable in the parent event stream and ${subagentSpawnCount} subagent(s) were spawned — the reading happened where this stream cannot see it, so it is not scored rather than under-counted.`
          : `Not applicable: the run performed no file reads (${codeSearchCalls} code_search call(s)) — there is no read pattern to grade.`,
      metadata,
    };
  }

  const mean = workspaceReadCount / distinctFiles;
  const score = economyScore(mean);
  return {
    name: METRIC_NAME,
    score,
    reason:
      score === 1
        ? `Read ${distinctFiles} file(s) in ${workspaceReadCount} file_read call(s) — about one pass per file.`
        : `Averaged ${mean.toFixed(2)} file_read calls per distinct file across ${distinctFiles} file(s) — the many-small-slices pattern (full marks at ≤ ${FULL_MARKS_MEAN}, zero at ≥ ${ZERO_MARKS_MEAN}).`,
    metadata: { ...metadata, meanReadsPerFile: Number(mean.toFixed(3)) },
  };
}

/** Was the reading done in one pass per file? See {@link gradeSliceEconomy}. */
export default async function scoreSliceEconomy(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeSliceEconomy(await readAssistantEvents(input.runId));
}
