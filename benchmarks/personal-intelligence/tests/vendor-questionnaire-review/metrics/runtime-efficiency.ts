import { makeRuntimeEfficiencyMetric } from "../../../../../src/lib/common-metrics/runtime-efficiency";
import { RUNTIME_BASELINE_MS } from "../constants";

/**
 * Conversation wall-clock against the case baseline. A worker per vendor
 * serializes into eight read-backs, which costs latency whether or not
 * it costs accuracy. Baseline is a placeholder until the first real runs
 * calibrate it (see constants.ts).
 */
export default makeRuntimeEfficiencyMetric({ baselineMs: RUNTIME_BASELINE_MS });
