/**
 * Ground truth for the year-report feature case. The figures and the
 * committed command outputs come from the shared expense-tracker fixture,
 * whose `regen-expected.ts` prints and rewrites them. Regenerate that way
 * rather than editing here.
 */
export {
  EXPECTED_OUTPUTS,
  readExpectedOutput,
  TRACKER_DIR,
  YEAR_2025_TOTAL,
  type ExpectedOutputName,
} from "../../lib/fixtures/expense-tracker/truth";

/**
 * Target assistant spend for a good run. Placeholder. Calibrate to the
 * observed post-run median after the first real runs, like the other
 * coding cases (see the coding-cost baseline runbook).
 */
export const COST_BASELINE_USD = 0.25;
