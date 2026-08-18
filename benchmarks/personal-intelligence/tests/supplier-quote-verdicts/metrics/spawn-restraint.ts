import { makeSpawnRestraintMetric } from "../../../../../src/lib/common-metrics/spawn-restraint";
import { QUOTE_TRUTH, SPAWNS_AT_ZERO, WARRANTED_SPAWNS } from "../constants";

export default makeSpawnRestraintMetric({
  warranted: WARRANTED_SPAWNS,
  zeroAt: SPAWNS_AT_ZERO,
  job: "eight twenty-line quotes with three multiplications each",
  itemNames: QUOTE_TRUTH.map((quote) => quote.supplier),
  itemNoun: "supplier",
});
