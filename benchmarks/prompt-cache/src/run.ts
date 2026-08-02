/**
 * Prompt-cache benchmark, top-level execution.
 *
 * Drives a Cartesian profile × scenario loop through a runner that sends a
 * short, fully deterministic conversation and scores how well the
 * assistant's prompt cache was used, from the egress jail's recorded
 * usage. The point is cross-provider comparability: the same scenario run
 * against an Anthropic-pinned and an OpenAI-pinned profile should score
 * the same if both place cache breakpoints correctly.
 *
 * Operator surface (env vars):
 *
 *   EVALS_PROMPT_CACHE_MODEL   pin the model whose requests are scored
 *                              instead of inferring it as the model
 *                              carrying the most prompt tokens
 */
import { randomBytes } from "node:crypto";

import type {
  Benchmark,
  BenchmarkRunInput,
  BenchmarkRunResult,
} from "../../../src/lib/benchmark.js";
import {
  applyUnitLimit,
  invokeReportPlanned,
} from "../../../src/lib/benchmark.js";
import { listBenchmarkUnitIds } from "../../../src/lib/catalog.js";
import type { EvalProgressReporter } from "../../../src/lib/runner/progress.js";
import { wasErrorReportedToProgress } from "../../../src/lib/runner/run-once.js";
import { runWithConcurrency } from "../../../src/lib/runner/concurrency.js";

import { runPromptCacheScenario } from "./runner.js";

function timestampSuffix(): string {
  const ms = new Date()
    .toISOString()
    .replace(/[^0-9]/g, "")
    .slice(0, 17);
  const rand = randomBytes(2).toString("hex");
  return `${ms}-${rand}`;
}

function runId(
  profileId: string,
  scenarioId: string,
  timestamp: string,
): string {
  return `eval-${profileId}-${scenarioId}-${timestamp}`;
}

function reportRunFailure(progress: EvalProgressReporter, err: unknown): void {
  if (wasErrorReportedToProgress(err)) return;
  progress({
    step: "shutdown",
    status: "error",
    message: err instanceof Error ? err.message : String(err),
  });
}

export async function run(
  benchmark: Benchmark,
  input: BenchmarkRunInput,
): Promise<BenchmarkRunResult> {
  const {
    profiles,
    filterIds,
    filterFlag,
    limit,
    session,
    sessionLabel,
    cliArgv,
    progress,
  } = input;

  const selectedScenarioIds =
    filterIds.length > 0
      ? filterIds
      : await listBenchmarkUnitIds(benchmark.unitsDir);
  const scenarioIds = applyUnitLimit(selectedScenarioIds, limit);
  if (scenarioIds.length === 0) {
    throw new Error(
      filterFlag !== undefined
        ? "--filter is empty after splitting on commas"
        : `Benchmark "${benchmark.id}" has no ${benchmark.manifest.unitNoun} units at ${benchmark.unitsDir}`,
    );
  }

  const mainModelOverride =
    process.env.EVALS_PROMPT_CACHE_MODEL?.trim() || undefined;

  const pairs = profiles.flatMap((profile) =>
    scenarioIds.map((scenarioId) => ({ profile, scenarioId })),
  );

  // Planned-row testId is the scenario id (see invokeReportPlanned's
  // contract).
  await invokeReportPlanned(
    input,
    pairs.map(({ profile, scenarioId }) => ({
      testId: scenarioId,
      profileId: profile.id,
    })),
  );

  const tasks = pairs.map(({ profile, scenarioId }) => {
    const id = runId(profile.id, scenarioId, timestampSuffix());
    return async () => {
      try {
        await runPromptCacheScenario({
          profile,
          scenarioId,
          runId: id,
          sessionId: session,
          sessionLabel,
          cliArgv,
          progress,
          mainModelOverride,
        });
      } catch (err) {
        reportRunFailure(progress, err);
        throw err;
      }
    };
  });

  const result = await runWithConcurrency(tasks, input.workers ?? 1);
  return { anyFailed: result.anyFailed };
}
