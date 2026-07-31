import { makeScriptReuseMetric } from "../../../../../src/lib/common-metrics/script-reuse";
import {
  SCRIPT_FILENAME,
  SCRIPT_OUTPUT_MARKER,
  SCRIPT_SUCCESS_STDOUT,
  WEEK8_RECAP_PATH,
} from "../constants";

/**
 * Did the week-8 run execute the proven `weekly_recap.ts` generator
 * rather than re-deriving the recap ad hoc?
 */
export default makeScriptReuseMetric({
  scriptFilename: SCRIPT_FILENAME,
  executionStdout: SCRIPT_SUCCESS_STDOUT,
  outputPath: WEEK8_RECAP_PATH,
  outputMarker: SCRIPT_OUTPUT_MARKER,
});
