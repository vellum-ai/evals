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

/** What a May report narrowed to that category must come to. */
export const PROBE_CATEGORY_TOTAL = "$18.25";

/**
 * What May comes to with both probe expenses counted. A narrowed report
 * printing this figure ignored the category and summed the whole month.
 */
export const MAY_UNFILTERED_TOTAL = "$48.25";

/**
 * Target assistant spend for a good run. Placeholder. Calibrate to the
 * observed post-run median after the first real runs, like the other
 * coding cases (see the coding-cost baseline runbook).
 */
export const COST_BASELINE_USD = 0.5;
