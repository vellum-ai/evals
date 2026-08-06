import type { AgentEvent } from "../adapter";
import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
  type MetricScorer,
} from "../metrics";
import {
  isSpoolDerefRead,
  noObservableReadsReason,
  observedReadScope,
  readsPerFile,
} from "./tool-activity";

const METRIC_NAME = "read-economy";

/**
 * The pure half of the metric: how much file content the run pulled
 * inline. `unit: "raw"` — the score is total result chars across all
 * `file_read` calls (a spooled result counts at stub size, which is the
 * point: this measures inline context load, not bytes touched).
 *
 * ONE metadata schema, shared by every case that carries this metric.
 * The coding-cost baseline runbook aggregates these keys ACROSS cases,
 * so they must not drift per case:
 *
 *   - `fileReadCount` — total `file_read`/`host_file_read` calls
 *   - `readsPerFile` — calls per distinct path
 *   - `defaultLimitReadCount` — reads with no explicit `limit`
 *   - `spooledReadCount` — reads whose result became a spool stub
 *   - `spoolDerefReadCount` — reads of `.tool-results/` spool files
 *
 * Aggregated, `defaultLimitReadCount` vs `spooledReadCount` is the
 * direct evidence for the "does a 2000-line default read of a dense file
 * always exceed the 25k spool threshold" question.
 *
 * OBSERVABILITY SCOPE: this stream is the parent conversation's — a
 * subagent's own file reads never appear here (see
 * `subagent-activity.ts`). On runs with nothing observable to measure
 * (hermes single-shot runs, fully delegated runs) the metric returns
 * `applicable: false` rather than a confident zero: "pulled zero chars
 * inline" is only meaningful when reads were observable at all.
 */
export function gradeReadEconomy(events: AgentEvent[]): MetricResult {
  const observed = observedReadScope(events);
  const { reads, codeSearchCalls, subagentSpawnCount, scope } = observed;

  const defaultLimitReadCount = reads.filter(
    (read) => read.limit === undefined,
  ).length;
  const spooledReadCount = reads.filter((read) => read.spooled).length;
  const metadata = {
    fileReadCount: reads.length,
    readsPerFile: Object.fromEntries(readsPerFile(reads)),
    defaultLimitReadCount,
    spooledReadCount,
    spoolDerefReadCount: reads.filter(isSpoolDerefRead).length,
    codeSearchCalls,
    subagentSpawnCount,
    scope,
  };

  if (reads.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: noObservableReadsReason(observed, {
        delegated: "inline load is not measured rather than under-counted",
        noReads: "there is no inline read load to measure",
      }),
      metadata,
    };
  }

  const inlineResultChars = reads.reduce(
    (sum, read) => sum + read.resultChars,
    0,
  );
  return {
    name: METRIC_NAME,
    score: inlineResultChars,
    unit: "raw",
    reason: `${reads.length} file_read call(s) pulled ${inlineResultChars} chars inline (${defaultLimitReadCount} default-limit, ${spooledReadCount} spooled).`,
    metadata,
  };
}

/**
 * Build the read-economy metric for a case. Cases share the grader (and
 * its metadata schema) rather than reimplementing it — see
 * {@link gradeReadEconomy}.
 */
export function makeReadEconomyMetric(): MetricScorer {
  return async function scoreReadEconomy(
    input: MetricInput,
  ): Promise<MetricResult> {
    return gradeReadEconomy(await readAssistantEvents(input.runId));
  };
}
