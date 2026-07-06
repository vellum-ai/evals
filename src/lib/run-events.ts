/**
 * Best-effort emitter for the qa dashboard's run-events ingest contract.
 *
 * CONTRACT IS FROZEN. The qa dashboard is being built against the exact
 * endpoint and payload shapes below — do not rename keys, change casing,
 * or alter the event set without coordinating a dashboard change:
 *
 *   POST {EVAL_RESULTS_UPLOAD_URL}/api/evals/runs/{sessionId}/events
 *   Authorization: Bearer {QA_AUTH_TOKEN}
 *   JSON body, one event per POST:
 *
 *   { "event": "run_started",         "emittedAt": ISO, "benchmark": string,
 *     "planned": [{ "testId": string, "profileId": string }] }
 *   { "event": "execution_started",   "emittedAt": ISO, "testId": string, "profileId": string }
 *   { "event": "execution_completed", "emittedAt": ISO, "testId": string, "profileId": string,
 *     "status": "completed" | "failed", "scoreTotal": number,
 *     "metrics": [{ "id": string, "score": number }],
 *     "runtimeMs": number?, "totalCostUsd": number? }
 *   { "event": "run_finished",        "emittedAt": ISO, "status": "succeeded" | "failed" }
 *
 * The emitter is strictly fail-soft: a slow or dead dashboard must never
 * fail (or slow down unboundedly) an eval run. Every POST is appended to a
 * sequential promise chain so events arrive in emission order without
 * piling up concurrent sockets; failures are logged (capped) and swallowed.
 * A consecutive-failure circuit breaker keeps the chain bounded against a
 * dead dashboard: once it trips, remaining posts short-circuit instantly,
 * so settle() drains in microseconds instead of ~timeout-per-event.
 *
 * `run_finished` BYPASSES the tripped breaker: it is the one event the
 * dashboard needs to close the run's live view, so a transient blip that
 * trips the breaker mid-run must not leave the dashboard permanently "in
 * progress" after the endpoint recovers. A tripped breaker still drops
 * every other event, but a run_finished payload always gets one real POST
 * attempt — still under the per-post timeout and still fail-soft, so the
 * tripped-breaker worst-case drain stays bounded (3 consecutive ~5s
 * failures to trip + one ~5s final attempt).
 *
 * Signal-path caveats consumers must tolerate (accepted contract slack —
 * on SIGINT/SIGTERM the flush is bounded and best-effort, see
 * `commands/run.ts`):
 *   - `run_finished` may arrive BEFORE late `execution_completed`
 *     stragglers that were still being built when the signal landed.
 *   - a `run_finished` with status "failed" may arrive with NO subsequent
 *     bundle upload (the process exits before auto-publish runs).
 */

/** One planned (test × profile) execution in the run matrix. */
export interface PlannedExecution {
  testId: string;
  profileId: string;
}

export interface RunStartedEvent {
  event: "run_started";
  emittedAt: string;
  benchmark: string;
  planned: PlannedExecution[];
}

export interface ExecutionStartedEvent {
  event: "execution_started";
  emittedAt: string;
  testId: string;
  profileId: string;
}

export interface ExecutionCompletedEvent {
  event: "execution_completed";
  emittedAt: string;
  testId: string;
  profileId: string;
  status: "completed" | "failed";
  scoreTotal: number;
  metrics: Array<{ id: string; score: number }>;
  /** Omitted (never null) when unknown. */
  runtimeMs?: number;
  /** Omitted (never null) when unknown. */
  totalCostUsd?: number;
}

export interface RunFinishedEvent {
  event: "run_finished";
  emittedAt: string;
  status: "succeeded" | "failed";
}

export type RunEvent =
  | RunStartedEvent
  | ExecutionStartedEvent
  | ExecutionCompletedEvent
  | RunFinishedEvent;

export interface RunEventsConfig {
  baseUrl: string;
  authToken: string;
}

/**
 * Resolve the emitter config from the environment. Returns the config only
 * when both `EVAL_RESULTS_UPLOAD_URL` and `QA_AUTH_TOKEN` are set to
 * non-whitespace values; otherwise `undefined` (live results disabled).
 */
export function resolveRunEventsConfig(
  env: NodeJS.ProcessEnv = process.env,
): RunEventsConfig | undefined {
  const baseUrl = env.EVAL_RESULTS_UPLOAD_URL?.trim();
  const authToken = env.QA_AUTH_TOKEN?.trim();
  if (!baseUrl || !authToken) return undefined;
  return { baseUrl: baseUrl.replace(/\/+$/, ""), authToken };
}

export interface RunEventEmitter {
  runStarted(benchmark: string, planned: PlannedExecution[]): void;
  executionStarted(e: { testId: string; profileId: string }): void;
  executionCompleted(e: {
    testId: string;
    profileId: string;
    status: "completed" | "failed";
    scoreTotal: number;
    metrics: Array<{ id: string; score: number }>;
    runtimeMs?: number;
    totalCostUsd?: number;
  }): void;
  runFinished(status: "succeeded" | "failed"): void;
  /**
   * Resolves once every enqueued POST has finished (success or failure).
   * Never rejects.
   */
  settle(): Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 5000;
const MAX_FAILURE_WARNINGS = 3;
/**
 * Circuit breaker: after this many CONSECUTIVE post failures the dashboard
 * is treated as unreachable and every remaining post short-circuits without
 * touching the network (a success before the threshold resets the streak).
 * Aligned with MAX_FAILURE_WARNINGS so the trip line lands right after the
 * last per-event warning.
 */
const BREAKER_CONSECUTIVE_FAILURES = 3;

export function createRunEventEmitter(input: {
  config: RunEventsConfig;
  sessionId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): RunEventEmitter {
  const fetchImpl = input.fetchImpl ?? fetch;
  const timeoutMs = input.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const url = `${input.config.baseUrl}/api/evals/runs/${encodeURIComponent(input.sessionId)}/events`;

  let chain: Promise<void> = Promise.resolve();
  let failureCount = 0;
  let consecutiveFailures = 0;
  let breakerTripped = false;

  const warnFailure = (event: string, reason: unknown): void => {
    failureCount += 1;
    if (failureCount <= MAX_FAILURE_WARNINGS) {
      const message = reason instanceof Error ? reason.message : String(reason);
      console.warn(`[run-events] failed to post ${event} event: ${message}`);
    } else if (failureCount === MAX_FAILURE_WARNINGS + 1) {
      console.warn("[run-events] further event-post warnings suppressed");
    }
  };

  // Warning-cap interaction: `failureCount` (per-event warnings + one
  // "suppressed" line) counts TOTAL failures across the run, while the
  // breaker counts CONSECUTIVE failures. When the dashboard is dead from
  // the start the breaker trips on the 3rd failure and the only later
  // failure possible is run_finished's breaker-bypass attempt (which then
  // prints the "suppressed" line). When successes interleave, both lines
  // can appear — that's intentional: the cap silences per-event noise, the
  // trip line announces the drop.
  const noteFailure = (event: string, reason: unknown): void => {
    warnFailure(event, reason);
    consecutiveFailures += 1;
    if (
      !breakerTripped &&
      consecutiveFailures >= BREAKER_CONSECUTIVE_FAILURES
    ) {
      breakerTripped = true;
      console.warn(
        `[run-events] dashboard unreachable after ${BREAKER_CONSECUTIVE_FAILURES} consecutive failures — dropping remaining events`,
      );
    }
  };

  const post = async (payload: RunEvent): Promise<void> => {
    // Breaker tripped: the dashboard is considered dead — drop the event
    // without a network round-trip so the chain (and settle()) stays fast.
    // Exception: run_finished always gets one real attempt (bounded by the
    // per-post timeout) — the breaker may have tripped on a transient blip,
    // and without run_finished the dashboard can never close the run.
    if (breakerTripped && payload.event !== "run_finished") return;
    try {
      const response = await fetchImpl(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${input.config.authToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) {
        consecutiveFailures = 0;
      } else {
        noteFailure(payload.event, `HTTP ${response.status}`);
      }
    } catch (error) {
      noteFailure(payload.event, error);
    }
  };

  const enqueue = (payload: RunEvent): void => {
    chain = chain.then(() => post(payload)).catch(() => {});
  };

  return {
    runStarted(benchmark, planned) {
      enqueue({
        event: "run_started",
        emittedAt: new Date().toISOString(),
        benchmark,
        planned,
      });
    },
    executionStarted(e) {
      enqueue({
        event: "execution_started",
        emittedAt: new Date().toISOString(),
        testId: e.testId,
        profileId: e.profileId,
      });
    },
    executionCompleted(e) {
      const payload: ExecutionCompletedEvent = {
        event: "execution_completed",
        emittedAt: new Date().toISOString(),
        testId: e.testId,
        profileId: e.profileId,
        status: e.status,
        scoreTotal: e.scoreTotal,
        metrics: e.metrics,
      };
      if (e.runtimeMs !== undefined) payload.runtimeMs = e.runtimeMs;
      if (e.totalCostUsd !== undefined) payload.totalCostUsd = e.totalCostUsd;
      enqueue(payload);
    },
    runFinished(status) {
      enqueue({
        event: "run_finished",
        emittedAt: new Date().toISOString(),
        status,
      });
    },
    settle() {
      return chain.then(
        () => undefined,
        () => undefined,
      );
    },
  };
}
