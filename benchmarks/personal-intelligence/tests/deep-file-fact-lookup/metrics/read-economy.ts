import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import {
  fileReadCalls,
  readsPerFile,
} from "../../../../../src/lib/common-metrics/tool-activity";

import type { AgentEvent } from "../../../../../src/lib/adapter";

const METRIC_NAME = "read-economy";

/**
 * The pure half of the metric: how much file content the run pulled
 * inline. `unit: "raw"` — the score is total result chars across all
 * file_read calls (a spooled result counts at stub size, which is the
 * point: inline context load).
 *
 * `metadata.spooledReads`, aggregated across cases, is the direct
 * evidence for the "does a 2000-line default read of a dense file always
 * exceed the 25k spool threshold" question; `defaultLimitReads` says how
 * often the default window was used at all.
 */
export function gradeReadEconomy(events: AgentEvent[]): MetricResult {
  const reads = fileReadCalls(events);
  const inlineResultChars = reads.reduce(
    (sum, read) => sum + read.resultChars,
    0,
  );
  const defaultLimitReads = reads.filter(
    (read) => read.limit === undefined,
  ).length;
  const spooledReads = reads.filter((read) => read.spooled).length;

  return {
    name: METRIC_NAME,
    score: inlineResultChars,
    unit: "raw",
    reason: `${reads.length} file_read call(s) pulled ${inlineResultChars} chars inline (${defaultLimitReads} at the default limit, ${spooledReads} spooled).`,
    metadata: {
      totalReads: reads.length,
      readsPerFile: Object.fromEntries(readsPerFile(events)),
      defaultLimitReads,
      spooledReads,
    },
  };
}

/** How many chars of file content rode the context? See {@link gradeReadEconomy}. */
export default async function scoreReadEconomy(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeReadEconomy(await readAssistantEvents(input.runId));
}
