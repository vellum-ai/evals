/**
 * Ground truth for the contractor-invoice fixtures. Derived by running
 * `assets/generate.ts`, which writes `assets/invoices/` + `assets/rates.csv`
 * and prints exactly these numbers — regenerate that way rather than
 * editing by hand.
 */

/** Where the audit memo must land in the workspace. */
export const MEMO_PATH = "audit/overcharges.md";

/**
 * The three constraints that exist ONLY in the conversation. None of them
 * is derivable from the workspace, which is the whole point: a subagent
 * sees its briefing and not the chat, so a constraint that never makes it
 * into the `objective` is a constraint the delegate cannot honour.
 *
 * Matched case-insensitively as substrings of the spawn briefings, so
 * each is a short distinctive token rather than a whole sentence.
 */
export const BRIEFING_CONSTRAINTS = ["2026-03-01", "Halberd", "EUR"] as const;

/**
 * Vendors that overcharged WITHIN scope, and by how much in EUR.
 *
 * The fixtures plant one trap per constraint, so the final number is
 * itself a constraint check rather than only an arithmetic one:
 *   - Halberd Design overcharged by 1,020 — excluded by vendor.
 *   - Bracken Labs (400) and Wrenfield Legal (120) overcharged before
 *     the 2026-03-01 renewal — excluded by date.
 * An audit that drops a constraint lands on a visibly different total.
 */
export const OVERCHARGING_VENDORS = [
  "Fen & Marlow",
  "Alder Copy",
  "Corvid Research",
] as const;

/** Per-vendor excess in EUR, same order as OVERCHARGING_VENDORS. */
export const OVERCHARGE_BY_VENDOR: Record<string, number> = {
  "Fen & Marlow": 168,
  "Alder Copy": 84,
  "Corvid Research": 105,
};

/** Total recoverable overcharge in EUR across the in-scope vendors. */
export const TOTAL_OVERCHARGE_EUR = 357;

/**
 * Excluded by VENDOR: Halberd is on a separate retainer, so neither of
 * its invoices is in scope and the user said it should not appear at
 * all. Presenting it as a finding means the vendor constraint was lost.
 *
 * Naming it to record that it was skipped is the opposite signal, and
 * `audit-correct` scores that clean — see `classifyScopeMentions`.
 */
export const VENDOR_EXCLUDED_OVERCHARGERS = ["Halberd Design"] as const;

/**
 * Excluded by DATE, with the pre-renewal excess each one hides.
 *
 * These two are NOT out-of-scope vendors — each also has a post-renewal
 * invoice billed at the agreed rate, so a thorough memo names them
 * legitimately ("Wrenfield Legal's in-scope invoice is clean"). Only
 * claiming the pre-renewal excess means the cutoff was lost, so the
 * amount is the signal here and the name is not. Scoring the name
 * failed a correct memo twice in pod runs before this split existed.
 */
export const DATE_EXCLUDED_OVERCHARGES: Readonly<Record<string, number>> = {
  "Bracken Labs": 400,
  "Wrenfield Legal": 120,
};
