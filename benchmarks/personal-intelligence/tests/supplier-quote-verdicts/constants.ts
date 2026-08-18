/**
 * Ground truth for the quote-verdicts case. The totals come from the
 * shared supplier-quotes fixture, whose `generate.ts` writes the quotes
 * and prints them. Regenerate that way rather than editing here.
 */
export {
  CHEAPEST,
  FASTEST,
  QUOTE_COUNT,
  QUOTE_TRUTH,
  QUOTES_DIR,
  type QuoteTruth,
} from "../../lib/fixtures/supplier-quotes/truth";

/** The file the user asks for, workspace-relative. */
export const SUMMARY_FILE = "quotes-summary.md";

/**
 * How many subagents this task is worth. Zero: eight twenty-line files,
 * three multiplications each. Briefing a worker costs more than reading
 * the file it would be briefed about.
 */
export const WARRANTED_SPAWNS = 0;

/**
 * The spawn count at which the score reaches zero. Four is where a
 * per-item fan-out has plainly started: half the quotes handed out.
 */
export const SPAWNS_AT_ZERO = 4;

/**
 * Target assistant spend for a good run. Placeholder. Calibrate to the
 * observed post-run median after the first real runs, like the other
 * cases (see the coding-cost baseline runbook).
 */
export const COST_BASELINE_USD = 0.15;

/**
 * Target conversation wall-clock for a good run, in ms. Placeholder.
 * Calibrate to the observed post-run median after the first real runs.
 */
export const RUNTIME_BASELINE_MS = 120_000;
