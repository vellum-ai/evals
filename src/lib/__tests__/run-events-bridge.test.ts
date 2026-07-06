import { rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import { afterEach, describe, expect, test } from "bun:test";

import {
  ensureRunArtifacts,
  RUNS_DIR,
  setRunMetadataObserver,
  updateRunMetadata,
  writeMetricResults,
  writeRunMetadata,
  writeUsage,
} from "../metrics";
import type { RunMetadata } from "../metrics";
import { createRunEventsBridge } from "../run-events-bridge";
import type { RunEventEmitter } from "../run-events";

const SESSION_ID = "session-bridge-test";

let runCounter = 0;
async function freshRun(
  overrides: Partial<RunMetadata> = {},
): Promise<RunMetadata> {
  const runId = `test-bridge-${Date.now()}-${runCounter++}-${Math.random().toString(36).slice(2)}`;
  await ensureRunArtifacts(runId);
  return {
    runId,
    sessionId: SESSION_ID,
    profileId: "p1",
    testId: "t1",
    status: "running",
    startedAt: "2026-07-06T12:00:00.000Z",
    artifactDir: `${RUNS_DIR}/${runId}`,
    ...overrides,
  };
}

interface RecordingEmitter extends RunEventEmitter {
  started: Array<{ testId: string; profileId: string }>;
  completed: Array<Parameters<RunEventEmitter["executionCompleted"]>[0]>;
}

function recordingEmitter(): RecordingEmitter {
  const started: RecordingEmitter["started"] = [];
  const completed: RecordingEmitter["completed"] = [];
  return {
    started,
    completed,
    runStarted() {},
    executionStarted(e) {
      started.push(e);
    },
    executionCompleted(e) {
      completed.push(e);
    },
    runFinished() {},
    settle: () => Promise.resolve(),
  };
}

afterEach(() => {
  setRunMetadataObserver(undefined);
});

describe("createRunEventsBridge", () => {
  test("a running write emits one execution_started; heartbeat rewrites do not repeat it", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    const metadata = await freshRun();

    bridge.observer(metadata);
    expect(emitter.started).toEqual([{ testId: "t1", profileId: "p1" }]);

    // Heartbeat tick rewrites run.json with status still "running".
    bridge.observer({
      ...metadata,
      lastHeartbeatAt: "2026-07-06T12:00:05.000Z",
    });
    expect(emitter.started).toHaveLength(1);
  });

  test("a completed write reads persisted metrics/usage and emits execution_completed", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    const metadata = await freshRun();

    await writeMetricResults(metadata.runId, [
      { name: "date-mentioned", score: 1 },
      { name: "tone", score: 0.5 },
    ]);
    await writeUsage(metadata.runId, { requests: [], totalCostUsd: 0.42 });

    bridge.observer({
      ...metadata,
      status: "completed",
      completedAt: "2026-07-06T12:00:05.000Z",
    });
    await bridge.settle();

    expect(emitter.completed).toEqual([
      {
        testId: "t1",
        profileId: "p1",
        status: "completed",
        scoreTotal: 0.75,
        metrics: [
          { id: "date-mentioned", score: 1 },
          { id: "tone", score: 0.5 },
        ],
        runtimeMs: 5000,
        totalCostUsd: 0.42,
      },
    ]);
  });

  test("a failed write with nothing scored emits metrics: [], scoreTotal: 0", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    // Mirrors run-once's catch path: the run failed before any metric
    // was written, so metrics.json still holds ensureRunArtifacts' [].
    const metadata = await freshRun();

    bridge.observer({
      ...metadata,
      status: "failed",
      completedAt: "2026-07-06T12:00:03.000Z",
      error: "boom",
    });
    await bridge.settle();

    expect(emitter.completed).toHaveLength(1);
    expect(emitter.completed[0]).toMatchObject({
      status: "failed",
      scoreTotal: 0,
      metrics: [],
      runtimeMs: 3000,
    });
    expect(emitter.completed[0]?.totalCostUsd).toBeUndefined();
  });

  test("runtimeMs is undefined when completedAt is missing", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    const metadata = await freshRun();

    bridge.observer({ ...metadata, status: "failed", error: "boom" });
    await bridge.settle();

    expect(emitter.completed).toHaveLength(1);
    expect(emitter.completed[0]?.runtimeMs).toBeUndefined();
  });

  test("writes for other sessions and abandoned/unknown statuses emit nothing", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    const other = await freshRun({ sessionId: "some-other-session" });

    bridge.observer(other);
    bridge.observer({ ...other, status: "completed" });

    // Legacy run with no sessionId at all.
    const legacy = await freshRun({ sessionId: undefined });
    bridge.observer(legacy);

    // Right session, but a status the dashboard doesn't consume.
    const abandoned = await freshRun({ status: "abandoned" });
    bridge.observer(abandoned);
    const unknown = await freshRun({ status: "unknown" });
    bridge.observer(unknown);

    await bridge.settle();
    expect(emitter.started).toHaveLength(0);
    expect(emitter.completed).toHaveLength(0);
  });

  test("a double terminal write emits one execution_completed", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    const metadata = await freshRun();

    const completed: RunMetadata = {
      ...metadata,
      status: "completed",
      completedAt: "2026-07-06T12:00:05.000Z",
    };
    bridge.observer(completed);
    bridge.observer(completed);
    bridge.observer({ ...completed, status: "failed" });
    await bridge.settle();

    expect(emitter.completed).toHaveLength(1);
    expect(emitter.completed[0]?.status).toBe("completed");
  });

  test("a metrics read failure warns but never rejects settle()", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    const metadata = await freshRun();

    // Corrupt metrics.json so readMetricResults throws a non-ENOENT
    // error (JSON parse failure) inside the fire-and-forget build task.
    await writeFile(join(RUNS_DIR, metadata.runId, "metrics.json"), "not json");

    const warnings: string[] = [];
    const originalWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(" "));
    };
    try {
      bridge.observer({
        ...metadata,
        status: "completed",
        completedAt: "2026-07-06T12:00:05.000Z",
      });
      await bridge.settle();
    } finally {
      console.warn = originalWarn;
      // Remove the deliberately corrupted run dir — report-data tests
      // scan all of `.runs/` and would choke on the invalid JSON.
      await rm(join(RUNS_DIR, metadata.runId), {
        recursive: true,
        force: true,
      });
    }

    expect(emitter.completed).toHaveLength(0);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain(
      `[run-events] failed to build execution_completed for ${metadata.runId}`,
    );
  });

  test("end-to-end through the run-metadata observer seam", async () => {
    const emitter = recordingEmitter();
    const bridge = createRunEventsBridge({ emitter, sessionId: SESSION_ID });
    setRunMetadataObserver(bridge.observer);

    const metadata = await freshRun({ testId: "t9", profileId: "p9" });
    await writeRunMetadata(metadata.runId, metadata);
    // Heartbeat-style conditional update: still running, no new emission.
    await updateRunMetadata(metadata.runId, (current) =>
      current
        ? { ...current, lastHeartbeatAt: "2026-07-06T12:00:02.000Z" }
        : undefined,
    );

    await writeMetricResults(metadata.runId, [{ name: "m", score: 0.5 }]);
    await writeUsage(metadata.runId, { requests: [], totalCostUsd: 0.01 });
    await updateRunMetadata(metadata.runId, (current) =>
      current
        ? {
            ...current,
            status: "completed",
            completedAt: "2026-07-06T12:00:10.000Z",
          }
        : undefined,
    );
    await bridge.settle();

    expect(emitter.started).toEqual([{ testId: "t9", profileId: "p9" }]);
    expect(emitter.completed).toEqual([
      {
        testId: "t9",
        profileId: "p9",
        status: "completed",
        scoreTotal: 0.5,
        metrics: [{ id: "m", score: 0.5 }],
        runtimeMs: 10000,
        totalCostUsd: 0.01,
      },
    ]);
  });
});
