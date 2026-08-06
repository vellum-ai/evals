import { makeReadEconomyMetric } from "../../../../../src/lib/common-metrics/read-economy";

/**
 * How many chars of log content rode the context inline while working
 * the ~40,000-line gateway log? Shared grader and metadata schema:
 * `src/lib/common-metrics/read-economy.ts` (the runbook aggregates its
 * keys across cases).
 */
export default makeReadEconomyMetric();
