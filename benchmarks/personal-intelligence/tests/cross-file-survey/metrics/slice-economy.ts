import type { AgentEvent } from "../../../../../src/lib/adapter";
import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import {
  isSpoolDerefRead,
  noObservableReadsReason,
  observedReadScope,
  readsPerFile,
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
  const observed = observedReadScope(events);
  const { reads, codeSearchCalls, subagentSpawnCount, scope } = observed;

  // Spool derefs stay out of the mean: filter them, then count reads per
  // file with the shared map.
  const workspaceReads = reads.filter((read) => !isSpoolDerefRead(read));
  const perFileReadCounts = Object.fromEntries(readsPerFile(workspaceReads));
  const distinctFiles = Object.keys(perFileReadCounts).length;

  const metadata = {
    perFileReadCounts,
    codeSearchCalls,
    spooledReadCount: reads.filter((read) => read.spooled).length,
    spoolDerefReadCount: reads.length - workspaceReads.length,
    subagentSpawnCount,
    scope,
  };

  if (distinctFiles === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: noObservableReadsReason(observed, {
        delegated: "it is not scored rather than under-counted",
        noReads: "there is no read pattern to grade",
      }),
      metadata,
    };
  }

  const mean = workspaceReads.length / distinctFiles;
  const score = economyScore(mean);
  return {
    name: METRIC_NAME,
    score,
    reason:
      score === 1
        ? `Read ${distinctFiles} file(s) in ${workspaceReads.length} file_read call(s) — about one pass per file.`
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
