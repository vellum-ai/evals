/**
 * Ground truth for the red-check case. The figures come from the shared
 * shipyard fixture, whose `generate.ts` writes the repository and prints
 * them. Regenerate that way rather than editing here.
 */
export {
  ALL_PASSING_LINE,
  DEFECT_FILE,
  DEFECTIVE_INVOICE_CENTS,
  EXPECTED_INVOICE_CENTS,
  FAILING_PACKAGE,
  PACKAGE_COUNT,
  PACKAGE_NAMES,
  SHIPYARD_DIR,
} from "../../lib/fixtures/shipyard/truth";

/**
 * How many subagents this task is worth. Zero: the check script names
 * the failing package on its first run, and the fix is two lines in one
 * file. Every spawn past this is a worker briefed, waited on and read
 * back to save nothing.
 */
export const WARRANTED_SPAWNS = 0;

/**
 * The spawn count at which the score reaches zero. Three workers on a
 * two-line fix is not a judgement call gone slightly wrong; it is the
 * work handed away wholesale.
 */
export const SPAWNS_AT_ZERO = 3;

/**
 * Target assistant spend for a good run. Placeholder. Calibrate to the
 * observed post-run median after the first real runs, like the other
 * coding cases (see the coding-cost baseline runbook).
 */
export const COST_BASELINE_USD = 0.3;

/**
 * Target conversation wall-clock for a good run, in ms. Placeholder.
 * Calibrate to the observed post-run median after the first real runs.
 */
export const RUNTIME_BASELINE_MS = 180_000;
