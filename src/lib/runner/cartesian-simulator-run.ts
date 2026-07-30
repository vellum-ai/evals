/**
 * The Cartesian simulator-driven benchmark shape.
 *
 * A benchmark whose units are `TestDef` directories (`SPEC.md` +
 * optional `setup.ts` + `metrics/`) and whose execution is "run every
 * profile against every unit through the LLM user simulator" needs no
 * bespoke runner - it needs this loop. Personal-Intelligence and
 * Visualize-Composition both have exactly that shape, so the loop lives
 * here and each benchmark's `src/run.ts` is a one-line delegation.
 *
 * Benchmarks with a different execution shape (LongMemEval-V2's
 * ingest → ask two-conversation contract, Compaction-Thrash's
 * deterministic tick loop) own their runner instead.
 */
import { randomBytes } from "node:crypto";

import type {
  Benchmark,
  BenchmarkRunInput,
  BenchmarkRunResult,
} from "../benchmark";
import { applyUnitLimit, invokeReportPlanned } from "../benchmark";
import { listBenchmarkUnitIds } from "../catalog";
import { runEvalOnce, wasErrorReportedToProgress } from "./run-once";
import type { EvalProgressReporter } from "./progress";
import { runWithConcurrency } from "./concurrency";
import { loadTestDef } from "../test-def";

/**
 * Run ID suffix used to disambiguate concurrent evals invocations.
 *
 * Same shape and rationale as the CLI helper that wraps this module:
 * `YYYYMMDDhhmmssSSS-XXXX` (17-digit ms-precision timestamp + 4 hex
 * chars of randomness). Lives here because the per-(profile, unit) id is
 * allocated inside this loop - the alternative is to thread a factory
 * through `BenchmarkRunInput`, which is more wiring for the same outcome.
 */
function timestampSuffix(): string {
  const ms = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 17);
  const rand = randomBytes(2).toString("hex");
  return `${ms}-${rand}`;
}

function runId(profileId: string, testId: string, timestamp: string): string {
  return `eval-${profileId}-${testId}-${timestamp}`;
}

/**
 * Emit a structured progress error event for a thrown error unless the
 * underlying runner already did so. Mirrors the V2 runner's catch-path
 * helper - the two implementations should stay in sync.
 */
function reportRunFailure(progress: EvalProgressReporter, err: unknown): void {
  if (wasErrorReportedToProgress(err)) return;
  progress({
    step: "shutdown",
    status: "error",
    message: err instanceof Error ? err.message : String(err),
  });
}

export async function runCartesianSimulatorBenchmark(
  benchmark: Benchmark,
  input: BenchmarkRunInput,
): Promise<BenchmarkRunResult> {
  const {
    profiles,
    filterIds,
    filterFlag,
    limit,
    session,
    sessionLabel,
    cliArgv,
    progress,
  } = input;

  const unitIds =
    filterIds.length > 0
      ? filterIds
      : await listBenchmarkUnitIds(benchmark.unitsDir);
  if (unitIds.length === 0) {
    throw new Error(
      filterFlag !== undefined
        ? "--filter is empty after splitting on commas"
        : `Benchmark "${benchmark.id}" has no ${benchmark.manifest.unitNoun} units at ${benchmark.unitsDir}`,
    );
  }

  const loadedTests = await Promise.all(
    unitIds.map((id) => loadTestDef(id, benchmark.unitsDir)),
  );
  // Experimental units (declared via `status: experimental` in SPEC.md
  // frontmatter) are pending QA and often depend on stubbed fixtures, so
  // default unfiltered runs skip them. An explicit --filter opts in.
  const nonExperimental =
    filterIds.length > 0
      ? loadedTests
      : loadedTests.filter((test) => test.status !== "experimental");
  const tests = applyUnitLimit(nonExperimental, limit);
  if (tests.length === 0) {
    throw new Error(
      `Benchmark "${benchmark.id}" has no non-experimental ${benchmark.manifest.unitNoun} units - pass --filter to run experimental units explicitly`,
    );
  }

  const pairs = profiles.flatMap((profile) =>
    tests.map((test) => ({ profile, test })),
  );

  // Planned-row testId is `test.id` (see invokeReportPlanned's contract).
  await invokeReportPlanned(
    input,
    pairs.map(({ profile, test }) => ({
      testId: test.id,
      profileId: profile.id,
    })),
  );

  // Fan the task list out across `workers` slots. Each unit hatches
  // its own container(s) with a unique runId, so parallel execution is
  // safe as long as the host has the resources.
  const tasks = pairs.map(({ profile, test }) => {
    const id = runId(profile.id, test.id, timestampSuffix());
    return async () => {
      try {
        await runEvalOnce({
          profile,
          test,
          runId: id,
          sessionId: session,
          sessionLabel,
          cliArgv,
          maxTurns: input.maxTurns,
          progress,
        });
      } catch (err) {
        // Per-unit isolation: a crash in one combination (e.g. the
        // user simulator returning unparseable content) shouldn't take
        // down the rest of the suite.
        //
        // The run-once layer normally already writes status:"failed" +
        // error to the run's metadata and emits a red status:"error"
        // progress event with diagnostic details before re-throwing -
        // at which point we just flip the exit-code flag and move on.
        // `wasErrorReportedToProgress` (checked inside
        // `reportRunFailure`) is the explicit signal that path
        // completed. The fallback path exists for "throw bypassed
        // run-once's inner catch" cases (e.g. a future regression
        // moves construction outside the try); emit one line through
        // the same reporter so the operator gets SOMETHING - silent
        // exit with exit-code 1 was the actual diagnostic gap that
        // motivated this guard.
        reportRunFailure(progress, err);
        throw err;
      }
    };
  });

  const { anyFailed } = await runWithConcurrency(tasks, input.workers ?? 1);
  return { anyFailed };
}
