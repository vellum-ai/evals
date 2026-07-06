/**
 * Bridge from run-metadata writes to qa-dashboard execution events.
 *
 * `commands/run.ts` registers `observer` via `setRunMetadataObserver`
 * (the shared finalization seam in `src/lib/metrics.ts` that all three
 * benchmark runners funnel through), and the bridge translates each
 * run.json status transition into `execution_started` /
 * `execution_completed` events on the given emitter — no per-benchmark
 * event code anywhere.
 *
 * The observer must be synchronous-and-cheap (see the seam's contract),
 * so terminal statuses spawn a fire-and-forget task that reads the
 * run's persisted metrics/usage and enqueues `execution_completed`.
 * `settle()` lets the caller wait for those tasks before emitting
 * `run_finished`. Strictly fail-soft: a broken read only warns.
 */
import type { RunMetadata, RunMetadataObserver } from "./metrics";
import { readMetricResults, readUsage } from "./metrics";
import { runtimeMs, scoreTotal } from "./report-data";
import type { RunEventEmitter } from "./run-events";

export function createRunEventsBridge(input: {
  emitter: RunEventEmitter;
  sessionId: string;
}): { observer: RunMetadataObserver; settle(): Promise<void> } {
  // Dedupe per runId: `running` is rewritten by every heartbeat tick,
  // and a terminal status can be written more than once (e.g. a failed
  // catch path racing the scavenger). First write of each kind wins.
  const startedEmitted = new Set<string>();
  const completedEmitted = new Set<string>();
  const pending: Promise<void>[] = [];

  const buildExecutionCompleted = async (
    metadata: RunMetadata,
    status: "completed" | "failed",
  ): Promise<void> => {
    try {
      // Metrics and usage are already on disk when a terminal status
      // lands: every runner persists them before its final metadata
      // write (run-once.ts `writeMetricResults` precedes the
      // `completed` `writeRunMetadata`; compaction-thrash's runner.ts
      // writes usage + `writeMetricResults` before its
      // `updateRunMetadata(completed)`; longmemeval-v2's runner.ts
      // writes `artifacts.metricsPath` and usage before its
      // `updateRunMetadata(completed)`). A `failed` run may have
      // scored nothing — the reads then return their empty defaults
      // (`[]` metrics → scoreTotal 0, usage without totalCostUsd).
      const [metrics, usage] = await Promise.all([
        readMetricResults(metadata.runId),
        readUsage(metadata.runId),
      ]);
      input.emitter.executionCompleted({
        testId: metadata.testId,
        profileId: metadata.profileId,
        status,
        scoreTotal: scoreTotal(metrics),
        metrics: metrics.map((m) => ({ id: m.name, score: m.score })),
        runtimeMs: runtimeMs(metadata),
        totalCostUsd: usage.totalCostUsd,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[run-events] failed to build execution_completed for ${metadata.runId}: ${message}`,
      );
    }
  };

  const observer: RunMetadataObserver = (metadata) => {
    // Only mirror writes belonging to this invocation's session —
    // filters scavenger/heartbeat writes for other sessions and legacy
    // runs without a sessionId.
    if (metadata.sessionId !== input.sessionId) return;

    if (metadata.status === "running") {
      if (startedEmitted.has(metadata.runId)) return;
      startedEmitted.add(metadata.runId);
      input.emitter.executionStarted({
        testId: metadata.testId,
        profileId: metadata.profileId,
      });
      return;
    }

    if (metadata.status === "completed" || metadata.status === "failed") {
      if (completedEmitted.has(metadata.runId)) return;
      completedEmitted.add(metadata.runId);
      pending.push(buildExecutionCompleted(metadata, metadata.status));
    }
    // `abandoned`/`unknown` are deliberately ignored: the dashboard
    // renders unresolved rows from the planned matrix.
  };

  return {
    observer,
    /**
     * Resolves once every in-flight execution_completed build has
     * enqueued (or warned). Never rejects. Awaiting the emitter's own
     * `settle()` is the caller's job.
     */
    async settle(): Promise<void> {
      await Promise.allSettled(pending);
    },
  };
}
