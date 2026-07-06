import { describe, expect, test } from "bun:test";

import type { RunEventEmitter } from "../../lib/run-events";
import { flushRunFinishedOnSignal } from "../run";

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
    // One drain, after the bridge settled — by then every pending
    // execution_completed build has already enqueued onto the chain.
    expect(emitterSettles).toBe(1);
  });

  test("skipRunFinished: drains without enqueueing a second run_finished", async () => {
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

    // Simulates a signal landing while the normal-path finally was
    // mid-drain: run_finished("succeeded") is already on the chain, so
    // the signal flush must only drain, never add a contradictory
    // "failed".
    await flushRunFinishedOnSignal({
      emitter,
      bridge,
      capMs: 5000,
      skipRunFinished: true,
    });

    expect(finishedWith).toEqual([]);
    expect(bridgeSettles).toBe(1);
    expect(emitterSettles).toBe(1);
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
