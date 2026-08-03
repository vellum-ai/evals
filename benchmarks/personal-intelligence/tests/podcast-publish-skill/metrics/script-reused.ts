import { makeScriptReuseMetric } from "../../../../../src/lib/common-metrics/script-reuse";
import {
  EP18_SHOWNOTES_PATH,
  SCRIPT_FILENAME,
  SCRIPT_OUTPUT_MARKER,
  SCRIPT_SUCCESS_STDOUT,
} from "../constants";

/**
 * Did the episode-18 run execute the proven `build_shownotes.ts` pipeline
 * rather than re-deriving the format by hand?
 */
export default makeScriptReuseMetric({
  scriptFilename: SCRIPT_FILENAME,
  executionStdout: SCRIPT_SUCCESS_STDOUT,
  outputPath: EP18_SHOWNOTES_PATH,
  outputMarker: SCRIPT_OUTPUT_MARKER,
});
