/**
 * Benchmark — declarative top-level unit of evaluation.
 *
 * Each benchmark lives at `benchmarks/<id>/` with:
 *   - `manifest.json` — display name + the directory + noun describing its units
 *   - `<unitDirName>/` — one subdirectory per individual unit (e.g. `tests/`,
 *     `items/`); the shape of a unit is defined per-benchmark.
 *
 * The benchmark id is the directory name. The manifest does not declare it,
 * matching the `Profile` convention.
 *
 * Personal-Intelligence is our in-house benchmark; LongMemEval-V2 and other
 * public suites live as peers under `benchmarks/`. The harness picks one via
 * `evals run --benchmark <id>`.
 */
import { readFile } from "node:fs/promises";
import { z } from "zod";

import { assertSafeId, getBenchmarksDir, resolveUnder } from "./catalog";
import type { Profile } from "./profile";
import type { EvalProgressReporter } from "./runner/progress";

/** Same shape as profile/test ids — directory-safe lowercase + hyphens. */
const SAFE_DIR_NAME = /^[a-z0-9][a-z0-9-]*$/;
/** Singular noun: lowercase letters/hyphens, no digits, no leading hyphen. */
const SAFE_NOUN = /^[a-z][a-z-]*$/;

export const BenchmarkManifestSchema = z.object({
  /**
   * Human-readable name shown in `evals benchmarks list` and help text.
   * Example: "Personal Intelligence", "LongMemEval v2".
   */
  displayName: z.string().min(1),
  /**
   * Directory under the benchmark root that holds individual units.
   * `personal-intelligence` uses `tests`; `longmemeval-v2` will use `items`.
   * Each benchmark picks the name that matches its vocabulary.
   */
  unitDirName: z.string().regex(SAFE_DIR_NAME),
  /**
   * Singular noun for one unit ("test", "item", "question"). Drives CLI
   * help text and listing-output column labels so each benchmark speaks
   * its own vocabulary.
   */
  unitNoun: z.string().regex(SAFE_NOUN),
});

export type BenchmarkManifest = z.infer<typeof BenchmarkManifestSchema>;

/**
 * One planned (test, profile) execution in a benchmark run. `testId`
 * is the id the benchmark later stamps into that unit's `RunMetadata`
 * (`test.id` for personal-intelligence, `item.questionId` for
 * longmemeval-v2, `scenarioId` for compaction-thrash) — consumers
 * match `execution_*` events to planned rows by `(testId, profileId)`.
 */
export interface PlannedExecution {
  testId: string;
  profileId: string;
}

/**
 * Shared input to every benchmark's `run()` method. The CLI builds one
 * of these from its parsed options and hands it to `benchmark.run()` —
 * each benchmark module decides how to translate it into a concrete
 * execution plan (Cartesian profile × test for PI; profile × question
 * with shared trajectory map for V2; …).
 *
 * Benchmark-specific knobs (env vars, dataset roots, tier selection,
 * cache toggles) are read inside each benchmark's `run()` so this
 * shape stays narrow and stable. The one CLI-level knob that flows
 * through is `maxTurns`, because it's literally a `--max-turns` CLI
 * flag and benchmarks that don't honor it just ignore it.
 */
export interface BenchmarkRunInput {
  /** Profiles to evaluate against the benchmark. */
  profiles: Profile[];
  /** Parsed --filter ids; empty when --filter wasn't supplied. */
  filterIds: string[];
  /**
   * Original --filter flag value, kept around so benchmarks can
   * distinguish "operator supplied --filter and got zero matches"
   * from "operator didn't filter and the dataset is empty" — the two
   * cases produce different error messages.
   */
  filterFlag: string | undefined;
  /**
   * Parsed --limit value; `undefined` when the flag wasn't supplied.
   * Truncates the selected units to the first N in the benchmark's
   * natural order, after any --filter selection. Validated by the CLI
   * to be a positive integer. Apply via {@link applyUnitLimit} so every
   * benchmark shares the same semantics.
   */
  limit: number | undefined;
  /** Session id stamped onto every (profile, unit) execution. */
  session: string;
  /** Optional human-readable label associated with this session. */
  sessionLabel: string | undefined;
  /**
   * `process.argv` captured at the top of the `evals run` invocation.
   * Forwarded to each benchmark so it can stamp the originating CLI
   * command onto every `RunMetadata` it writes. Undefined when the
   * runner is invoked programmatically (no real CLI argv to record).
   */
  cliArgv: string[] | undefined;
  /** Progress reporter — the same one the CLI built. */
  progress: EvalProgressReporter;
  /**
   * Maximum simulator turns per run. Personal-Intelligence honors
   * this; benchmarks that don't drive a simulator (e.g. V2's
   * ingest→ask flow) ignore it.
   */
  maxTurns: number | undefined;
  /**
   * Number of concurrent worker slots for the profile x unit loop.
   * `undefined` or `1` means sequential (the default). Benchmarks
   * use {@link runWithConcurrency} to fan out — each unit hatches its
   * own container(s), so parallelism is safe as long as the host has
   * the resources.
   */
  workers: number | undefined;
  /**
   * Optional hook announcing the run's full planned test×profile
   * matrix. `undefined` in local runs — benchmarks must tolerate its
   * absence. Benchmarks invoke it via {@link invokeReportPlanned},
   * whose doc comment is the canonical description of when the hook
   * fires and its await/fail-soft contract.
   */
  reportPlanned?: (planned: PlannedExecution[]) => void | Promise<void>;
}

/**
 * Truncate a benchmark's selected units to the first `limit` in their
 * natural order. Shared by every benchmark's `run()` so `--limit N`
 * means the same thing everywhere: it applies AFTER --filter selection
 * (and after any default exclusions like experimental units), and a
 * limit larger than the selection is a no-op rather than an error.
 */
export function applyUnitLimit<T>(units: T[], limit: number | undefined): T[] {
  if (limit === undefined) return units;
  return units.slice(0, limit);
}

/**
 * Invoke a benchmark input's optional {@link BenchmarkRunInput.reportPlanned}
 * hook. Shared by every benchmark's `run()` so the seam has one contract:
 *
 * - Called at most once per run, after unit selection
 *   (filter/experimental-exclusion/limit applied) and before the first
 *   execution starts, so callers (e.g. the qa-dashboard live-events wiring
 *   in `commands/run.ts`) can render pending rows up front.
 * - Each planned row's `testId` is the same id the runner stamps into that
 *   unit's `RunMetadata`, so live-progress consumers can match execution
 *   events to planned rows by (testId, profileId).
 * - The invocation is awaited — an async reporter (e.g. one persisting a
 *   `run_started` event) settles before the first execution starts and is
 *   never left unhandled — but a throwing/rejecting reporter is logged and
 *   never aborts the run: the hook is an inert observability seam, not a
 *   gate.
 */
export async function invokeReportPlanned(
  input: Pick<BenchmarkRunInput, "reportPlanned">,
  planned: PlannedExecution[],
): Promise<void> {
  try {
    await input.reportPlanned?.(planned);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`[evals] reportPlanned reporter failed: ${message}`);
  }
}

/** Result of a `benchmark.run()` invocation. */
export interface BenchmarkRunResult {
  /** True if any (profile, unit) execution surfaced as failed. */
  anyFailed: boolean;
}

/**
 * Signature each benchmark module's `run()` export must satisfy.
 * Receives the loaded `Benchmark` instance so handlers can read
 * `unitsDir`, `id`, etc., without re-loading the manifest.
 */
export type BenchmarkRunFn = (
  benchmark: Benchmark,
  input: BenchmarkRunInput,
) => Promise<BenchmarkRunResult>;

export interface Benchmark {
  /** Directory name under `benchmarks/`. */
  id: string;
  manifest: BenchmarkManifest;
  /** Absolute path to `benchmarks/<id>/<unitDirName>/`. */
  unitsDir: string;
  /**
   * Execute every (profile × unit) combination for this benchmark.
   * The implementation lives at `benchmarks/<id>/src/run.ts` — that
   * file owns this benchmark's execution shape (Cartesian over
   * `TestDef`s, or over V2's `BenchmarkItem`s with pre-staged
   * trajectory files, or whatever the next benchmark needs).
   */
  run(input: BenchmarkRunInput): Promise<BenchmarkRunResult>;
}

/**
 * Resolve each benchmark's run module by convention:
 * `benchmarks/<id>/src/run.ts` must export a `run` function with the
 * `BenchmarkRunFn` signature. Adding a new benchmark means dropping
 * a `src/run.ts` next to its `manifest.json` — no central registry,
 * no DI wiring (see `software-engineering/dependencies.md`).
 *
 * `id` is validated by `assertSafeId` (called before this function in
 * `loadBenchmark`), so the template literal cannot escape the
 * benchmarks directory at runtime.
 */
async function loadBenchmarkRunFn(id: string): Promise<BenchmarkRunFn> {
  let mod: { run?: unknown };
  try {
    // Dynamic import is the *one* legitimate exception called out in
    // the anti-DI guidance: conditional loading by benchmark id. The
    // path is bounded by `assertSafeId`.
    mod = (await import(`../../benchmarks/${id}/src/run.ts`)) as {
      run?: unknown;
    };
  } catch (err) {
    throw new Error(
      `Benchmark "${id}" is missing a run module at benchmarks/${id}/src/run.ts: ` +
        `${(err as Error).message}`,
    );
  }
  if (typeof mod.run !== "function") {
    throw new Error(
      `Benchmark "${id}"'s run module at benchmarks/${id}/src/run.ts ` +
        `does not export a "run" function.`,
    );
  }
  return mod.run as BenchmarkRunFn;
}

/**
 * Read + validate `benchmarks/<id>/manifest.json`. Shared by
 * `loadBenchmark` and callers that need the manifest without loading the
 * benchmark's run module (e.g. the catalog-artifact builder, where the
 * dynamic import of `benchmarks/<id>/src/run.ts` would break under the
 * `EVALS_BENCHMARKS_DIR` test seam and needlessly load run modules).
 */
export async function readBenchmarkManifest(
  id: string,
  manifestPath: string,
): Promise<BenchmarkManifest> {
  let raw: string;
  try {
    raw = await readFile(manifestPath, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      throw new Error(`Benchmark "${id}" not found — expected ${manifestPath}`);
    }
    throw new Error(
      `Failed to read benchmark "${id}" manifest at ${manifestPath}: ${(err as Error).message}`,
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(
      `Benchmark "${id}" manifest at ${manifestPath} is not valid JSON: ${(err as Error).message}`,
    );
  }

  const result = BenchmarkManifestSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join(".") || "<root>"}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Benchmark "${id}" manifest at ${manifestPath} failed schema validation:\n${issues}`,
    );
  }

  return result.data;
}

export async function loadBenchmark(id: string): Promise<Benchmark> {
  assertSafeId("benchmark", id);
  const base = getBenchmarksDir();
  const manifestPath = resolveUnder(base, id, "manifest.json");

  const manifest = await readBenchmarkManifest(id, manifestPath);
  const unitsDir = resolveUnder(base, id, manifest.unitDirName);

  const runFn = await loadBenchmarkRunFn(id);
  const benchmark: Benchmark = {
    id,
    manifest,
    unitsDir,
    // Bind `runFn` to *this* benchmark instance so callers can write
    // `await benchmark.run({...})` without having to thread the
    // benchmark back into a free function.
    run: (input) => runFn(benchmark, input),
  };
  return benchmark;
}
