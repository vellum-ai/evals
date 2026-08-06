import {
  fileReadCalls,
  readsPerFile,
  spoolDerefReads,
} from "../../../../../src/lib/common-metrics/tool-activity";
import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";

const METRIC_NAME = "read-economy";

/**
 * Raw diagnostic, not a quality judgment: total inline `file_read`
 * result chars across the run. Post-spool results count at stub size —
 * which is the point: this measures inline context load, not bytes
 * touched. The metadata (reads per file, default-limit read count,
 * spooled-read count) is the direct evidence for the "does a 2000-line
 * default read of a dense file always exceed the 25k spool threshold"
 * question the runbook aggregates across cases.
 *
 * `deep-file-fact-lookup` carries a similar metric; the two are
 * deliberately self-contained for now (parallel PRs) — a follow-up
 * cleanup can consolidate them into `src/lib/common-metrics/`.
 */
export default async function scoreReadEconomy(
  input: MetricInput,
): Promise<MetricResult> {
  const events = await readAssistantEvents(input.runId);
  const reads = fileReadCalls(events);
  const totalInlineChars = reads.reduce(
    (sum, read) => sum + read.resultChars,
    0,
  );
  const defaultLimitReadCount = reads.filter(
    (read) => read.limit === undefined,
  ).length;
  const spooledReadCount = reads.filter((read) => read.spooled).length;

  return {
    name: METRIC_NAME,
    score: totalInlineChars,
    unit: "raw",
    reason: `${totalInlineChars} inline file_read result chars over ${reads.length} read(s) (${defaultLimitReadCount} default-limit, ${spooledReadCount} spooled).`,
    metadata: {
      readsPerFile: Object.fromEntries(readsPerFile(events)),
      fileReadCount: reads.length,
      defaultLimitReadCount,
      spooledReadCount,
      spoolDerefReadCount: spoolDerefReads(events).length,
    },
  };
}
