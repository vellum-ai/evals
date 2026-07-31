/**
 * Per-scenario runner for the prompt-cache benchmark.
 *
 * Hatches a Vellum assistant, walks one conversation through a fixed set
 * of short user turns, then scores the prompt-cache behavior the egress
 * jail recorded on the wire. The turns are deliberately cheap: the object
 * under test is the *prefix* (system prompt, tool schemas, prior turns),
 * so what matters is how much of it each request re-billed rather than how
 * much new text a turn added.
 *
 * Scoring reads `readUsageRecords()` (the mitmproxy addon's
 * `egress-usage.ndjson`), not emitted events. Cache accounting is exactly
 * the thing an assistant-side bug would misreport, so the assistant is
 * never asked to grade itself. Live SSE `usage_update` events are still
 * folded into the run's usage summary for the report's cost panel.
 */
import { writeFile } from "node:fs/promises";

import type { AgentEvent } from "../../../src/lib/adapter.js";
import { confirmationRequestId } from "../../../src/lib/adapter.js";
import {
  type EvalRunResult,
  markErrorAsReportedToProgress,
} from "../../../src/lib/runner/run-once.js";
import type { EvalProgressReporter } from "../../../src/lib/runner/progress.js";
import { createRunProgressLifecycle } from "../../../src/lib/runner/progress-lifecycle.js";
import {
  appendAssistantEvents,
  appendSimulatorMessage,
  appendTranscriptTurn,
  ensureRunArtifacts,
  type MetricResult,
  updateRunMetadata,
  writeMetricResults,
  writeRunMetadata,
  writeUsage,
} from "../../../src/lib/metrics.js";
import type { Profile } from "../../../src/lib/profile.js";
import type { TranscriptTurn } from "../../../src/lib/transcript.js";
import {
  mergeUsageSummaries,
  summarizeAssistantUsage,
} from "../../../src/lib/usage.js";
import { createAgent } from "../../../src/lib/runner/create-agent.js";
import { AgentEventCollector } from "../../../src/lib/runner/event-collector.js";

import {
  buildCacheObservations,
  computeCacheMetrics,
  type CacheObservations,
} from "./cache-metrics.js";
import { resolveScenario } from "./scenarios.js";

/** Hard wall-clock cap per turn. */
const TURN_MAX_MS = 5 * 60_000;

/**
 * Quiet window for trailing events after a turn signals completion. The
 * assistant emits its `assistant_usage` record just after
 * `message_complete`, so the window only has to outlast that gap.
 */
const TURN_TRAILER_QUIET_MS = 5_000;

/** Per-run artifact holding the full per-request cache table. */
const OBSERVATIONS_FILENAME = "cache-observations.json";

export interface RunPromptCacheInput {
  profile: Profile;
  scenarioId: string;
  runId: string;
  sessionId?: string;
  sessionLabel?: string;
  cliArgv?: string[];
  progress?: EvalProgressReporter;
  /** Pin the scored model instead of inferring it from prompt-token share. */
  mainModelOverride?: string;
}

function metricSummaryLine(metrics: MetricResult[]): string {
  return metrics
    .map((metric) =>
      metric.unit === "raw"
        ? `${metric.name}=${metric.score}`
        : `${metric.name}=${(metric.score * 100).toFixed(1)}%`,
    )
    .join(", ");
}

/**
 * Describe what the wire showed about explicit marker placement, for the
 * progress log. The `cache-observations.json` artifact carries the full
 * per-request detail; this is the one-line version a human watching the
 * run can act on.
 */
function markerSummaryLine(observations: CacheObservations): string {
  const first = observations.requests[0];
  if (!first) return "no main-model requests recorded";
  if (!first.markers) {
    return first.requestBodyTruncated
      ? "request 1 body truncated, markers unreadable"
      : "request 1 body unparseable, markers unreadable";
  }
  const markers = first.markers;
  return [
    `cache_control=${markers.cacheControlBlocks}`,
    `prompt_cache_key=${markers.promptCacheKey}`,
    `prompt_cache_mode=${markers.promptCacheMode ?? "none"}`,
    `prompt_cache_breakpoint=${markers.promptCacheBreakpoints}`,
  ].join(" ");
}

export async function runPromptCacheScenario(
  input: RunPromptCacheInput,
): Promise<EvalRunResult> {
  const scenario = resolveScenario(input.scenarioId);
  const sessionId = input.sessionId ?? input.runId;

  const { progress, dispose, flush } = createRunProgressLifecycle({
    runId: input.runId,
    userProgress: input.progress,
  });

  const startedAt = new Date().toISOString();
  let artifactDir = "";

  const agent = createAgent({
    profile: input.profile,
    testId: input.scenarioId,
    runId: input.runId,
  });

  try {
    progress({
      step: "artifacts",
      status: "start",
      message: "Preparing run artifacts",
      detail: input.runId,
    });
    const artifacts = await ensureRunArtifacts(input.runId);
    artifactDir = artifacts.runDir;
    progress({
      step: "artifacts",
      status: "done",
      message: "Run artifacts ready",
      detail: artifactDir,
    });

    await writeRunMetadata(input.runId, {
      runId: input.runId,
      sessionId,
      sessionLabel: input.sessionLabel,
      cliArgv: input.cliArgv,
      profileId: input.profile.id,
      testId: input.scenarioId,
      status: "running",
      startedAt,
      artifactDir,
    });

    progress({
      step: "hatch",
      status: "start",
      message: "Hatching assistant",
      detail: input.profile.id,
    });
    await agent.hatch();
    progress({
      step: "hatch",
      status: "done",
      message: "Assistant ready",
      detail: agent.id,
    });

    progress({
      step: "events",
      status: "start",
      message: "Subscribing to assistant events",
      detail: agent.conversationKey,
    });
    const collector = new AgentEventCollector(
      agent.events()[Symbol.asyncIterator](),
    );
    progress({
      step: "events",
      status: "done",
      message: "Assistant event stream connected",
      detail: agent.conversationKey,
    });

    // Approve every tool confirmation the assistant raises. The scenarios
    // ask for one harmless shell command and there is no simulator here to
    // judge risk, so a headless run would otherwise stall until the turn's
    // hard cap.
    const approvePendingConfirmation = async (
      event: AgentEvent,
    ): Promise<void> => {
      const requestId = confirmationRequestId(event);
      if (requestId === undefined || typeof agent.confirm !== "function") {
        return;
      }
      await agent.confirm({ requestId, decision: "allow" });
    };

    const allEvents: AgentEvent[] = [];
    const transcript: TranscriptTurn[] = [];

    for (const [turnIndex, message] of scenario.turns.entries()) {
      const turn = turnIndex + 1;
      progress({
        step: "send",
        status: "start",
        message: `Sending turn ${turn}/${scenario.turns.length}`,
        turn,
      });

      await appendSimulatorMessage(input.runId, { content: message });
      const turnTimestamp = new Date().toISOString();
      transcript.push({
        role: "simulator",
        content: message,
        emittedAt: turnTimestamp,
      });
      await appendTranscriptTurn(input.runId, {
        role: "simulator",
        content: message,
        emittedAt: turnTimestamp,
      });
      await agent.send({ content: message });

      progress({
        step: "send",
        status: "done",
        message: `Turn ${turn} sent`,
        turn,
      });

      progress({
        step: "events",
        status: "start",
        message: `Waiting for assistant response (turn ${turn})`,
        turn,
      });

      const { events, completed } = await collector.collectUntilTurnComplete({
        isComplete: (event) => agent.isTurnComplete(event),
        maxMs: TURN_MAX_MS,
        graceQuietMs: TURN_TRAILER_QUIET_MS,
        onEvent: approvePendingConfirmation,
      });
      allEvents.push(...events);
      await appendAssistantEvents(input.runId, events);

      for (const event of events) {
        const text = event.message.text ?? event.message.chunk;
        if (text?.trim()) {
          const eventTimestamp = event.emittedAt ?? new Date().toISOString();
          transcript.push({
            role: "assistant",
            content: text.trim(),
            emittedAt: eventTimestamp,
          });
          await appendTranscriptTurn(input.runId, {
            role: "assistant",
            content: text.trim(),
            emittedAt: eventTimestamp,
          });
        }
      }

      progress({
        step: "events",
        status: completed ? "done" : "error",
        message: completed
          ? `Turn ${turn}: ${events.length} events`
          : `Turn ${turn} never signalled completion after ${events.length} events`,
        turn,
      });

      // Persist usage after every turn so a partial run is inspectable.
      await writeUsage(input.runId, summarizeAssistantUsage(allEvents));
    }

    // Wire truth. The recorded usage is both the cost ledger and the sole
    // input to cache scoring.
    const recordedUsage = (await agent.readUsageRecords?.()) ?? [];
    if (recordedUsage.length > 0) {
      const recordedEvents: AgentEvent[] = recordedUsage.map((usage) => ({
        message: { type: "usage", usage },
      }));
      await writeUsage(
        input.runId,
        mergeUsageSummaries(
          summarizeAssistantUsage(allEvents),
          summarizeAssistantUsage(recordedEvents),
        ),
      );
    }

    const observations = buildCacheObservations({
      records: recordedUsage,
      mainModelOverride: input.mainModelOverride,
    });
    await writeFile(
      `${artifactDir}/${OBSERVATIONS_FILENAME}`,
      JSON.stringify(observations, null, 2),
    );

    progress({
      step: "metrics",
      status: "start",
      message: `Scoring ${observations.requests.length} ${observations.mainModel ?? "unknown"} requests (${markerSummaryLine(observations)})`,
      detail: input.scenarioId,
    });

    const metrics = computeCacheMetrics(observations);
    await writeMetricResults(input.runId, metrics);

    const summary = metricSummaryLine(metrics);
    progress({
      step: "metrics",
      status: "done",
      message: `Metrics: ${summary}`,
      detail: input.scenarioId,
    });
    progress({
      step: "result",
      status: "done",
      message: `Run completed: ${summary}`,
      detail: input.scenarioId,
    });

    await updateRunMetadata(input.runId, (current) =>
      current
        ? {
            ...current,
            status: "completed",
            completedAt: new Date().toISOString(),
          }
        : undefined,
    );

    return {
      runId: input.runId,
      profileId: input.profile.id,
      testId: input.scenarioId,
      artifactDir,
      transcript,
      metrics,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    progress({ step: "shutdown", status: "error", message });
    markErrorAsReportedToProgress(err);
    await updateRunMetadata(input.runId, (current) =>
      current
        ? {
            ...current,
            status: "failed",
            completedAt: new Date().toISOString(),
            error: message,
          }
        : undefined,
    ).catch(() => undefined);
    throw err;
  } finally {
    dispose();
    try {
      await agent.shutdown();
    } catch {
      // Best-effort teardown.
    }
    // Drain queued `progress.ndjson` appends. See `flush()`'s doc
    // comment in progress-lifecycle.ts.
    await flush();
  }
}
