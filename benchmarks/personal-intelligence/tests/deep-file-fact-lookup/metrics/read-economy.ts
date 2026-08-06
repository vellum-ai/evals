import { makeReadEconomyMetric } from "../../../../../src/lib/common-metrics/read-economy";

/**
 * How many chars of file content rode the context inline while paging
 * the 6,000-line pricing file? Shared grader and metadata schema:
 * `src/lib/common-metrics/read-economy.ts` (the runbook aggregates its
 * keys across cases).
 */
export default makeReadEconomyMetric();
