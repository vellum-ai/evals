/**
 * Ground truth for the categories feature case. The totals come from the
 * shared expense-tracker fixture, whose `regen-expected.ts` prints them.
 * Regenerate that way rather than editing here.
 */
export {
  GRAND_TOTAL,
  MARCH_2025_TOTAL,
  TRACKER_DIR,
} from "../../lib/fixtures/expense-tracker/truth";

/** The category the metric files its first probe expense under. */
export const PROBE_CATEGORY = "food";

/**
 * What a report narrowed to that category must come to. One probe
 * expense carries it, so a narrowed month and a narrowed total both come
 * to this figure.
 */
export const PROBE_CATEGORY_TOTAL = "$18.25";

/**
 * What May comes to with both probe expenses counted. A narrowed month
 * report printing this figure ignored the category and summed the whole
 * month.
 */
export const MAY_UNFILTERED_TOTAL = "$48.25";

/**
 * What every expense in the probe copy comes to, both probes included
 * ($717.09 + $18.25 + $30.00). A narrowed total printing this figure
 * ignored the category and summed everything.
 */
export const PROBE_GRAND_TOTAL = "$765.34";

/**
 * Target assistant spend for a good run. Placeholder. Calibrate to the
 * observed post-run median after the first real runs, like the other
 * coding cases (see the coding-cost baseline runbook).
 */
export const COST_BASELINE_USD = 0.5;
