import { makeCostMetric } from "../../../../../src/lib/common-metrics/cost-efficiency";
import { COST_BASELINE_USD } from "../constants";

/**
 * Score the run's assistant cost as a 0-1 quality fraction against
 * `COST_BASELINE_USD` (see `makeCostMetric`): two facts from one log
 * file should be cheap even though the file itself is not.
 * Partial/missing cost metering yields `applicable: false`.
 */
export default makeCostMetric({ baselineUsd: COST_BASELINE_USD });
