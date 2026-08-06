import { makeRuntimeEfficiencyMetric } from "../../../../../src/lib/common-metrics/runtime-efficiency";
import { RUNTIME_BASELINE_MS } from "../constants";

/**
 * Conversation wall-clock against the case baseline — the indirect signal
 * for the async code_search walk under many-search load: a survey that
 * fans out dozens of searches and reads shows up here long before it
 * shows up anywhere else. Baseline is a placeholder until the first real
 * runs calibrate it (see constants.ts).
 */
export default makeRuntimeEfficiencyMetric({ baselineMs: RUNTIME_BASELINE_MS });
