import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import { phaseEvents } from "../../../../../src/lib/common-metrics/phase-events";
import { readSubagentSpawns } from "../../../../../src/lib/common-metrics/subagent-activity";

const METRIC_NAME = "no-spawn-on-trivial";

/**
 * Did phase 2 correctly NOT delegate?
 *
 * The "should not delegate" half. Phase 2 is a single-word edit to one
 * named file; a worker costs a briefing, a spawn and a read to save
 * nothing, and it puts a delegate between the user and a trivial change.
 *
 * Without this metric the suite would reward reflexive fan-out, which is
 * the failure mode a delegation-capable assistant actually exhibits.
 */
export default async function scoreNoSpawnOnTrivial(
  input: MetricInput,
): Promise<MetricResult> {
  const events = phaseEvents(await readAssistantEvents(input.runId), 2);
  if (events === undefined) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Not applicable: the run never reached phase 2, so the restraint " +
        "half of the judgement was never exercised.",
    };
  }
  const spawns = readSubagentSpawns(events);
  return {
    name: METRIC_NAME,
    score: spawns.length === 0 ? 1 : 0,
    reason:
      spawns.length === 0
        ? "Fixed the one-line date itself, without spawning a worker."
        : `Spawned ${spawns.length} subagent(s) for a one-word edit to a single known file.`,
    metadata: {
      spawnCount: spawns.length,
      labels: spawns.map((s) => s.label ?? null),
    },
  };
}
