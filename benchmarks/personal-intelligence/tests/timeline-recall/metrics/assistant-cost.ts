import { makeCostMetric } from "../../../../../src/lib/common-metrics/cost-efficiency";

/**
 * Target assistant spend for a good timeline-recall run, in USD. A run at or
 * under this baseline scores 100%; past it the score decays as the inverse
 * cost ratio (see `scoreCostAgainstBaseline`). Sized to a realistic cached
 * agentic turn so the metric keeps a wide range rather than flooring at 0%.
 */
const COST_BASELINE_USD = 0.05;

/**
 * Score the run's assistant cost as a 0-1 quality fraction measuring how far
 * the spend lands from `COST_BASELINE_USD`. Reporting cost on the 0-1 axis
 * keeps it composable with quality metrics like `date-mentioned` instead of
 * injecting raw negative dollars into the aggregate. Partial/missing cost
 * metering yields `applicable: false` — see `makeCostMetric`.
 */
export default makeCostMetric({ baselineUsd: COST_BASELINE_USD });
