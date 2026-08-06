import { makeCostMetric } from "../../../../../src/lib/common-metrics/cost-efficiency";
import { COST_BASELINE_USD } from "../constants";

export default makeCostMetric({ baselineUsd: COST_BASELINE_USD });
