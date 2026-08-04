import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import { phaseEvents } from "../../../../../src/lib/common-metrics/phase-events";
import { readSubagentSpawns } from "../../../../../src/lib/common-metrics/subagent-activity";
import { PROPOSAL_COUNT } from "../constants";

const METRIC_NAME = "delegates-wide-job";

/**
 * Did phase 1 hand the 38-document sweep to a subagent?
 *
 * This is the "should delegate" half of the pair. The work is wide and
 * separable — each proposal is read once, in no particular order — which
 * is the shape delegation exists for. Doing it inline is not a crash,
 * but it is the judgement this test is asking about, and its partner
 * metric (`no-spawn-on-trivial`) is what stops "always delegate" from
 * scoring full marks.
 */
export default async function scoreDelegatesWideJob(
  input: MetricInput,
): Promise<MetricResult> {
  const events = phaseEvents(await readAssistantEvents(input.runId), 1);
  if (events === undefined) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: "Not applicable: phase 1 produced no events.",
    };
  }
  const spawns = readSubagentSpawns(events);
  return {
    name: METRIC_NAME,
    score: spawns.length > 0 ? 1 : 0,
    reason:
      spawns.length > 0
        ? `Delegated the ${PROPOSAL_COUNT}-proposal sweep to ${spawns.length} subagent(s).`
        : `Read all ${PROPOSAL_COUNT} proposals inline without delegating.`,
    metadata: {
      spawnCount: spawns.length,
      labels: spawns.map((s) => s.label ?? null),
      roles: spawns.map((s) => s.role ?? null),
    },
  };
}
