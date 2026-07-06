import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import { buildCatalogArtifact } from "../catalog-artifact";
import {
  restoreCatalogEnvAfterEach,
  setupTempDirs,
} from "./helpers/catalog-dirs";

restoreCatalogEnvAfterEach();

async function makeBenchmark(
  benchmarksDir: string,
  id: string,
  manifest: unknown,
): Promise<string> {
  const dir = join(benchmarksDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "manifest.json"),
    typeof manifest === "string" ? manifest : JSON.stringify(manifest),
    "utf8",
  );
  return dir;
}

async function makeProfile(
  profilesDir: string,
  id: string,
  species: string,
): Promise<void> {
  const dir = join(profilesDir, id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "manifest.json"),
    JSON.stringify({ species }),
    "utf8",
  );
}

describe("buildCatalogArtifact", () => {
  test("builds the full artifact shape with default flag and units", async () => {
    const { benchmarksDir, profilesDir } = await setupTempDirs();

    const piDir = await makeBenchmark(benchmarksDir, "personal-intelligence", {
      displayName: "PI",
      unitDirName: "tests",
      unitNoun: "test",
    });
    await mkdir(join(piDir, "tests", "alpha"), { recursive: true });
    await mkdir(join(piDir, "tests", "beta"), { recursive: true });

    const otherDir = await makeBenchmark(benchmarksDir, "other-bench", {
      displayName: "Other",
      unitDirName: "units",
      unitNoun: "unit",
    });
    await mkdir(join(otherDir, "units"), { recursive: true });

    await makeProfile(profilesDir, "vellum-default", "vellum");
    await makeProfile(profilesDir, "hermes-default", "hermes");

    const artifact = await buildCatalogArtifact({
      gitSha: "abc123",
      imageTag: "abc123",
      generatedAt: "2026-07-06T00:00:00.000Z",
    });

    expect(artifact).toEqual({
      generatedAt: "2026-07-06T00:00:00.000Z",
      gitSha: "abc123",
      imageTag: "abc123",
      benchmarks: [
        { id: "other-bench", default: false, units: [] },
        {
          id: "personal-intelligence",
          default: true,
          units: ["alpha", "beta"],
        },
      ],
      profiles: [
        { id: "hermes-default", species: "hermes" },
        { id: "vellum-default", species: "vellum" },
      ],
    });
  });

  test("units is null when the declared units dir is missing on disk", async () => {
    const { benchmarksDir } = await setupTempDirs();

    // The real longmemeval-v2 shape: manifest declares `items` but the
    // directory only exists once the gitignored dataset is downloaded.
    await makeBenchmark(benchmarksDir, "longmemeval-v2", {
      displayName: "LongMemEval v2",
      unitDirName: "items",
      unitNoun: "question",
    });

    const artifact = await buildCatalogArtifact({
      gitSha: "sha",
      imageTag: "tag",
      generatedAt: "2026-07-06T00:00:00.000Z",
    });

    expect(artifact.benchmarks).toEqual([
      { id: "longmemeval-v2", default: false, units: null },
    ]);
  });

  test("rejects loudly on a malformed benchmark manifest", async () => {
    const { benchmarksDir } = await setupTempDirs();

    await makeBenchmark(benchmarksDir, "broken-bench", "{ not json");

    await expect(
      buildCatalogArtifact({
        gitSha: "sha",
        imageTag: "tag",
        generatedAt: "2026-07-06T00:00:00.000Z",
      }),
    ).rejects.toThrow(/Benchmark "broken-bench" manifest .* is not valid JSON/);
  });

  test("survives a JSON round-trip unchanged", async () => {
    const { benchmarksDir, profilesDir } = await setupTempDirs();

    const piDir = await makeBenchmark(benchmarksDir, "personal-intelligence", {
      displayName: "PI",
      unitDirName: "tests",
      unitNoun: "test",
    });
    await mkdir(join(piDir, "tests", "alpha"), { recursive: true });
    await makeBenchmark(benchmarksDir, "longmemeval-v2", {
      displayName: "LongMemEval v2",
      unitDirName: "items",
      unitNoun: "question",
    });
    await makeProfile(profilesDir, "vellum-default", "vellum");

    const artifact = await buildCatalogArtifact({
      gitSha: "sha",
      imageTag: "tag",
      generatedAt: "2026-07-06T00:00:00.000Z",
    });

    expect(JSON.parse(JSON.stringify(artifact))).toEqual(artifact);
  });
});
