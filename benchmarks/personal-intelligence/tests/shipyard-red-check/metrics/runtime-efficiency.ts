import { makeRuntimeEfficiencyMetric } from "../../../../../src/lib/common-metrics/runtime-efficiency";
import { RUNTIME_BASELINE_MS } from "../constants";

/**
 * Conversation wall-clock against the case baseline. Delegation is paid
 * for in latency as well as money: a blocking advisor consult stalls the
 * turn outright, and a worker per item serializes into the read-backs
 * that follow. A run that spawns shows up here whether or not it lands
 * the right answer. Baseline is a placeholder until the first real runs
 * calibrate it (see constants.ts).
 */
export default makeRuntimeEfficiencyMetric({ baselineMs: RUNTIME_BASELINE_MS });
