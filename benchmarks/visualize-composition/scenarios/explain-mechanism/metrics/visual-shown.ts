/**
 * Every visualize-composition scenario scores the same five metrics -
 * the scenarios vary the question shape, not what is measured - so the
 * implementations live once under `benchmarks/visualize-composition/src/metrics/`
 * and each scenario re-exports them.
 */
export { default } from "../../../src/metrics/visual-shown";
