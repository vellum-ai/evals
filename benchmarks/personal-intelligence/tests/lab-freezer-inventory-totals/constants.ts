/**
 * Ground truth for the freezer-manifest fixtures. Derived by running
 * `bun assets/generate.ts`, which writes `assets/manifests/` and prints
 * exactly these numbers — regenerate that way rather than editing here.
 */

/** Where the totals memo must land. */
export const TOTALS_PATH = "inventory/totals.md";

/** How many team manifests are staged. */
export const MANIFEST_COUNT = 15;

/** Correct per-reagent totals in µL, deduped and unit-converted. */
export const REAGENT_TOTALS_UL: Record<string, number> = {
  "Tris-HCl": 2850,
  EDTA: 2975,
  SDS: 3100,
  Glycerol: 3000,
};

/** Correct grand total in µL. */
export const GRAND_TOTAL_UL = 11925;

/**
 * The two defects planted in the data. Both are the kind a delegate
 * reproduces faithfully if nobody checks its arithmetic against the
 * source, and both change the answer:
 *
 *   - S-006 appears in team-02 and again in team-11 (the box moved
 *     shelves). One physical sample, counted twice.
 *   - team-09 recorded in mL while the other fourteen used µL. Same
 *     column, different scale — a 1000x error per row.
 *
 * Summing the numbers as written gives 11250.775, whose stray decimal is
 * itself the tell that the units were never reconciled.
 */
export const DUPLICATE_SAMPLE_ID = "S-006";
export const MISMATCHED_UNIT_TEAM = "team-09";
export const NAIVE_SUM_IF_TRAPS_MISSED = 11250.775;
