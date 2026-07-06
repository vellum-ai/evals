/**
 * Shared scaffolding for tests that repoint the catalog's EVALS_*_DIR env
 * seams at temp directories. Plain `.ts` (not `.test.ts`) so bun's test
 * discovery never runs it as a suite.
 */
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach } from "bun:test";

const CATALOG_ENV_VARS = [
  "EVALS_PROFILES_DIR",
  "EVALS_TESTS_DIR",
  "EVALS_BENCHMARKS_DIR",
] as const;

type CatalogEnvVar = (typeof CATALOG_ENV_VARS)[number];

/**
 * Snapshot the catalog env seams now and register an afterEach that
 * restores them. Call once at module scope of the test file.
 */
export function restoreCatalogEnvAfterEach(): void {
  const original = new Map<CatalogEnvVar, string | undefined>(
    CATALOG_ENV_VARS.map((key) => [key, process.env[key]]),
  );
  afterEach(() => {
    for (const [key, value] of original) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
}

/** mkdtemp a fresh directory and point the given catalog env seam at it. */
export async function makeTempCatalogDir(
  envVar: CatalogEnvVar,
  prefix: string,
): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), prefix));
  process.env[envVar] = dir;
  return dir;
}

/** Create empty temp benchmarks/profiles dirs and point the env seams at them. */
export async function setupTempDirs(): Promise<{
  benchmarksDir: string;
  profilesDir: string;
}> {
  return {
    benchmarksDir: await makeTempCatalogDir(
      "EVALS_BENCHMARKS_DIR",
      "evals-benchmarks-",
    ),
    profilesDir: await makeTempCatalogDir(
      "EVALS_PROFILES_DIR",
      "evals-profiles-",
    ),
  };
}
