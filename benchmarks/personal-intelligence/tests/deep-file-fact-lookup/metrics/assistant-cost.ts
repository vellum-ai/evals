import { makeCostMetric } from "../../../../../src/lib/common-metrics/cost-efficiency";
import { COST_BASELINE_USD } from "../constants";

/**
 * Score the run's assistant cost as a 0-1 quality fraction against the
 * case's baseline (see `makeCostMetric` / `scoreCostAgainstBaseline`).
 * The baseline lives in `constants.ts` and is a placeholder until the
 * first post-fix runs calibrate it.
 */
export default makeCostMetric({ baselineUsd: COST_BASELINE_USD });
