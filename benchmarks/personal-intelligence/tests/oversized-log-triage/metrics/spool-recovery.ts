import type { AgentEvent } from "../../../../../src/lib/adapter";
import {
  fileReadCalls,
  readToolCalls,
  spoolDerefReads,
} from "../../../../../src/lib/common-metrics/tool-activity";
import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";

const METRIC_NAME = "spool-recovery";

/**
 * The pure half of the metric: grade the spool → deref round-trip from
 * the run's event stream.
 *
 * The staged log is dense enough that a default-limit `file_read`
 * returns far more than the assistant's 25k-char spool threshold, so a
 * naive full read gets its result replaced by a `.tool-results/` stub.
 * Three distinguishable outcomes:
 *
 *   - Nothing ever spooled → `applicable: false`. A search-first or
 *     tightly-sliced strategy never trips the threshold — a good
 *     outcome, just not this metric's business; metadata records the
 *     strategy so the report can tell smart from lucky.
 *   - Spooled and recovered → 1. At least one spooled read was followed
 *     by a successful `.tool-results/` deref read (such reads stay
 *     inline by design, so a non-empty result means the content came
 *     back).
 *   - Spooled and abandoned → 0. The stub was never dereferenced; the
 *     omitted content stayed lost.
 */
export function gradeSpoolRecovery(events: AgentEvent[]): MetricResult {
  const reads = fileReadCalls(events);
  const spooledCount = reads.filter((read) => read.spooled).length;
  const derefs = spoolDerefReads(events);
  const successfulDerefCount = derefs.filter(
    (read) => read.resultChars > 0,
  ).length;
  const codeSearchCalls = readToolCalls(events).filter(
    (call) => call.name === "code_search",
  ).length;

  if (spooledCount === 0) {
    const strategy =
      codeSearchCalls > 0
        ? "search-first"
        : reads.length > 0
          ? "sliced-reads"
          : "no-file-reads";
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: `No tool result was spooled during the run (${strategy}: ${codeSearchCalls} code_search call(s), ${reads.length} file read(s)) — nothing to recover.`,
      metadata: {
        spooledCount,
        derefCount: derefs.length,
        successfulDerefCount,
        fileReadCount: reads.length,
        codeSearchCalls,
        strategy,
      },
    };
  }

  const recovered = successfulDerefCount > 0;
  return {
    name: METRIC_NAME,
    score: recovered ? 1 : 0,
    reason: recovered
      ? `${spooledCount} spooled read(s); ${successfulDerefCount} successful .tool-results/ deref read(s) paged the omitted content back in.`
      : `${spooledCount} spooled read(s) and no successful .tool-results/ deref — the spooled content was abandoned.`,
    metadata: {
      spooledCount,
      derefCount: derefs.length,
      successfulDerefCount,
      fileReadCount: reads.length,
      codeSearchCalls,
    },
  };
}

/** Did spooled results get dereferenced? See {@link gradeSpoolRecovery}. */
export default async function scoreSpoolRecovery(
  input: MetricInput,
): Promise<MetricResult> {
  return gradeSpoolRecovery(await readAssistantEvents(input.runId));
}
