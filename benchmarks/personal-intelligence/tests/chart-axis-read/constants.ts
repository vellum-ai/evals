/**
 * Ground truth for the chart case. The figures come from the shared
 * image-extraction fixture, whose `generate.ts` draws the PNG from these
 * same definitions and prints them. Regenerate that way rather than
 * editing here.
 */
import { CHART_ASKED_BAR } from "../../lib/fixtures/image-extraction/content";

export {
  CHART_ASKED_BAR,
  CHART_BARS,
  CHART_IMAGE,
  CHART_TITLE,
  CHART_X_AXIS_LABEL,
  CHART_Y_AXIS_LABEL,
} from "../../lib/fixtures/image-extraction/content";

/** The bar the user asks for by name. */
export const ASKED_BAR_LABEL = CHART_ASKED_BAR.label;

/** That bar's printed value. */
export const ASKED_BAR_VALUE = CHART_ASKED_BAR.value;

/**
 * Bar values are printed to one decimal, so a claim is right only when
 * it carries that decimal: 47 is not 47.3.
 */
export const BAR_VALUE_TOLERANCE = 0.05;
