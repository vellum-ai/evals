import { afterEach, describe, expect, spyOn, test } from "bun:test";

import type { RunEventEmitter } from "../../lib/run-events";
import { flushRunFinishedOnSignal, settleEmitterBounded } from "../run";

/**
 * A stub emitter whose settle() resolves via the given factory. Records
 * runFinished calls; the other event methods are irrelevant to the
 * signal-flush path.
 */
function stubEmitter(input: {
  settle: () => Promise<void>;
  runFinished?: (status: "succeeded" | "failed") => void;
}): { emitter: RunEventEmitter; finishedWith: Array<"succeeded" | "failed"> } {
  const finishedWith: Array<"succeeded" | "failed"> = [];
  const emitter: RunEventEmitter = {
    runStarted() {},
    executionStarted() {},
    executionCompleted() {},
    runFinished(status) {
      finishedWith.push(status);
      input.runFinished?.(status);
    },
    settle: input.settle,
  };
  return { emitter, finishedWith };
}

describe("flushRunFinishedOnSignal", () => {
  test("enqueues a failed run_finished and resolves once emitter and bridge settle", async () => {
    let emitterSettles = 0;
    let bridgeSettles = 0;
    const { emitter, finishedWith } = stubEmitter({
      settle: () => {
        emitterSettles += 1;
        return Promise.resolve();
      },
    });
    const bridge = {
      settle: () => {
        bridgeSettles += 1;
        return Promise.resolve();
      },
    };

    await flushRunFinishedOnSignal({ emitter, bridge, capMs: 5000 });

    expect(finishedWith).toEqual(["failed"]);
    expect(bridgeSettles).toBe(1);
    // Settled once alongside the bridge, then a second drain for any
    // events the bridge enqueued while settling.
    expect(emitterSettles).toBe(2);
  });

  test("works without a bridge", async () => {
    const { emitter, finishedWith } = stubEmitter({
      settle: () => Promise.resolve(),
    });

    await flushRunFinishedOnSignal({ emitter, capMs: 5000 });

    expect(finishedWith).toEqual(["failed"]);
  });

  test("is bounded: resolves within the cap when the dashboard never settles", async () => {
    const { emitter, finishedWith } = stubEmitter({
      // Simulates a dead dashboard: the POST chain never drains.
      settle: () => new Promise<void>(() => {}),
    });
    const bridge = { settle: () => new Promise<void>(() => {}) };

    const started = Date.now();
    await flushRunFinishedOnSignal({ emitter, bridge, capMs: 25 });
    const elapsed = Date.now() - started;

    expect(finishedWith).toEqual(["failed"]);
    // Must be capped, not hang: generous upper bound for CI jitter.
    expect(elapsed).toBeLessThan(2000);
  });

  test("never rejects, even if the emitter throws", async () => {
    const { emitter } = stubEmitter({
      settle: () => Promise.reject(new Error("settle blew up")),
      runFinished: () => {
        throw new Error("runFinished blew up");
      },
    });
    const bridge = {
      settle: () => Promise.reject(new Error("bridge blew up")),
    };

    // Both the sync throw and the rejected settles must be swallowed.
    await expect(
      flushRunFinishedOnSignal({ emitter, bridge, capMs: 25 }),
    ).resolves.toBeUndefined();
  });
});

describe("settleEmitterBounded", () => {
  const warnSpies: Array<ReturnType<typeof spyOn>> = [];

  afterEach(() => {
    for (const spy of warnSpies.splice(0)) spy.mockRestore();
  });

  function spyWarn() {
    const spy = spyOn(console, "warn").mockImplementation(() => {});
    warnSpies.push(spy);
    return spy;
  }

  test("resolves without warning when the emitter drains within the cap", async () => {
    const warn = spyWarn();
    const { emitter } = stubEmitter({ settle: () => Promise.resolve() });

    await settleEmitterBounded(emitter, 5000);

    expect(warn).not.toHaveBeenCalled();
  });

  test("is bounded: warns and resolves when the emitter never drains", async () => {
    const warn = spyWarn();
    const { emitter } = stubEmitter({
      // Simulates a slow-but-not-failing dashboard: the chain never drains.
      settle: () => new Promise<void>(() => {}),
    });

    const started = Date.now();
    await settleEmitterBounded(emitter, 25);
    const elapsed = Date.now() - started;

    // Must be capped, not hang: generous upper bound for CI jitter.
    expect(elapsed).toBeLessThan(2000);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toBe(
      "[run-events] final event flush still pending after 25ms — continuing without it",
    );
  });

  test("never rejects, even if settle rejects", async () => {
    spyWarn();
    const { emitter } = stubEmitter({
      settle: () => Promise.reject(new Error("settle blew up")),
    });

    await expect(settleEmitterBounded(emitter, 25)).resolves.toBeUndefined();
  });
});
