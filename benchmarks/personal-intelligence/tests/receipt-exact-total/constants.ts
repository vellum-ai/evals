/**
 * Ground truth for the receipt case. The figures come from the shared
 * image-extraction fixture, whose `generate.ts` draws the PNG from these
 * same definitions and prints them. Regenerate that way rather than
 * editing here.
 */
import {
  RECEIPT_LINE_ITEM_COUNT,
  RECEIPT_SUBTOTAL_CENTS,
  RECEIPT_TAX_CENTS,
  RECEIPT_TOTAL_CENTS,
  RECEIPT_TOTAL_QUANTITY,
} from "../../lib/fixtures/image-extraction/content";

export {
  RECEIPT_IMAGE,
  RECEIPT_LINE_ITEM_COUNT,
  RECEIPT_LINE_ITEMS,
  RECEIPT_TOTAL_QUANTITY,
} from "../../lib/fixtures/image-extraction/content";

/** The printed TOTAL, in dollars. The figure the case turns on. */
export const EXPECTED_TOTAL_USD = RECEIPT_TOTAL_CENTS / 100;

/** The printed SUBTOTAL, in dollars. A near miss, not the answer. */
export const SUBTOTAL_USD = RECEIPT_SUBTOTAL_CENTS / 100;

/** The printed tax, in dollars. */
export const TAX_USD = RECEIPT_TAX_CENTS / 100;

/** How many product rows the receipt lists. */
export const EXPECTED_LINE_ITEM_COUNT = RECEIPT_LINE_ITEM_COUNT;

/**
 * The number a run that sums the quantity column instead of counting
 * rows reports. Named in the count metric's reason so a wrong answer is
 * legible as that specific mistake rather than as noise.
 */
export const SUMMED_QUANTITY = RECEIPT_TOTAL_QUANTITY;
