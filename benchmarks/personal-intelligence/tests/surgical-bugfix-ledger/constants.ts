/**
 * Ground truth for the ledger mini-project fixtures. Derived by running
 * `bun assets/generate.ts`, which writes `assets/project/` and
 * `assets/expected-fixed/` and prints exactly these values — regenerate
 * that way rather than editing here.
 */

/** Workspace-relative path of the file carrying the planted bug. */
export const TARGET_FILE = "src/ledger.ts";

/** Workspace-relative path of the entry point the user runs. */
export const REPORT_FILE = "report.ts";

/** Everything `setup.ts` stages — the pre-existing files of the run. */
export const STAGED_WORKSPACE_PATHS = [TARGET_FILE, REPORT_FILE];

/**
 * What `bun run report.ts` prints before the fix: the miswired
 * office-supplies filter sums March *office-services* entries instead.
 */
export const BUGGY_OUTPUT = "$3,638.54";

/** What `bun run report.ts` prints once the bug is fixed. */
export const CORRECT_OUTPUT = "$1,225.47";

/**
 * 1-based line numbers in the staged `src/ledger.ts` that the intended
 * fix changes — a single constant reference in the office-supplies
 * filter. `assets/expected-fixed/ledger.ts` is the byte-exact result.
 */
export const EXPECTED_CHANGED_LINES = [1470];

/**
 * Target assistant spend for a good run. Placeholder — calibrate to the
 * observed post-fix median after the first real runs (see the
 * coding-cost baseline plan).
 */
export const COST_BASELINE_USD = 0.15;
