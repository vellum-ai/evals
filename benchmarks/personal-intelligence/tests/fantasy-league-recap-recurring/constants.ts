/**
 * Ground truth for the fantasy-league fixtures. Derived from actually
 * running `assets/weekly_recap.ts 8` over `assets/scores/` — if the score
 * CSVs or the script change, regenerate these constants the same way
 * rather than editing them by hand.
 */

/** Bare filename of the recap script, for reuse-evidence greps. */
export const SCRIPT_FILENAME = "weekly_recap.ts";

/** Where the week-8 deliverable must land in the workspace. */
export const WEEK8_RECAP_PATH = "recaps/week_8.md";

/**
 * Success line the script prints to stdout for week 8. Never appears in
 * its output files, so seeing it in a tool result proves execution.
 */
export const SCRIPT_SUCCESS_STDOUT = "wrote recaps/week_8.md";

/** Version marker the script stamps into every recap it writes. */
export const SCRIPT_OUTPUT_MARKER = "<!-- weekly_recap.ts v7 -->";

/**
 * Week-8 standings in exact league order. Two planted traps make this
 * order underivable without the script's tiebreak rules (head-to-head,
 * then FEWEST points against — never points-for):
 *
 *   - #1/#2: Draft Punk and Victory Formation are both 6-2; Draft Punk
 *     ranks first only on head-to-head — Victory Formation has the far
 *     better points-against, so a fewest-points-against-first sort flips
 *     them. (Points-for happens to agree with head-to-head on this pair;
 *     the PF trap is the #5/#6 pair below.)
 *   - #5/#6: Bench Mob and Punt Intended are both 4-4 and never met;
 *     Bench Mob ranks fifth on fewer points against while having LOWER
 *     points-for, so a points-for sort flips them too.
 */
export const WEEK8_STANDINGS_ORDER = [
  "Draft Punk",
  "Victory Formation",
  "Turbo Turtles",
  "Gravy Boat Captains",
  "Bench Mob",
  "Punt Intended",
  "Hail Mary Herd",
  "The Replacements",
  "Monday Morning QBs",
  "Waiver Wire Wizards",
];

/** Lowest week-8 scorer (74.2 points), uniquely determined. */
export const WEEK8_SACKO = "Punt Intended";

/** Unique longest active win streak after week 8 (3 straight). */
export const WEEK8_JUGGERNAUT = "Turbo Turtles";
