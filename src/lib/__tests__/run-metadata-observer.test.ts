import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import {
  ensureRunArtifacts,
  readRunMetadata,
  RUNS_DIR,
  setRunMetadataObserver,
  updateRunMetadata,
  writeRunMetadata,
} from "../metrics";
import type { RunMetadata } from "../metrics";

let observerCounter = 0;
async function freshRun(): Promise<{ runId: string; metadata: RunMetadata }> {
  const runId = `test-observer-${Date.now()}-${observerCounter++}-${Math.random().toString(36).slice(2)}`;
  await ensureRunArtifacts(runId);
  const metadata: RunMetadata = {
    runId,
    sessionId: "session-observer",
    profileId: "p1",
    testId: "t1",
    status: "running",
    startedAt: "2026-07-06T12:00:00.000Z",
    artifactDir: `${RUNS_DIR}/${runId}`,
  };
  return { runId, metadata };
}

afterEach(() => {
  setRunMetadataObserver(undefined);
});

describe("run-metadata observer", () => {
  test("writeRunMetadata notifies the observer with the exact metadata written, once per call", async () => {
    const { runId, metadata } = await freshRun();
    const seen: RunMetadata[] = [];
    setRunMetadataObserver((m) => seen.push(m));

    await writeRunMetadata(runId, metadata);

    expect(seen).toHaveLength(1);
    expect(seen[0]).toBe(metadata);

    const completed: RunMetadata = { ...metadata, status: "completed" };
    await writeRunMetadata(runId, completed);

    expect(seen).toHaveLength(2);
    expect(seen[1]).toBe(completed);
  });

  test("updateRunMetadata notifies with the updater's result; a bailing updater does not notify", async () => {
    const { runId, metadata } = await freshRun();
    await writeRunMetadata(runId, metadata);

    const seen: RunMetadata[] = [];
    setRunMetadataObserver((m) => seen.push(m));

    const written = await updateRunMetadata(runId, (current) => {
      if (!current) return undefined;
      return { ...current, status: "completed" };
    });

    expect(seen).toHaveLength(1);
    expect(written).toBe(seen[0]);
    expect(seen[0]?.status).toBe("completed");

    // Conditional update that bails: write skipped → no notification.
    await updateRunMetadata(runId, () => undefined);
    expect(seen).toHaveLength(1);
  });

  test("a throwing observer does not prevent the write", async () => {
    const { runId, metadata } = await freshRun();
    setRunMetadataObserver(() => {
      throw new Error("observer boom");
    });

    await writeRunMetadata(runId, metadata);
    const raw = await readFile(join(RUNS_DIR, runId, "run.json"), "utf8");
    expect(JSON.parse(raw).status).toBe("running");

    const updated = await updateRunMetadata(runId, (current) =>
      current ? { ...current, status: "failed" } : undefined,
    );
    expect(updated?.status).toBe("failed");
    expect((await readRunMetadata(runId))?.status).toBe("failed");
  });

  test("with no observer set, writes behave as before", async () => {
    const { runId, metadata } = await freshRun();

    await writeRunMetadata(runId, metadata);
    expect((await readRunMetadata(runId))?.status).toBe("running");

    await updateRunMetadata(runId, (current) =>
      current ? { ...current, status: "completed" } : undefined,
    );
    expect((await readRunMetadata(runId))?.status).toBe("completed");
  });
});
