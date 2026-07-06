import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import { AUTO_DOWNLOAD_ENV, ensureDatasetAvailable } from "../ensure-dataset";
import { loadLongMemEvalV2 } from "../loader";

const originalAutoDownload = process.env[AUTO_DOWNLOAD_ENV];

afterEach(() => {
  if (originalAutoDownload === undefined) delete process.env[AUTO_DOWNLOAD_ENV];
  else process.env[AUTO_DOWNLOAD_ENV] = originalAutoDownload;
});

/** Spy deps that record invocation order + args. */
function makeSpies(
  opts: {
    downloadError?: Error;
    relabelError?: Error;
    /** How many leading relabel calls throw relabelError (default: all). */
    relabelFailures?: number;
  } = {},
) {
  const calls: Array<{ fn: "download" | "relabel"; arg: unknown }> = [];
  let relabelCalls = 0;
  return {
    calls,
    deps: {
      download: async (arg: { dataRoot: string; repo?: string }) => {
        calls.push({ fn: "download", arg });
        if (opts.downloadError) throw opts.downloadError;
      },
      relabel: async (arg: string) => {
        calls.push({ fn: "relabel", arg });
        relabelCalls += 1;
        const failures = opts.relabelFailures ?? Number.POSITIVE_INFINITY;
        if (opts.relabelError && relabelCalls <= failures)
          throw opts.relabelError;
      },
    },
  };
}

async function makeEmptyDataRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "lme-v2-ensure-"));
}

async function writeQuestions(dataRoot: string): Promise<void> {
  await writeFile(join(dataRoot, "questions.jsonl"), "", "utf8");
}

async function writeHaystack(dataRoot: string, tier: string): Promise<void> {
  await mkdir(join(dataRoot, "haystacks"), { recursive: true });
  await writeFile(
    join(dataRoot, "haystacks", `lme_v2_${tier}.json`),
    "{}",
    "utf8",
  );
}

async function writeTrajectories(dataRoot: string): Promise<void> {
  await writeFile(join(dataRoot, "trajectories.jsonl"), "", "utf8");
}

describe("ensureDatasetAvailable", () => {
  test("env unset + data missing: no download, loader error preserved", async () => {
    delete process.env[AUTO_DOWNLOAD_ENV];
    const dataRoot = await makeEmptyDataRoot();
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, "small", deps);
    expect(calls).toEqual([]);

    // The loader's helpful local-dev error stays byte-identical to today.
    const loaded = expect(
      loadLongMemEvalV2({ dataRoot, tier: "small" }),
    ).rejects;
    await loaded.toThrow(/questions\.jsonl not found/);
    await loaded.toThrow(/data\/download\.ts/);
  });

  test('env set to non-"1" values + data missing: no download (strict gate)', async () => {
    const dataRoot = await makeEmptyDataRoot();
    for (const value of ["0", "true"]) {
      process.env[AUTO_DOWNLOAD_ENV] = value;
      const { calls, deps } = makeSpies();
      await ensureDatasetAvailable(dataRoot, "small", deps);
      expect(calls).toEqual([]);
    }
  });

  test("env unset + questions.jsonl present but others missing: no download (strict gate)", async () => {
    delete process.env[AUTO_DOWNLOAD_ENV];
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, "small", deps);
    expect(calls).toEqual([]);
  });

  test("env unset + all required files present: strict no-op (no download, no relabel)", async () => {
    delete process.env[AUTO_DOWNLOAD_ENV];
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    await writeHaystack(dataRoot, "small");
    await writeTrajectories(dataRoot);
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, "small", deps);
    expect(calls).toEqual([]);
  });

  test("env=1 + all required files present: no download attempt, but relabel runs once to heal a torn prior relabel", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    await writeHaystack(dataRoot, "small");
    await writeTrajectories(dataRoot);
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, "small", deps);
    expect(calls).toEqual([{ fn: "relabel", arg: dataRoot }]);
  });

  test("env=1 + questions.jsonl present but trajectories.jsonl missing: download resumes (regression)", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    await writeHaystack(dataRoot, "small");
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, "small", deps);
    expect(calls).toEqual([
      { fn: "download", arg: { dataRoot } },
      { fn: "relabel", arg: dataRoot },
    ]);
  });

  test("env=1 + selected tier haystack missing: download resumes", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    // Only the other tier's haystack is present.
    await writeHaystack(dataRoot, "small");
    await writeTrajectories(dataRoot);
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, "medium", deps);
    expect(calls).toEqual([
      { fn: "download", arg: { dataRoot } },
      { fn: "relabel", arg: dataRoot },
    ]);
  });

  test("env=1 + data missing: download then relabel, in order, with the dataRoot", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, "small", deps);
    expect(calls).toEqual([
      { fn: "download", arg: { dataRoot } },
      { fn: "relabel", arg: dataRoot },
    ]);
  });

  test("env=1 + download rejects: actionable error, relabel not called", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    const { calls, deps } = makeSpies({
      downloadError: new Error("network unreachable"),
    });

    const rejection = expect(
      ensureDatasetAvailable(dataRoot, "small", deps),
    ).rejects;
    await rejection.toThrow(/auto-download failed/);
    await rejection.toThrow(/xiaowu0162\/longmemeval-v2/);
    await rejection.toThrow(dataRoot);
    await rejection.toThrow(/EVALS_DATA_AUTO_DOWNLOAD/);
    await rejection.toThrow(/network unreachable/);
    expect(calls.map((c) => c.fn)).toEqual(["download"]);
  });

  test("env=1 + all files present + fast-path relabel rejects once (torn file): falls back to download + relabel, no error", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    await writeHaystack(dataRoot, "small");
    await writeTrajectories(dataRoot);
    const { calls, deps } = makeSpies({
      relabelError: new Error("Unexpected end of JSON input"),
      relabelFailures: 1,
    });

    await ensureDatasetAvailable(dataRoot, "small", deps);
    expect(calls).toEqual([
      { fn: "relabel", arg: dataRoot },
      { fn: "download", arg: { dataRoot } },
      { fn: "relabel", arg: dataRoot },
    ]);
  });

  test("env=1 + all files present + relabel rejects persistently: actionable error after the fallback", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    await writeHaystack(dataRoot, "small");
    await writeTrajectories(dataRoot);
    // Relabel always rejects (e.g. question-labels.json absent from a
    // custom dataRoot — the download can never create it), so the fallback
    // download + relabel fails too and the wrapped error surfaces.
    const { calls, deps } = makeSpies({
      relabelError: new Error("question-labels.json not found"),
    });

    const rejection = expect(
      ensureDatasetAvailable(dataRoot, "small", deps),
    ).rejects;
    await rejection.toThrow(/auto-download failed/);
    await rejection.toThrow(/xiaowu0162\/longmemeval-v2/);
    await rejection.toThrow(dataRoot);
    await rejection.toThrow(/EVALS_DATA_AUTO_DOWNLOAD/);
    await rejection.toThrow(/question-labels\.json not found/);
    expect(calls).toEqual([
      { fn: "relabel", arg: dataRoot },
      { fn: "download", arg: { dataRoot } },
      { fn: "relabel", arg: dataRoot },
    ]);
  });

  test("env=1 + all files present + relabel rejects then fallback download rejects: actionable error", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    await writeQuestions(dataRoot);
    await writeHaystack(dataRoot, "small");
    await writeTrajectories(dataRoot);
    const { calls, deps } = makeSpies({
      relabelError: new Error("haystack re-key failed"),
      downloadError: new Error("network unreachable"),
    });

    const rejection = expect(
      ensureDatasetAvailable(dataRoot, "small", deps),
    ).rejects;
    await rejection.toThrow(/auto-download failed/);
    await rejection.toThrow(/xiaowu0162\/longmemeval-v2/);
    await rejection.toThrow(dataRoot);
    await rejection.toThrow(/EVALS_DATA_AUTO_DOWNLOAD/);
    await rejection.toThrow(/network unreachable/);
    expect(calls).toEqual([
      { fn: "relabel", arg: dataRoot },
      { fn: "download", arg: { dataRoot } },
    ]);
  });
});
