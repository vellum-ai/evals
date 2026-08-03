import { makeScriptReuseMetric } from "../../../../../src/lib/common-metrics/script-reuse";
import {
  EP19_SHOWNOTES_PATH,
  SCRIPT_FILENAME,
  SCRIPT_OUTPUT_MARKER,
  SCRIPT_SUCCESS_STDOUT,
} from "../constants";

/**
 * Did the SECOND performance (episode 19) execute the proven pipeline?
 * The agent has already met the procedure once by now; imitating the
 * format by hand on the repeat is exactly the drift this test exists to
 * expose.
 */
export default makeScriptReuseMetric({
  name: "repeat-run-reuses-script",
  scriptFilename: SCRIPT_FILENAME,
  executionStdout: SCRIPT_SUCCESS_STDOUT,
  outputPath: EP19_SHOWNOTES_PATH,
  outputMarker: SCRIPT_OUTPUT_MARKER,
});
