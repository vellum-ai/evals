/**
 * Ground truth for the deep-file-fact-lookup fixtures. Derived by running
 * `bun assets/generate.ts`, which writes `assets/workspace/` and prints
 * exactly these numbers — regenerate that way rather than editing here.
 */

/** Workspace-relative path of the 6,000-line generated pricing module. */
export const BIG_FILE_PATH = "catalog/price-table.ts";

/** Exact line count of the generated pricing module. */
export const BIG_FILE_TOTAL_LINES = 6000;

/**
 * USD to order one of every SKU in `CURRENT_PRICE_TABLE` (opens at line
 * 5,200 — far past the default 2000-line read window). The answer.
 */
export const CORRECT_TOTAL = 20270;

/**
 * USD sum of `DEPRECATED_PRICE_TABLE_2025` (same SKU ids, superseded
 * prices, fully inside the first 2000 lines). The trap value: an agent
 * that never pages past the truncation notice lands exactly here.
 */
export const DEPRECATED_TABLE_TOTAL = 18116;

/** Placeholder — calibrate after first post-fix runs. */
export const COST_BASELINE_USD = 0.1;
