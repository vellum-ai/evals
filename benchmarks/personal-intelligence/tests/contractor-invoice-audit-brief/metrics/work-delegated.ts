import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import {
  readSubagentSpawns,
  spawnsBeforeFirstRead,
} from "../../../../../src/lib/common-metrics/subagent-activity";

const METRIC_NAME = "work-delegated";

/**
 * Did the run hand any of this off to a subagent?
 *
 * Reported for context rather than as a verdict: twelve small CSVs are a
 * defensible thing to do alone, and whether the threshold judgement is
 * right is `conference-proposal-shortlist`'s question. This metric exists
 * so `brief-carries-constraints` has a precondition it can point at, and
 * so a run that never delegated is legible in the report instead of
 * looking like a briefing failure.
 */
export default async function scoreWorkDelegated(
  input: MetricInput,
): Promise<MetricResult> {
  const events = await readAssistantEvents(input.runId);
  const spawns = readSubagentSpawns(events);
  if (spawns.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "No subagent was spawned — the assistant did the reconciliation itself.",
      metadata: { spawnCount: 0 },
    };
  }
  return {
    name: METRIC_NAME,
    score: 1,
    reason:
      `Delegated to ${spawns.length} subagent(s): ` +
      spawns.map((s) => s.label ?? "(unlabelled)").join(", "),
    metadata: {
      spawnCount: spawns.length,
      labels: spawns.map((s) => s.label ?? null),
      roles: spawns.map((s) => s.role ?? null),
      spawnsBeforeFirstRead: spawnsBeforeFirstRead(events),
    },
  };
}
