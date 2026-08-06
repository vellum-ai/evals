import type { AgentEvent } from "../../../../../src/lib/adapter";
import {
  isSpoolDerefRead,
  observedReadScope,
} from "../../../../../src/lib/common-metrics/tool-activity";
import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";

const METRIC_NAME = "spool-recovery";

/**
 * The pure half of the metric: grade spool recovery from the run's
 * event stream.
 *
 * The staged log is dense enough that a default-limit `file_read`
 * returns far more than the assistant's 25k-char spool threshold, so a
 * naive full read gets its result replaced by a `.tool-results/` stub.
 *
 * CONTRACT: every spooled read must be recovered; the score is the
 * fraction of spooled reads that were. Whether the agent still "needed"
 * a given spooled result is not observable from the stream, so the
 * deliberate rule is that all spooled reads count as needed — an agent
 * that fat-reads and walks away from the stub eats the miss. A spooled
 * read counts as recovered when a LATER non-empty, NON-ERRORED read took
 * either legitimate route back to the content (an errored result's text
 * is an error message, not the content):
 *
 *   - Deref: a read of the stub's own `.tool-results/` target (such
 *     reads stay inline by design, so a non-empty result means the
 *     content came back).
 *   - Ranged re-read: a read of the originally spooled file with an
 *     explicit `offset`/`limit` window that was not itself spooled —
 *     the recovery route the SPEC invites; the stub need never be
 *     touched.
 *
 * Nothing ever spooled → `applicable: false`. A search-first
 * (`code_search`/`host_code_search`) or tightly-sliced strategy never
 * trips the threshold — a good outcome, just not this metric's
 * business; metadata records the strategy so the report can tell smart
 * from lucky.
 */
export function gradeSpoolRecovery(events: AgentEvent[]): MetricResult {
  const { reads, codeSearchCalls } = observedReadScope(events);
  const derefs = reads.filter(isSpoolDerefRead);
  const successfulDerefCount = derefs.filter(
    (read) => read.resultChars > 0 && !read.isError,
  ).length;

  const spooled = reads
    .map((read, index) => ({ read, index }))
    .filter(({ read }) => read.spooled);

  if (spooled.length === 0) {
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
        spooledCount: 0,
        recoveredCount: 0,
        derefCount: derefs.length,
        successfulDerefCount,
        fileReadCount: reads.length,
        codeSearchCalls,
        strategy,
      },
    };
  }

  const recoveredCount = spooled.filter(({ read, index }) =>
    reads.slice(index + 1).some(
      (later) =>
        later.resultChars > 0 &&
        // A failed read brought back an error message, not the content.
        !later.isError &&
        // Deref of this stub's own spool file...
        (later.path === read.spoolPath ||
          // ...or an explicit-window re-read of the spooled file that
          // stayed inline.
          (later.path === read.path &&
            !later.spooled &&
            (later.offset !== undefined || later.limit !== undefined))),
    ),
  ).length;
  const score = recoveredCount / spooled.length;

  return {
    name: METRIC_NAME,
    score,
    reason:
      score === 1
        ? `All ${spooled.length} spooled read(s) were recovered (deref or ranged re-read paged the omitted content back in).`
        : score === 0
          ? `${spooled.length} spooled read(s) and none recovered — no successful deref or ranged re-read; the spooled content was abandoned.`
          : `${recoveredCount} of ${spooled.length} spooled read(s) were recovered; the rest were abandoned.`,
    metadata: {
      spooledCount: spooled.length,
      recoveredCount,
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
