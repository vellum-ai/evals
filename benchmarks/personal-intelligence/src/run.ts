/**
 * Personal-Intelligence benchmark - top-level execution.
 *
 * The in-house benchmark the harness was originally built around. Its
 * execution shape is the Cartesian profile × `TestDef` loop through the
 * simulator-backed `runEvalOnce` runner, which
 * `runCartesianSimulatorBenchmark` owns and every simulator-driven
 * benchmark shares. The polymorphic `benchmark.run()` contract (see
 * `src/lib/benchmark.ts`) is what lets the CLI dispatch to this or to a
 * benchmark with a bespoke runner without an `if (id === …)` ladder.
 */
export { runCartesianSimulatorBenchmark as run } from "../../../src/lib/runner/cartesian-simulator-run";
