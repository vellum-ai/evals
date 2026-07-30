/**
 * Visualize-Composition benchmark - top-level execution.
 *
 * Each scenario is a single-turn conversation: the simulator asks one
 * natural question and stops. That is exactly the Cartesian profile ×
 * `TestDef` shape the shared simulator runner already implements, so
 * this benchmark contributes scenarios and metrics, not a runner.
 *
 * The variation under test lives in the *profiles* (which `visualize`
 * SKILL.md the assistant sees), not in the execution loop.
 */
export { runCartesianSimulatorBenchmark as run } from "../../../src/lib/runner/cartesian-simulator-run";
