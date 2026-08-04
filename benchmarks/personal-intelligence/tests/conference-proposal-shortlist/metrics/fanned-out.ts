import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import { phaseEvents } from "../../../../../src/lib/common-metrics/phase-events";
import {
  readSubagentSpawns,
  spawnsBeforeFirstRead,
} from "../../../../../src/lib/common-metrics/subagent-activity";

const METRIC_NAME = "fanned-out";

/**
 * Did phase 1 actually parallelise, or just delegate serially?
 *
 * Counted as spawns issued before the first `subagent_read`: a fan-out
 * dispatches its workers and then collects, so several spawns precede
 * the first read; a serial chain reads each worker before starting the
 * next and leaves this at 1. Deliberately not "concurrent at the same
 * instant" — the event stream carries no completion timestamps that
 * would support that claim.
 *
 *   >= 3 before the first read = 1.0   2 = 0.5   1 (serial) = 0.25
 *
 * Not applicable when nothing was delegated: `delegates-wide-job`
 * already scores that, and repeating it here would double-penalise one
 * decision.
 */
export default async function scoreFannedOut(
  input: MetricInput,
): Promise<MetricResult> {
  const events = phaseEvents(await readAssistantEvents(input.runId), 1);
  if (events === undefined || readSubagentSpawns(events).length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Not applicable: nothing was delegated in phase 1, so there was no " +
        "fan-out to measure. See delegates-wide-job.",
    };
  }
  const parallel = spawnsBeforeFirstRead(events);
  const score = parallel >= 3 ? 1 : parallel === 2 ? 0.5 : 0.25;
  return {
    name: METRIC_NAME,
    score,
    reason:
      parallel >= 2
        ? `${parallel} workers were dispatched before the first result was read.`
        : "Workers were run one at a time — delegation without parallelism.",
    metadata: { spawnsBeforeFirstRead: parallel },
  };
}
