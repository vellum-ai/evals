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
 * Vendors that overcharged but are OUT of scope. Naming any of these in
 * the memo means a constraint was dropped somewhere between the user and
 * the work — exactly the failure this test is built to catch.
 */
export const OUT_OF_SCOPE_OVERCHARGERS = [
  "Halberd Design",
  "Bracken Labs",
  "Wrenfield Legal",
] as const;
