import { mkdtemp, writeFile } from "node:fs/promises";
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
function makeSpies(opts: { downloadError?: Error } = {}) {
  const calls: Array<{ fn: "download" | "relabel"; arg: unknown }> = [];
  return {
    calls,
    deps: {
      download: async (arg: { dataRoot: string; repo?: string }) => {
        calls.push({ fn: "download", arg });
        if (opts.downloadError) throw opts.downloadError;
      },
      relabel: async (arg: string) => {
        calls.push({ fn: "relabel", arg });
      },
    },
  };
}

async function makeEmptyDataRoot(): Promise<string> {
  return mkdtemp(join(tmpdir(), "lme-v2-ensure-"));
}

describe("ensureDatasetAvailable", () => {
  test("env unset + data missing: no download, loader error preserved", async () => {
    delete process.env[AUTO_DOWNLOAD_ENV];
    const dataRoot = await makeEmptyDataRoot();
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, deps);
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
      await ensureDatasetAvailable(dataRoot, deps);
      expect(calls).toEqual([]);
    }
  });

  test("env=1 + data present: no download attempt", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    await writeFile(join(dataRoot, "questions.jsonl"), "", "utf8");
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, deps);
    expect(calls).toEqual([]);
  });

  test("env=1 + data missing: download then relabel, in order, with the dataRoot", async () => {
    process.env[AUTO_DOWNLOAD_ENV] = "1";
    const dataRoot = await makeEmptyDataRoot();
    const { calls, deps } = makeSpies();

    await ensureDatasetAvailable(dataRoot, deps);
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

    const rejection = expect(ensureDatasetAvailable(dataRoot, deps)).rejects;
    await rejection.toThrow(/auto-download failed/);
    await rejection.toThrow(/xiaowu0162\/longmemeval-v2/);
    await rejection.toThrow(dataRoot);
    await rejection.toThrow(/EVALS_DATA_AUTO_DOWNLOAD/);
    await rejection.toThrow(/network unreachable/);
    expect(calls.map((c) => c.fn)).toEqual(["download"]);
  });
});
