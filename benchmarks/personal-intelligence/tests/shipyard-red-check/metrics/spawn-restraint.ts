import { makeSpawnRestraintMetric } from "../../../../../src/lib/common-metrics/spawn-restraint";
import { PACKAGE_NAMES, SPAWNS_AT_ZERO, WARRANTED_SPAWNS } from "../constants";

export default makeSpawnRestraintMetric({
  warranted: WARRANTED_SPAWNS,
  zeroAt: SPAWNS_AT_ZERO,
  job: "a two-line fix the check script points straight at",
  itemNames: PACKAGE_NAMES,
  itemNoun: "package",
});
