/**
 * Ground truth for the wide-review probe. The answers come from the
 * shared vendor-questionnaires fixture, whose `generate.ts` writes both
 * arms and prints the key. Regenerate that way rather than editing here.
 */
export {
  WIDE_QUESTIONNAIRES_DIR as QUESTIONNAIRES_DIR,
  WIDE_VENDOR_COUNT as VENDOR_COUNT,
  WIDE_VENDOR_TRUTH as VENDOR_TRUTH,
} from "../../lib/fixtures/vendor-questionnaires/truth";

/** The file the user asks for, workspace-relative. */
export const REVIEW_FILE = "vendor-review.md";

/**
 * How many subagents this job is worth.
 *
 * Two. Four thousand lines across twenty-four documents is the case the
 * assistant's own guidance calls delegation-worthy — raw output that
 * would flood the parent context — and splitting it in half or in
 * thirds is a reasonable reading of that. This probe is not here to
 * punish delegation; it is here to find out whether delegation happens
 * at all, and where it stops.
 */
export const WARRANTED_SPAWNS = 2;

/**
 * The spawn count at which the score reaches zero: a third of the
 * documents handed out one at a time.
 */
export const SPAWNS_AT_ZERO = 8;

/**
 * Target assistant spend for a good run. Placeholder, and unusually
 * loose: this is the widest case in the suite.
 */
export const COST_BASELINE_USD = 0.75;

/** Target conversation wall-clock, in ms. Placeholder. */
export const RUNTIME_BASELINE_MS = 420_000;
