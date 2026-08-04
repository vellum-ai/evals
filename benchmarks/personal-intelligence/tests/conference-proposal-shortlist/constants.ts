/**
 * Ground truth for the Northsend CFP fixtures. Regenerate with
 * `bun assets/generate.ts`, which writes `assets/proposals/` and prints
 * these ids — never hand-edit them.
 */

/** Where the shortlist deliverable must land. */
export const SHORTLIST_PATH = "shortlist.md";

/** The sponsor blurb phase 2 asks to correct. */
export const BLURB_PATH = "sponsor-blurb.md";

/** How many proposals are staged. Phase 1's job is wide by construction. */
export const PROPOSAL_COUNT = 38;

/**
 * The five vendor pitches hidden in the pile. Each names a product and
 * tells the reader to book a demo, so "is this a pitch" needs no
 * judgement call and the metric grades recall rather than taste.
 */
export const PITCH_IDS = [
  "cfp-004",
  "cfp-011",
  "cfp-019",
  "cfp-026",
  "cfp-033",
] as const;

/** The wrong date currently in the blurb. */
export const BLURB_WRONG_DATE = "March 14";

/** What phase 2 asks for instead. */
export const BLURB_RIGHT_DATE = "March 21";
