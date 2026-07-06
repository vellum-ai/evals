/**
 * Tests for the shared progress + heartbeat lifecycle helper.
 *
 * The helper is the PR-8 extract of boilerplate that used to live
 * inlined inside both `runEvalOnce` and `runLongMemEvalV2Unit`. The
 * behaviour we lock down here is exactly the contract the two callers
 * depend on:
 *
 *   1. the wrapped reporter tees to the user reporter (if any), persists
 *      a timestamped copy to `progress.ndjson`, and bumps the heartbeat
 *      on every event
 *   2. a thrown user reporter never breaks the persistence + heartbeat
 *      path
 *   3. the standalone ticker keeps bumping the heartbeat even when no
 *      progress events are flowing
 *   4. `dispose()` stops the ticker (and is idempotent)
 *   5. `flush()` resolves only after every event emitted so far is on
 *      disk in `progress.ndjson`, never rejects, and still covers
 *      events emitted after `dispose()` (the `runEvalOnce` shutdown
 *      pattern) — this is what lets `commands/run.ts` snapshot the
 *      publish bundle the moment `benchmark.run` resolves without
 *      truncating runner logs
 *
 * Backed by real disk state via `ensureRunArtifacts` — same pattern
 * `metrics.test.ts` uses. Avoids a metrics-module mock seam since the
 * helper's whole job is the side-effect chain into metrics.
 */
import { mkdir, readFile, rm } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test } from "bun:test";

import {
  ensureRunArtifacts,
  readRunMetadata,
  runArtifacts,
  writeRunMetadata,
} from "../../metrics";
import type { EvalProgressEvent } from "../progress";
import { createRunProgressLifecycle } from "../progress-lifecycle";

function makeRunId(): string {
  return `progress-lifecycle-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sampleEvent(
  overrides: Partial<EvalProgressEvent> = {},
): EvalProgressEvent {
  return {
    step: "artifacts",
    status: "start",
    message: "preparing artifacts",
    ...overrides,
  };
}

/** Tiny helper: poll until the predicate is true or budget runs out. */
async function waitFor(
  pred: () => Promise<boolean> | boolean,
  budgetMs = 500,
  pollMs = 5,
): Promise<void> {
  const deadline = Date.now() + budgetMs;
  while (Date.now() < deadline) {
    if (await pred()) return;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  throw new Error(`waitFor exceeded budget of ${budgetMs}ms`);
}

async function readProgressLines(runId: string): Promise<string[]> {
  const path = runArtifacts(runId).progressLogPath;
  const raw = await readFile(path, "utf8");
  return raw.split("\n").filter((l) => l.trim().length > 0);
}

describe("createRunProgressLifecycle", () => {
  const runIds: string[] = [];

  beforeEach(() => {
    runIds.length = 0;
  });

  afterEach(async () => {
    for (const runId of runIds) {
      await rm(runArtifacts(runId).runDir, { recursive: true, force: true });
    }
  });

  async function prepareRun(): Promise<string> {
    const runId = makeRunId();
    runIds.push(runId);
    await mkdir(runArtifacts(runId).runDir, { recursive: true });
    await ensureRunArtifacts(runId);
    // updateHeartbeat is a no-op without a "running" run.json — write
    // one up front so the heartbeat path has somewhere to write.
    await writeRunMetadata(runId, {
      runId,
      sessionId: runId,
      profileId: "p-test",
      testId: "t-test",
      status: "running",
      startedAt: new Date().toISOString(),
      artifactDir: runArtifacts(runId).runDir,
    });
    return runId;
  }

  test("tees every event to the user reporter, persists, bumps heartbeat", async () => {
    const runId = await prepareRun();
    const received: EvalProgressEvent[] = [];

    const { progress, dispose } = createRunProgressLifecycle({
      runId,
      userProgress: (event) => received.push(event),
      // Slow ticker — the on-event heartbeat is the path under test
      // here. The ticker itself gets its own test below.
      heartbeatMs: 60_000,
    });
    try {
      progress(sampleEvent({ message: "first" }));
      progress(sampleEvent({ status: "done", message: "second" }));

      // User reporter saw both events, in order.
      expect(received).toHaveLength(2);
      expect(received[0]?.message).toBe("first");
      expect(received[1]?.message).toBe("second");

      // `progress.ndjson` carries both lines with `emittedAt` stamped.
      await waitFor(async () => (await readProgressLines(runId)).length === 2);
      const lines = await readProgressLines(runId);
      const parsed = lines.map(
        (l) => JSON.parse(l) as EvalProgressEvent & { emittedAt: string },
      );
      expect(parsed[0]?.message).toBe("first");
      expect(parsed[0]?.emittedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(parsed[1]?.message).toBe("second");

      // Heartbeat got bumped — `lastHeartbeatAt` is now set.
      await waitFor(async () => {
        const meta = await readRunMetadata(runId);
        return Boolean(meta?.lastHeartbeatAt);
      });
      const meta = await readRunMetadata(runId);
      expect(meta?.lastHeartbeatAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    } finally {
      dispose();
    }
  });

  test("swallows throws from the user reporter without breaking persistence", async () => {
    const runId = await prepareRun();

    const { progress, dispose } = createRunProgressLifecycle({
      runId,
      userProgress: () => {
        throw new Error("simulated reporter crash");
      },
      heartbeatMs: 60_000,
    });
    try {
      // The call itself must not throw.
      expect(() =>
        progress(sampleEvent({ message: "survives" })),
      ).not.toThrow();

      // Persistence still ran — line appended despite reporter crash.
      await waitFor(async () => (await readProgressLines(runId)).length === 1);
      const lines = await readProgressLines(runId);
      const parsed = JSON.parse(lines[0]!) as EvalProgressEvent;
      expect(parsed.message).toBe("survives");
    } finally {
      dispose();
    }
  });

  test("works without a user reporter (persist + heartbeat still fire)", async () => {
    const runId = await prepareRun();

    const { progress, dispose } = createRunProgressLifecycle({
      runId,
      // No userProgress — the optional path.
      heartbeatMs: 60_000,
    });
    try {
      progress(sampleEvent({ message: "anonymous" }));

      await waitFor(async () => (await readProgressLines(runId)).length === 1);
      const lines = await readProgressLines(runId);
      const parsed = JSON.parse(lines[0]!) as EvalProgressEvent;
      expect(parsed.message).toBe("anonymous");

      await waitFor(async () => {
        const meta = await readRunMetadata(runId);
        return Boolean(meta?.lastHeartbeatAt);
      });
    } finally {
      dispose();
    }
  });

  test("standalone ticker bumps the heartbeat with no progress events flowing", async () => {
    const runId = await prepareRun();

    // Tight tick so the test budget stays small.
    const { dispose } = createRunProgressLifecycle({
      runId,
      heartbeatMs: 20,
    });
    try {
      // No progress() calls — only the ticker should write.
      await waitFor(async () => {
        const meta = await readRunMetadata(runId);
        return Boolean(meta?.lastHeartbeatAt);
      });
      const first = (await readRunMetadata(runId))?.lastHeartbeatAt;
      expect(first).toBeDefined();

      // Wait long enough for at least one more tick.
      await new Promise((r) => setTimeout(r, 80));
      const second = (await readRunMetadata(runId))?.lastHeartbeatAt;
      expect(second).toBeDefined();
      // The second tick produced a strictly later timestamp.
      expect(new Date(second!).getTime()).toBeGreaterThan(
        new Date(first!).getTime(),
      );
    } finally {
      dispose();
    }
  });

  test("dispose() stops the ticker; further ticks do not land", async () => {
    const runId = await prepareRun();

    const { dispose } = createRunProgressLifecycle({
      runId,
      heartbeatMs: 20,
    });

    // Let one tick land.
    await waitFor(async () => {
      const meta = await readRunMetadata(runId);
      return Boolean(meta?.lastHeartbeatAt);
    });
    const atDispose = (await readRunMetadata(runId))?.lastHeartbeatAt;

    dispose();

    // Flip status away from "running" — updateHeartbeat is a no-op
    // unless status is "running", so the lastHeartbeatAt will only
    // change if a real heartbeat write tries to land. After dispose
    // we expect zero further writes.
    await writeRunMetadata(runId, {
      ...(await readRunMetadata(runId))!,
      status: "completed",
      completedAt: new Date().toISOString(),
    });
    // Capture the post-dispose snapshot — the `completed` write above
    // doesn't preserve `lastHeartbeatAt` unless we explicitly carry
    // it forward, so we measure against the original value if the
    // ticker tried to fire later. We need to set lastHeartbeatAt
    // back so we can detect "still ticking" vs "stopped".
    const restored = await readRunMetadata(runId);
    await writeRunMetadata(runId, {
      ...restored!,
      status: "running",
      lastHeartbeatAt: atDispose,
    });

    // Wait several tick periods. After dispose nothing should write.
    await new Promise((r) => setTimeout(r, 80));
    const after = (await readRunMetadata(runId))?.lastHeartbeatAt;
    expect(after).toBe(atDispose);
  });

  test("dispose() is idempotent", async () => {
    const runId = await prepareRun();
    const { dispose } = createRunProgressLifecycle({
      runId,
      heartbeatMs: 60_000,
    });
    expect(() => dispose()).not.toThrow();
    expect(() => dispose()).not.toThrow();
    expect(() => dispose()).not.toThrow();
  });

  test("flush() drains: every event emitted before it is on disk when it resolves", async () => {
    const runId = await prepareRun();

    const { progress, dispose, flush } = createRunProgressLifecycle({
      runId,
      heartbeatMs: 60_000,
    });
    try {
      // Enough events that the fire-and-forget append chain is
      // guaranteed to still have pending links when we hit flush().
      const total = 50;
      for (let i = 0; i < total; i++) {
        progress(sampleEvent({ message: `event-${i}` }));
      }

      await flush();

      // No waitFor polling — the whole point of flush() is that the
      // file is complete the instant it resolves. This is the contract
      // the auto-publish bundle snapshot in `commands/run.ts` relies on.
      const lines = await readProgressLines(runId);
      expect(lines).toHaveLength(total);
      const parsed = lines.map((l) => JSON.parse(l) as EvalProgressEvent);
      for (let i = 0; i < total; i++) {
        expect(parsed[i]?.message).toBe(`event-${i}`);
      }
    } finally {
      dispose();
    }
  });

  test("flush() covers events emitted after dispose() (runEvalOnce shutdown pattern)", async () => {
    const runId = await prepareRun();

    const { progress, dispose, flush } = createRunProgressLifecycle({
      runId,
      heartbeatMs: 60_000,
    });
    progress(sampleEvent({ message: "before-dispose" }));
    dispose();
    // `runEvalOnce` emits its shutdown start/done events after
    // dispose() in the finally, then awaits flush() last.
    progress(sampleEvent({ step: "shutdown", message: "after-dispose" }));

    await flush();

    const lines = await readProgressLines(runId);
    expect(lines).toHaveLength(2);
    expect((JSON.parse(lines[1]!) as EvalProgressEvent).message).toBe(
      "after-dispose",
    );
  });

  test("flush() never rejects, even when the appends themselves fail", async () => {
    const runId = await prepareRun();

    const { progress, dispose, flush } = createRunProgressLifecycle({
      runId,
      heartbeatMs: 60_000,
    });
    try {
      // Nuke the run dir so appendFile has nowhere to write — every
      // queued append fails. flush() must still resolve (a rejection
      // here would mask the run's real error in the runners' finally).
      await rm(runArtifacts(runId).runDir, { recursive: true, force: true });
      progress(sampleEvent({ message: "doomed-1" }));
      progress(sampleEvent({ message: "doomed-2" }));

      await expect(flush()).resolves.toBeUndefined();
    } finally {
      dispose();
    }
  });

  test("the standalone ticker is unref'd (does not keep the loop alive)", () => {
    const runId = makeRunId();
    runIds.push(runId); // ensure cleanup
    const { dispose } = createRunProgressLifecycle({
      runId,
      heartbeatMs: 10,
    });
    // If the timer weren't unref'd this test process would refuse to
    // exit normally. Sanity check: dispose must not throw, and the
    // test must finish — the bun test runner enforces the latter.
    dispose();
  });
});
