import { makeRuntimeEfficiencyMetric } from "../../../../../src/lib/common-metrics/runtime-efficiency";
import { RUNTIME_BASELINE_MS } from "../constants";

export default makeRuntimeEfficiencyMetric({ baselineMs: RUNTIME_BASELINE_MS });
