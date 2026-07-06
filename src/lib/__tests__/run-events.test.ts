import { afterEach, describe, expect, spyOn, test } from "bun:test";

import {
  createRunEventEmitter,
  resolveRunEventsConfig,
  type RunEventsConfig,
} from "../run-events";

const config: RunEventsConfig = {
  baseUrl: "https://qa.example.com",
  authToken: "secret-token",
};

interface RecordedCall {
  url: string;
  init: RequestInit;
  body: Record<string, unknown>;
}

/** A fetch stub that records every call and responds 200. */
function recordingFetch(): { calls: RecordedCall[]; fetchImpl: typeof fetch } {
  const calls: RecordedCall[] = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({
      url: String(url),
      init: init ?? {},
      body: JSON.parse(String(init?.body)) as Record<string, unknown>,
    });
    return new Response(null, { status: 200 });
  }) as typeof fetch;
  return { calls, fetchImpl };
}

function expectIsoTimestamp(value: unknown): void {
  expect(typeof value).toBe("string");
  expect(new Date(value as string).toISOString()).toBe(value as string);
}

const warnSpies: Array<ReturnType<typeof spyOn>> = [];

function spyWarn() {
  const spy = spyOn(console, "warn").mockImplementation(() => {});
  warnSpies.push(spy);
  return spy;
}

afterEach(() => {
  for (const spy of warnSpies.splice(0)) spy.mockRestore();
});

describe("payload shapes (frozen contract)", () => {
  test("run_started: URL, method, headers, and exact body", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const emitter = createRunEventEmitter({
      config,
      sessionId: "session/2026 07",
      fetchImpl,
    });

    emitter.runStarted("personal-intelligence", [
      { testId: "t-1", profileId: "p-1" },
      { testId: "t-2", profileId: "p-1" },
    ]);
    await emitter.settle();

    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.url).toBe(
      "https://qa.example.com/api/evals/runs/session%2F2026%2007/events",
    );
    expect(call.init.method).toBe("POST");
    expect(call.init.headers).toEqual({
      Authorization: "Bearer secret-token",
      "Content-Type": "application/json",
    });
    expectIsoTimestamp(call.body.emittedAt);
    expect(call.body).toEqual({
      event: "run_started",
      emittedAt: call.body.emittedAt,
      benchmark: "personal-intelligence",
      planned: [
        { testId: "t-1", profileId: "p-1" },
        { testId: "t-2", profileId: "p-1" },
      ],
    });
  });

  test("execution_started: exact body", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    emitter.executionStarted({ testId: "t-1", profileId: "p-1" });
    await emitter.settle();

    const call = calls[0]!;
    expect(call.url).toBe("https://qa.example.com/api/evals/runs/s1/events");
    expectIsoTimestamp(call.body.emittedAt);
    expect(call.body).toEqual({
      event: "execution_started",
      emittedAt: call.body.emittedAt,
      testId: "t-1",
      profileId: "p-1",
    });
  });

  test("execution_completed: exact body with optional fields present", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    emitter.executionCompleted({
      testId: "t-1",
      profileId: "p-1",
      status: "completed",
      scoreTotal: 87.5,
      metrics: [
        { id: "accuracy", score: 90 },
        { id: "cost", score: 85 },
      ],
      runtimeMs: 12345,
      totalCostUsd: 0.42,
    });
    await emitter.settle();

    const body = calls[0]!.body;
    expectIsoTimestamp(body.emittedAt);
    expect(body).toEqual({
      event: "execution_completed",
      emittedAt: body.emittedAt,
      testId: "t-1",
      profileId: "p-1",
      status: "completed",
      scoreTotal: 87.5,
      metrics: [
        { id: "accuracy", score: 90 },
        { id: "cost", score: 85 },
      ],
      runtimeMs: 12345,
      totalCostUsd: 0.42,
    });
  });

  test("execution_completed: optional fields are absent (not null) when not supplied", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    emitter.executionCompleted({
      testId: "t-1",
      profileId: "p-1",
      status: "failed",
      scoreTotal: 0,
      metrics: [],
    });
    await emitter.settle();

    const body = calls[0]!.body;
    expectIsoTimestamp(body.emittedAt);
    expect(Object.keys(body).sort()).toEqual([
      "emittedAt",
      "event",
      "metrics",
      "profileId",
      "scoreTotal",
      "status",
      "testId",
    ]);
    expect(body).toEqual({
      event: "execution_completed",
      emittedAt: body.emittedAt,
      testId: "t-1",
      profileId: "p-1",
      status: "failed",
      scoreTotal: 0,
      metrics: [],
    });
  });

  test("run_finished: exact body", async () => {
    const { calls, fetchImpl } = recordingFetch();
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    emitter.runFinished("succeeded");
    await emitter.settle();

    const body = calls[0]!.body;
    expectIsoTimestamp(body.emittedAt);
    expect(body).toEqual({
      event: "run_finished",
      emittedAt: body.emittedAt,
      status: "succeeded",
    });
  });
});

describe("sequential ordering", () => {
  test("a later POST is not started until the earlier one settles, even if it would resolve first", async () => {
    const started: string[] = [];
    let releaseFirst!: () => void;
    let callIndex = 0;
    const fetchImpl = ((_url: unknown, init?: RequestInit) => {
      started.push((JSON.parse(String(init?.body)) as { event: string }).event);
      if (callIndex++ === 0) {
        // First POST hangs until we release it.
        return new Promise<Response>((resolve) => {
          releaseFirst = () => resolve(new Response(null, { status: 200 }));
        });
      }
      // Later POSTs resolve immediately (i.e. "out of order" if concurrent).
      return Promise.resolve(new Response(null, { status: 200 }));
    }) as typeof fetch;

    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });
    emitter.executionStarted({ testId: "t-1", profileId: "p-1" });
    emitter.runFinished("succeeded");

    // Give the chain a chance to (incorrectly) start the second POST.
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(started).toEqual(["execution_started"]);

    releaseFirst();
    await emitter.settle();
    expect(started).toEqual(["execution_started", "run_finished"]);
  });
});

const BREAKER_WARNING =
  "[run-events] dashboard unreachable after 3 consecutive failures — dropping remaining events";

/**
 * A fetch stub that walks a script of outcomes ("fail" rejects, "ok"
 * resolves 200) and counts calls; calls beyond the script reject.
 */
function scriptedFetch(script: Array<"fail" | "ok">): {
  callCount: () => number;
  fetchImpl: typeof fetch;
} {
  let calls = 0;
  const fetchImpl = ((_url: unknown) => {
    const outcome = script[calls++] ?? "fail";
    return outcome === "ok"
      ? Promise.resolve(new Response(null, { status: 200 }))
      : Promise.reject(new Error("connection refused"));
  }) as typeof fetch;
  return { callCount: () => calls, fetchImpl };
}

describe("fail-soft behavior", () => {
  // With uninterrupted failures the circuit breaker trips on the 3rd
  // failure, so the 4th failure (which would print the "suppressed" line)
  // never happens — the breaker's trip line takes its place. The
  // "suppressed" line still fires when successes interleave (next test).
  test("rejecting fetch: settle resolves, warns for first 3 failures then trips the breaker", async () => {
    const warn = spyWarn();
    const { callCount, fetchImpl } = scriptedFetch([]);
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    for (let i = 0; i < 5; i++) {
      emitter.executionStarted({ testId: `t-${i}`, profileId: "p-1" });
    }
    await emitter.settle();

    expect(callCount()).toBe(3);
    expect(warn).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 3; i++) {
      expect(warn.mock.calls[i]).toEqual([
        "[run-events] failed to post execution_started event: connection refused",
      ]);
    }
    expect(warn.mock.calls[3]).toEqual([BREAKER_WARNING]);
  });

  test("interleaved successes: warning cap suppresses per-event noise without tripping the breaker", async () => {
    const warn = spyWarn();
    // fail, fail, ok, fail, fail — 4 total failures (cap + "suppressed"
    // line) but never 3 consecutive, so every event still hits fetch.
    const { callCount, fetchImpl } = scriptedFetch([
      "fail",
      "fail",
      "ok",
      "fail",
      "fail",
    ]);
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    for (let i = 0; i < 5; i++) {
      emitter.executionStarted({ testId: `t-${i}`, profileId: "p-1" });
    }
    await emitter.settle();

    expect(callCount()).toBe(5);
    expect(warn).toHaveBeenCalledTimes(4);
    for (let i = 0; i < 3; i++) {
      expect(warn.mock.calls[i]).toEqual([
        "[run-events] failed to post execution_started event: connection refused",
      ]);
    }
    expect(warn.mock.calls[3]).toEqual([
      "[run-events] further event-post warnings suppressed",
    ]);
  });

  test("timeout: a never-resolving fetch is aborted and settle resolves", async () => {
    const warn = spyWarn();
    const timeoutMs = 5;
    const seenSignals: Array<AbortSignal | null | undefined> = [];
    const fetchImpl = ((_url: unknown, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        seenSignals.push(init?.signal);
        // The timer behind AbortSignal.timeout() is unref'd, so if this
        // pending promise were the only work, Bun could exit the event loop
        // without ever firing it and settle() would hang. A real (ref'd)
        // setTimeout keeps the loop alive long enough for the abort to fire,
        // and doubles as a fallback rejection so the test can never hang.
        const fallback = setTimeout(() => {
          reject(new Error("fake fetch: abort never fired"));
        }, timeoutMs + 200);
        init?.signal?.addEventListener("abort", () => {
          clearTimeout(fallback);
          reject(init.signal?.reason ?? new Error("aborted"));
        });
      })) as typeof fetch;
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
      timeoutMs,
    });

    emitter.runFinished("failed");
    await emitter.settle();

    expect(seenSignals).toHaveLength(1);
    expect(seenSignals[0]?.aborted).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toStartWith(
      "[run-events] failed to post run_finished event:",
    );
  });

  test("non-2xx response: warned, nothing thrown", async () => {
    const warn = spyWarn();
    const fetchImpl = ((_url: unknown) =>
      Promise.resolve(new Response(null, { status: 500 }))) as typeof fetch;
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    emitter.runStarted("bench", []);
    await emitter.settle();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual([
      "[run-events] failed to post run_started event: HTTP 500",
    ]);
  });
});

describe("circuit breaker", () => {
  test("trips after 3 consecutive failures: later events never call fetch, settle resolves", async () => {
    const warn = spyWarn();
    const { callCount, fetchImpl } = scriptedFetch([]);
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    emitter.executionStarted({ testId: "t-1", profileId: "p-1" });
    emitter.executionStarted({ testId: "t-2", profileId: "p-1" });
    emitter.executionStarted({ testId: "t-3", profileId: "p-1" });
    await emitter.settle();
    expect(callCount()).toBe(3);

    // 4th event onward: short-circuited, no network attempt, no new warns.
    const warnsAtTrip = warn.mock.calls.length;
    emitter.executionStarted({ testId: "t-4", profileId: "p-1" });
    emitter.runFinished("failed");
    await emitter.settle();

    expect(callCount()).toBe(3);
    expect(warn).toHaveBeenCalledTimes(warnsAtTrip);
    const tripLines = warn.mock.calls.filter((c) => c[0] === BREAKER_WARNING);
    expect(tripLines).toHaveLength(1);
  });

  test("a success resets the consecutive counter: trips only after the post-success run of 3", async () => {
    const warn = spyWarn();
    // fail, fail, ok (reset), fail, fail, fail — breaker trips on event 6.
    const { callCount, fetchImpl } = scriptedFetch([
      "fail",
      "fail",
      "ok",
      "fail",
      "fail",
      "fail",
    ]);
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    for (let i = 0; i < 6; i++) {
      emitter.executionStarted({ testId: `t-${i}`, profileId: "p-1" });
    }
    await emitter.settle();

    // All 6 events reached fetch — the pre-success failures did not count
    // toward the post-success streak.
    expect(callCount()).toBe(6);
    expect(
      warn.mock.calls.filter((c) => c[0] === BREAKER_WARNING),
    ).toHaveLength(1);

    // Now tripped: a 7th event is dropped without a fetch call.
    emitter.runFinished("failed");
    await emitter.settle();
    expect(callCount()).toBe(6);
  });

  test("trip warning is logged exactly once even as more events are dropped", async () => {
    const warn = spyWarn();
    const { fetchImpl } = scriptedFetch([]);
    const emitter = createRunEventEmitter({
      config,
      sessionId: "s1",
      fetchImpl,
    });

    for (let i = 0; i < 10; i++) {
      emitter.executionStarted({ testId: `t-${i}`, profileId: "p-1" });
    }
    await emitter.settle();

    expect(
      warn.mock.calls.filter((c) => c[0] === BREAKER_WARNING),
    ).toHaveLength(1);
  });
});

describe("resolveRunEventsConfig", () => {
  test("returns config when both vars are set, stripping trailing slashes", () => {
    expect(
      resolveRunEventsConfig({
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com/",
        QA_AUTH_TOKEN: "tok",
      }),
    ).toEqual({ baseUrl: "https://qa.example.com", authToken: "tok" });
  });

  test("undefined when either var is missing or whitespace", () => {
    expect(resolveRunEventsConfig({})).toBeUndefined();
    expect(
      resolveRunEventsConfig({
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com",
      }),
    ).toBeUndefined();
    expect(resolveRunEventsConfig({ QA_AUTH_TOKEN: "tok" })).toBeUndefined();
    expect(
      resolveRunEventsConfig({
        EVAL_RESULTS_UPLOAD_URL: "   ",
        QA_AUTH_TOKEN: "tok",
      }),
    ).toBeUndefined();
    expect(
      resolveRunEventsConfig({
        EVAL_RESULTS_UPLOAD_URL: "https://qa.example.com",
        QA_AUTH_TOKEN: "  ",
      }),
    ).toBeUndefined();
  });

  test("trims surrounding whitespace from both values", () => {
    expect(
      resolveRunEventsConfig({
        EVAL_RESULTS_UPLOAD_URL: " https://qa.example.com// ",
        QA_AUTH_TOKEN: " tok ",
      }),
    ).toEqual({ baseUrl: "https://qa.example.com", authToken: "tok" });
  });
});
