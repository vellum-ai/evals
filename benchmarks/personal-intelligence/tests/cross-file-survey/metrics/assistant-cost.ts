import { makeCostMetric } from "../../../../../src/lib/common-metrics/cost-efficiency";
import { COST_BASELINE_USD } from "../constants";

/**
 * Assistant spend against the case baseline, as a 0-1 quality fraction
 * (see `makeCostMetric`). Partial/missing cost metering yields
 * `applicable: false`. Baseline is a placeholder until the first real
 * runs calibrate it (see constants.ts).
 */
export default makeCostMetric({ baselineUsd: COST_BASELINE_USD });
