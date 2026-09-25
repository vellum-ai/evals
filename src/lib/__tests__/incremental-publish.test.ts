import { afterEach, describe, expect, spyOn, test } from "bun:test";

import type { pushBundleToUrl } from "../bundle-push";
import { createIncrementalSessionPublisher } from "../incremental-publish";
import type { RunMetadata } from "../metrics";

type PushOpts = NonNullable<Parameters<typeof pushBundleToUrl>[2]>;

type Deferred = {
  promise: Promise<void>;
  resolve(): void;
};

function deferred(): Deferred {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function metadata(
  runId: string,
  status: RunMetadata["status"],
  sessionId = "session-live",
): RunMetadata {
  return {
    runId,
    sessionId,
    profileId: "p1",
    testId: "t1",
    status,
    startedAt: "2026-09-19T12:00:00.000Z",
    artifactDir: `.runs/${runId}`,
  };
}

const spies: Array<ReturnType<typeof spyOn>> = [];
afterEach(() => {
  for (const spy of spies.splice(0)) spy.mockRestore();
});

describe("createIncrementalSessionPublisher", () => {
  test("is disabled unless both dashboard URL and token are configured", () => {
    expect(
      createIncrementalSessionPublisher({ sessionId: "s1", env: {} }),
    ).toBeUndefined();
    expect(
      createIncrementalSessionPublisher({
        sessionId: "s1",
        env: { EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com" },
      }),
    ).toBeUndefined();
  });

  test("publishes the first durable run and each terminal transition once", async () => {
    const calls: Array<{ sessionId: string; url: string; opts: PushOpts }> = [];
    const push = (async (sessionId, url, opts) => {
      calls.push({ sessionId, url, opts: opts ?? {} });
      return {
        runId: sessionId,
        viewUrl: `https://qa.example.com/evals/runs/${sessionId}`,
      };
    }) as typeof pushBundleToUrl;
    const log = spyOn(console, "log").mockImplementation(() => {});
    spies.push(log);

    const publisher = createIncrementalSessionPublisher({
      sessionId: "session-live",
      env: {
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com/",
        QA_AUTH_TOKEN: "token",
      },
      push,
    });
    expect(publisher).toBeDefined();

    publisher?.observer(metadata("run-1", "running"));
    publisher?.observer(metadata("run-1", "running"));
    publisher?.observer(metadata("run-2", "running"));
    publisher?.observer(metadata("run-other", "running", "other-session"));
    publisher?.observer(metadata("run-1", "completed"));
    publisher?.observer(metadata("run-1", "completed"));
    await publisher?.settle();

    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call).toEqual({
        sessionId: "session-live",
        url: "https://qa.example.com/",
        opts: {
          authToken: "token",
          timeoutMs: 30_000,
          isFinal: false,
          quiet: true,
        },
      });
    }
    expect(log).toHaveBeenCalledTimes(1);
  });

  test("serializes uploads and coalesces refreshes requested during one upload", async () => {
    const first = deferred();
    let active = 0;
    let maxActive = 0;
    let calls = 0;
    const push = (async (sessionId) => {
      calls += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (calls === 1) await first.promise;
      active -= 1;
      return {
        runId: sessionId,
        viewUrl: `https://qa.example.com/evals/runs/${sessionId}`,
      };
    }) as typeof pushBundleToUrl;
    const log = spyOn(console, "log").mockImplementation(() => {});
    spies.push(log);

    const publisher = createIncrementalSessionPublisher({
      sessionId: "session-live",
      env: {
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com",
        QA_AUTH_TOKEN: "token",
      },
      push,
    });

    publisher?.observer(metadata("run-1", "running"));
    await Promise.resolve();
    publisher?.observer(metadata("run-2", "running"));
    publisher?.observer(metadata("run-1", "completed"));
    publisher?.observer(metadata("run-2", "completed"));
    first.resolve();
    await publisher?.settle();

    expect(maxActive).toBe(1);
    expect(calls).toBe(2);
  });

  test("upload failures warn and never reject settle", async () => {
    const push = (async () => {
      throw new Error("dashboard unavailable");
    }) as typeof pushBundleToUrl;
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    spies.push(warn);

    const publisher = createIncrementalSessionPublisher({
      sessionId: "session-live",
      env: {
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com",
        QA_AUTH_TOKEN: "token",
      },
      push,
    });
    publisher?.observer(metadata("run-1", "running"));

    await expect(publisher?.settle()).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("live artifact refresh failed"),
    );
  });
});
