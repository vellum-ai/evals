import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, test } from "bun:test";

import {
  listBenchmarkIds,
  listBenchmarkUnitIds,
  listProfileIds,
  listTestIds,
} from "../catalog";
import { loadProfile } from "../profile";
import { loadTestDef } from "../test-def";
import {
  makeTempCatalogDir,
  restoreCatalogEnvAfterEach,
} from "./helpers/catalog-dirs";

restoreCatalogEnvAfterEach();

describe("eval catalog discovery", () => {
  test("lists profile directories alphabetically and validates manifests", async () => {
    const dir = await makeTempCatalogDir(
      "EVALS_PROFILES_DIR",
      "evals-profiles-",
    );

    await mkdir(join(dir, "zeta"), { recursive: true });
    await mkdir(join(dir, "alpha"), { recursive: true });
    await mkdir(join(dir, ".ignored"), { recursive: true });
    await writeFile(
      join(dir, "zeta", "manifest.json"),
      JSON.stringify({ species: "vellum" }),
      "utf8",
    );
    await writeFile(
      join(dir, "alpha", "manifest.json"),
      JSON.stringify({ species: "codex" }),
      "utf8",
    );

    expect(await listProfileIds()).toEqual(["alpha", "zeta"]);
    await expect(loadProfile("alpha")).resolves.toMatchObject({
      id: "alpha",
      manifest: { species: "codex" },
    });
  });

  test("accepts branding on a profile manifest and rejects bad colors", async () => {
    const dir = await makeTempCatalogDir(
      "EVALS_PROFILES_DIR",
      "evals-profiles-",
    );

    await mkdir(join(dir, "branded"), { recursive: true });
    await writeFile(
      join(dir, "branded", "manifest.json"),
      JSON.stringify({
        species: "hermes",
        branding: { color: "#C0714F", logo: "<svg></svg>" },
      }),
      "utf8",
    );
    await expect(loadProfile("branded")).resolves.toMatchObject({
      manifest: { branding: { color: "#C0714F", logo: "<svg></svg>" } },
    });

    await mkdir(join(dir, "badcolor"), { recursive: true });
    await writeFile(
      join(dir, "badcolor", "manifest.json"),
      JSON.stringify({ species: "hermes", branding: { color: "red" } }),
      "utf8",
    );
    await expect(loadProfile("badcolor")).rejects.toThrow(
      /branding\.color must be a 6-digit hex/,
    );
  });

  test("rejects unsafe catalog ids discovered on disk", async () => {
    const dir = await makeTempCatalogDir(
      "EVALS_PROFILES_DIR",
      "evals-profiles-",
    );
    await mkdir(join(dir, "bad_id"), { recursive: true });

    await expect(listProfileIds()).rejects.toThrow("Invalid profile id");
  });

  test("lists tests and loads setup plus metric files", async () => {
    const dir = await makeTempCatalogDir("EVALS_TESTS_DIR", "evals-tests-");
    await mkdir(join(dir, "timeline-recall", "metrics"), { recursive: true });
    await writeFile(join(dir, "timeline-recall", "SPEC.md"), "# spec", "utf8");
    await writeFile(
      join(dir, "timeline-recall", "setup.ts"),
      'export default [{ type: "seed-conversation", messages: [] }];',
      "utf8",
    );
    await writeFile(
      join(dir, "timeline-recall", "metrics", "score.ts"),
      "export default async () => ({ name: 'score', score: 1 });",
      "utf8",
    );

    expect(await listTestIds()).toEqual(["timeline-recall"]);
    await expect(loadTestDef("timeline-recall")).resolves.toMatchObject({
      id: "timeline-recall",
      setupCommands: [{ type: "seed-conversation", messages: [] }],
      metricPaths: [join(dir, "timeline-recall", "metrics", "score.ts")],
    });
  });

  test("lists benchmark directories alphabetically", async () => {
    const dir = await makeTempCatalogDir(
      "EVALS_BENCHMARKS_DIR",
      "evals-benchmarks-",
    );

    await mkdir(join(dir, "personal-intelligence"), { recursive: true });
    await mkdir(join(dir, "longmemeval-v2"), { recursive: true });
    await mkdir(join(dir, ".hidden"), { recursive: true });

    expect(await listBenchmarkIds()).toEqual([
      "longmemeval-v2",
      "personal-intelligence",
    ]);
  });

  test("loads units from an explicit benchmark units directory", async () => {
    const dir = await mkdtemp(join(tmpdir(), "evals-units-"));
    await mkdir(join(dir, "session-a"), { recursive: true });
    await mkdir(join(dir, "session-b"), { recursive: true });
    await writeFile(join(dir, "session-a", "SPEC.md"), "# a", "utf8");
    await writeFile(join(dir, "session-b", "SPEC.md"), "# b", "utf8");

    expect(await listBenchmarkUnitIds(dir)).toEqual(["session-a", "session-b"]);
    await expect(loadTestDef("session-a", dir)).resolves.toMatchObject({
      id: "session-a",
    });
  });
});
