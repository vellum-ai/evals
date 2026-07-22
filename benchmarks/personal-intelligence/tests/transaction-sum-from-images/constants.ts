/**
 * Ground truth for the transaction screenshots. The two fixtures under
 * `assets/` show 12 "MANGIA 23RD" card transactions; these amounts (and the
 * total) must change with the images if the fixtures are ever regenerated.
 *
 * IMG_0821.png (10 rows, incl. a "Pending" row and a bottom row whose date is
 * cut off by the screen edge): 15.48, 18.33, 17.64, 21.34, 41.35, 21.75,
 * 17.03, 25.67, 25.03, 13.72.
 * IMG_0822.jpg (2 rows): 26.85, 12.74.
 */
export const EXPECTED_TOTAL_USD = 256.93;

/** Number of transactions across both screenshots. */
export const EXPECTED_TRANSACTION_COUNT = 12;

/**
 * Workspace-relative filenames the screenshots are staged at before the
 * conversation. Shared by `setup.ts` (which stages them) and the SPEC's
 * file-clarification hint (which points the agent at them).
 */
export const SCREENSHOT_FILENAMES = ["IMG_0821.png", "IMG_0822.jpg"] as const;
