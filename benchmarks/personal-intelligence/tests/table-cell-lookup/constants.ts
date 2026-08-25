/**
 * Ground truth for the table case. The figures come from the shared
 * image-extraction fixture, whose `generate.ts` draws the PNG from these
 * same definitions and prints them. Regenerate that way rather than
 * editing here.
 */
import {
  TABLE_COLUMNS,
  TABLE_HIGHEST_Q3,
} from "../../lib/fixtures/image-extraction/content";

export {
  TABLE_DECIMAL_CELL,
  TABLE_IMAGE,
  TABLE_NEGATIVE_CELL,
  TABLE_ROWS,
  TABLE_TITLE,
} from "../../lib/fixtures/image-extraction/content";

/** The region holding the largest Q3 figure. */
export const HIGHEST_Q3_REGION = TABLE_HIGHEST_Q3.region;

/** That region's Q3 figure, for the metric's reason line. */
export const HIGHEST_Q3_VALUE =
  TABLE_HIGHEST_Q3.values[TABLE_COLUMNS.indexOf("Q3")];

/**
 * Cell lookups are exact: the values are printed to two decimals, so a
 * claim is either the printed number or a different one.
 */
export const CELL_TOLERANCE = 0.005;
