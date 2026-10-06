/**
 * Ground truth for the questionnaire-review case. The answers come from
 * the shared vendor-questionnaires fixture, whose `generate.ts` writes
 * the files and prints the key. Regenerate that way rather than editing
 * here.
 */
export {
  CLEAN_VENDORS,
  NO_ENCRYPTION_AT_REST,
  QUESTIONNAIRES_DIR,
  VENDOR_COUNT,
  VENDOR_TRUTH,
  type VendorTruth,
} from "../../lib/fixtures/vendor-questionnaires/truth";

/** The file the user asks for, workspace-relative. */
export const REVIEW_FILE = "vendor-review.md";

/**
 * How many subagents this task is worth.
 *
 * One, not zero. Eight questionnaires at about 130 lines each is a
 * thousand lines of reading, and handing that whole pass to a single
 * worker so the parent keeps a clean context is a defensible call —
 * exactly the "extensive, would flood the parent context" case the
 * assistant's own guidance describes. What is not defensible is a worker
 * per vendor: eight briefings, eight fresh contexts and eight read-backs
 * for eight files one agent can hold at once.
 */
export const WARRANTED_SPAWNS = 1;

/**
 * The spawn count at which the score reaches zero. Five is a per-vendor
 * fan-out under way: more than half the documents handed out.
 */
export const SPAWNS_AT_ZERO = 5;

/**
 * Target assistant spend for a good run. Placeholder. Calibrate to the
 * observed post-run median after the first real runs.
 */
export const COST_BASELINE_USD = 0.35;

/**
 * Target conversation wall-clock for a good run, in ms. Placeholder.
 * Calibrate to the observed post-run median after the first real runs.
 */
export const RUNTIME_BASELINE_MS = 240_000;
