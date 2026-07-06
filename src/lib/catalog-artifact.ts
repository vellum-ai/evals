/**
 * Catalog artifact — the machine-readable benchmark/profile inventory
 * published alongside each eval-pod image (`eval-catalog/latest.json` +
 * `eval-catalog/<sha>.json` in the qa results bucket).
 *
 * The shapes below are a frozen contract consumed by the qa dashboard's
 * eval-trigger panel; changing them requires coordinating with that
 * consumer. `buildCatalogArtifact` is pure with respect to its inputs —
 * the caller supplies `generatedAt`/`gitSha`/`imageTag`; only benchmark
 * and profile discovery reads the filesystem (honoring the
 * `EVALS_BENCHMARKS_DIR` / `EVALS_PROFILES_DIR` overrides).
 */
import { readFile, stat } from "node:fs/promises";

import { BenchmarkManifestSchema } from "./benchmark";
import {
  DEFAULT_BENCHMARK_ID,
  getBenchmarksDir,
  listBenchmarkIds,
  listBenchmarkUnitIds,
  listProfileIds,
  resolveUnder,
} from "./catalog";
import { loadProfile } from "./profile";

export interface CatalogBenchmark {
  id: string;
  default: boolean;
  /** Unit ids for the dashboard filter field; null when enumeration
   *  requires data not present in CI (units dir missing on disk). */
  units: string[] | null;
}

export interface CatalogProfile {
  id: string;
  species: string;
}

export interface CatalogArtifact {
  generatedAt: string;
  gitSha: string;
  imageTag: string;
  benchmarks: CatalogBenchmark[];
  profiles: CatalogProfile[];
}

export interface BuildCatalogArtifactInput {
  gitSha: string;
  imageTag: string;
  /** ISO timestamp, supplied by the caller (keeps the builder pure). */
  generatedAt: string;
}

/**
 * Read + validate a benchmark's manifest without `loadBenchmark`, which
 * dynamically imports `benchmarks/<id>/src/run.ts` relative to `src/lib/`
 * — that breaks under the `EVALS_BENCHMARKS_DIR` test seam and needlessly
 * loads run modules. Error messages mirror `loadBenchmark`'s so a broken
 * manifest fails the catalog build loudly with familiar diagnostics.
 */
async function readBenchmarkManifest(id: string, manifestPath: string) {
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

/** Unit ids for a benchmark, or null when its units dir is absent on disk
 *  (e.g. longmemeval-v2, whose unit ids come from the gitignored dataset). */
async function listUnitsOrNull(unitsDir: string): Promise<string[] | null> {
  try {
    await stat(unitsDir);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return null;
    throw new Error(
      `Failed to stat benchmark units directory at ${unitsDir}: ${(err as Error).message}`,
    );
  }
  return listBenchmarkUnitIds(unitsDir);
}

export async function buildCatalogArtifact(
  input: BuildCatalogArtifactInput,
): Promise<CatalogArtifact> {
  const benchmarksDir = getBenchmarksDir();
  const benchmarks: CatalogBenchmark[] = [];
  for (const id of await listBenchmarkIds()) {
    const manifestPath = resolveUnder(benchmarksDir, id, "manifest.json");
    const manifest = await readBenchmarkManifest(id, manifestPath);
    const unitsDir = resolveUnder(benchmarksDir, id, manifest.unitDirName);
    benchmarks.push({
      id,
      default: id === DEFAULT_BENCHMARK_ID,
      units: await listUnitsOrNull(unitsDir),
    });
  }

  const profiles: CatalogProfile[] = [];
  for (const id of await listProfileIds()) {
    const profile = await loadProfile(id);
    profiles.push({ id, species: profile.manifest.species });
  }

  return {
    generatedAt: input.generatedAt,
    gitSha: input.gitSha,
    imageTag: input.imageTag,
    benchmarks,
    profiles,
  };
}
