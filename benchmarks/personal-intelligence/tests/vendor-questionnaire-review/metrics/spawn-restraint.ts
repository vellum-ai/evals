import { makeSpawnRestraintMetric } from "../../../../../src/lib/common-metrics/spawn-restraint";
import { SPAWNS_AT_ZERO, VENDOR_TRUTH, WARRANTED_SPAWNS } from "../constants";

export default makeSpawnRestraintMetric({
  warranted: WARRANTED_SPAWNS,
  zeroAt: SPAWNS_AT_ZERO,
  job: "a thousand lines of questionnaire across eight files",
  itemNames: VENDOR_TRUTH.map((vendor) => vendor.vendor),
  itemNoun: "vendor",
});
