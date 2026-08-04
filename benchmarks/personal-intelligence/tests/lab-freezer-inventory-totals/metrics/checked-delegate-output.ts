import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import {
  inspectedSubagentOutput,
  readSubagentCalls,
  readSubagentSpawns,
} from "../../../../../src/lib/common-metrics/subagent-activity";

const METRIC_NAME = "checked-delegate-output";

/**
 * If the work was handed off, did anyone look at what came back?
 *
 * A subagent that sums the column as written returns a confident,
 * plausible, wrong number. The only thing standing between that and the
 * user's reorder is the parent reading the result and checking it — so
 * `subagent_read` / `subagent_status` is the supervision signal, and
 * relaying an unread result is the failure.
 *
 * Not applicable when nothing was delegated. A run that did the work
 * itself has no delegate to supervise, and `totals-correct` already
 * judges whether it got the answer right.
 */
export default async function scoreCheckedDelegateOutput(
  input: MetricInput,
): Promise<MetricResult> {
  const events = await readAssistantEvents(input.runId);
  const spawns = readSubagentSpawns(events);
  if (spawns.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Not applicable: nothing was delegated, so there was no delegate's " +
        "work to check. See totals-correct for whether the answer is right.",
      metadata: { spawnCount: 0 },
    };
  }
  const inspected = inspectedSubagentOutput(events);
  const calls = readSubagentCalls(events);
  return {
    name: METRIC_NAME,
    score: inspected ? 1 : 0,
    reason: inspected
      ? "Read the delegate's output back before reporting."
      : `Spawned ${spawns.length} subagent(s) and never called subagent_read or ` +
        "subagent_status — the delegate's numbers went to the user unchecked.",
    metadata: {
      spawnCount: spawns.length,
      toolsUsed: [...new Set(calls.map((c) => c.tool))],
    },
  };
}
