/** `evals run` — Cartesian profile × test runner. */
import type { Command } from "commander";

import {
  createConsoleReporter,
  createSummaryOnlyReporter,
} from "../lib/runner/progress";
import {
  abandonAllRunningRunsSync,
  scavengeAbandonedRuns,
  setRunMetadataObserver,
} from "../lib/metrics";
import { reapAbandonedEvalContainers } from "../lib/adapters/docker-reaper";
import { loadBenchmark } from "../lib/benchmark";
import { DEFAULT_BENCHMARK_ID } from "../lib/catalog";
import { loadProfile } from "../lib/profile";
import {
  createRunEventEmitter,
  resolveRunEventsConfig,
} from "../lib/run-events";
import { createRunEventsBridge } from "../lib/run-events-bridge";
import { resolveSessionId } from "../lib/session-id";
import { openInBrowser, startReportServer } from "./server";

/**
 * Exit codes for the signals we handle. POSIX convention: 128 + signal
 * number (SIGINT=2 → 130, SIGTERM=15 → 143) so wrapping shells can
 * distinguish a signal-killed `evals run` from a normal failure exit.
 */
const SIGNAL_EXIT_CODES: Record<"SIGINT" | "SIGTERM", number> = {
  SIGINT: 130,
  SIGTERM: 143,
};

function splitCsv(raw: string): string[] {
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("Run profile × benchmark-unit combinations")
    .requiredOption(
      "--profiles <ids>",
      "Comma-separated profile ids (each maps to profiles/<id>/manifest.json)",
    )
    .option(
      "--benchmark <id>",
      `Benchmark id under benchmarks/ (defaults to ${DEFAULT_BENCHMARK_ID})`,
      DEFAULT_BENCHMARK_ID,
    )
    .option(
      "--filter <ids>",
      "Comma-separated unit ids to run within the benchmark. Omit to run every unit.",
    )
    .option(
      "--tests <ids>",
      "[DEPRECATED] Alias for --filter. Use --benchmark <id> --filter <ids> instead.",
    )
    .option(
      "--limit <n>",
      "Run only the first N units of the benchmark, in the benchmark's natural unit order. Composes with --filter (the limit applies after filtering).",
      (value) => Number(value),
    )
    .option(
      "--label <label>",
      "Human-readable tag stamped onto every (profile, unit) execution in this run, so they cluster together in the report server",
    )
    .option(
      "--session-id <id>",
      "Explicit session id for this run (defaults to $EVAL_RESULTS_SESSION_ID, then a generated id). Used verbatim for .runs/ grouping, the report server, and export — the eval-pod launcher sets the env var so its run id and the uploaded bundle id coincide.",
    )
    .option("--max-turns <n>", "Maximum simulator turns per run", (value) =>
      Number(value),
    )
    .option(
      "--quiet",
      "Suppress per-step progress (still surfaces the final result and any errors)",
    )
    .option(
      "--workers <n>",
      "Number of concurrent runs to execute in parallel (default: 1). Each unit hatches its own container(s), so set this according to host resources.",
      (value) => Number(value),
      1,
    )
    .option(
      "--serve",
      "After the run finishes, start the local report server and open this run's session in the default browser. The server blocks until ctrl-C.",
    )
    .action(
      async (opts: {
        profiles: string;
        benchmark: string;
        filter?: string;
        tests?: string;
        limit?: number;
        label?: string;
        sessionId?: string;
        maxTurns?: number;
        quiet?: boolean;
        serve?: boolean;
        workers?: number;
      }) => {
        // Register signal handlers ONCE per `evals run` invocation (not
        // once per (profile, test) iteration — that would leak listeners
        // and trigger MaxListenersExceededWarning past ~10 runs). On
        // SIGINT/SIGTERM, synchronously flip every `running` run on disk
        // to `abandoned` so they don't dangle, then exit with the POSIX
        // 128+signal convention so wrapping shells see a real exit code.
        for (const signal of ["SIGINT", "SIGTERM"] as const) {
          process.once(signal, () => {
            abandonAllRunningRunsSync({ signal });
            process.exit(SIGNAL_EXIT_CODES[signal]);
          });
        }

        // Before starting a new run, clean up any stale runs that crashed
        // or were killed without properly finalizing their status. This is
        // the async variant — uses the 60s heartbeat threshold, so it only
        // flips genuinely dead runs (not in-flight ones from a parallel
        // `evals run` against the same .runs/ directory).
        await scavengeAbandonedRuns();

        // Container-side companion to the scavenger. `hatchDocker`
        // dynamically allocates the *gateway* host port via
        // `findOpenPort`, but the **assistant** container in
        // `statefulset.ts` binds the daemon's fixed host port (7821)
        // directly. A run that died via SIGKILL/OOM/host-reboot before
        // reaching `agent.shutdown` leaves its assistant container
        // alive on 7821, which then fails every subsequent hatch with
        // "Bind for 0.0.0.0:7821 failed: port is already allocated".
        // The reaper sweeps any `eval-*` container whose owning run is
        // terminal, missing, or `running` with a stale heartbeat.
        // Concurrent runs against the same `.runs/` directory stay
        // safe (live heartbeats preserve their containers).
        const reapResult = await reapAbandonedEvalContainers();
        if (reapResult.reaped.length > 0) {
          console.log(
            `[reaper] removed ${reapResult.reaped.length} abandoned eval container(s): ${reapResult.reaped.join(", ")}`,
          );
        }
        if (reapResult.unparseable.length > 0) {
          console.warn(
            `[reaper] saw ${reapResult.unparseable.length} eval-prefixed container(s) with unrecognized name shape: ${reapResult.unparseable.join(", ")}`,
          );
        }

        // `--tests` is the legacy spelling of `--filter`. Treat it as an
        // alias against the benchmark's units, but reject the ambiguous
        // case where both are supplied with different values — we don't
        // want to silently pick one.
        let filter = opts.filter;
        if (opts.tests !== undefined) {
          console.warn(
            "[evals] --tests is deprecated; use --benchmark <id> --filter <ids>.",
          );
          if (filter !== undefined && filter !== opts.tests) {
            throw new Error(
              "Pass either --filter or the deprecated --tests, not both.",
            );
          }
          filter = filter ?? opts.tests;
        }

        const profiles = await Promise.all(
          splitCsv(opts.profiles).map((id) => loadProfile(id)),
        );
        if (profiles.length === 0)
          throw new Error("--profiles is empty after splitting on commas");

        const benchmark = await loadBenchmark(opts.benchmark);
        const filterIds = filter !== undefined ? splitCsv(filter) : [];

        // `--limit N` truncates the selected units to the first N in the
        // benchmark's natural order — a readable alternative to spelling
        // out N unit ids in --filter. Validated here so every benchmark
        // sees either `undefined` or a positive integer.
        if (opts.limit !== undefined) {
          if (!Number.isInteger(opts.limit) || opts.limit <= 0) {
            throw new Error(
              `--limit must be a positive integer (got "${opts.limit}")`,
            );
          }
        }

        // `--workers N` controls how many (profile, unit) runs execute
        // concurrently. Default is 1 (sequential). Must be a positive
        // integer — 0 or negative would deadlock or no-op.
        if (opts.workers !== undefined) {
          if (!Number.isInteger(opts.workers) || opts.workers <= 0) {
            throw new Error(
              `--workers must be a positive integer (got "${opts.workers}")`,
            );
          }
        }

        // `--quiet` still lets the per-run `result` summary and any
        // `status: "error"` events through so operators get one line per
        // run telling them what happened. Without the filter, a silent
        // failure could hide behind `--quiet` with no signal on stdout
        // or stderr.
        const progress = opts.quiet
          ? createSummaryOnlyReporter()
          : createConsoleReporter();

        // Stamp every execution in this invocation with the same session id
        // so the report server can render them as a single grouped run.
        // The label is stamped on metadata even alongside an explicit id;
        // it is only woven into *generated* ids.
        const session = resolveSessionId({
          explicit: opts.sessionId,
          env: process.env,
          label: opts.label,
        });
        const sessionLabel = opts.label;

        // Live results: when the launcher env (EVAL_RESULTS_UPLOAD_URL +
        // QA_AUTH_TOKEN) is present, mirror this run's lifecycle to the
        // qa dashboard — run_started (planned matrix) via reportPlanned,
        // execution_started/execution_completed via the run-metadata
        // observer seam, run_finished after everything settles. With
        // either env var missing, `eventsConfig` is undefined and the
        // run behaves byte-identically to before.
        const eventsConfig = resolveRunEventsConfig();
        const emitter = eventsConfig
          ? createRunEventEmitter({ config: eventsConfig, sessionId: session })
          : undefined;
        const bridge = emitter
          ? createRunEventsBridge({ emitter, sessionId: session })
          : undefined;
        if (bridge) setRunMetadataObserver(bridge.observer);

        // Snapshot argv at the top of the action handler — Commander
        // doesn't mutate `process.argv` but a downstream library or a
        // signal handler conceivably could, and we want every run in
        // the session to record the same canonical command. `slice()`
        // detaches us from any later in-place edits.
        const cliArgv = process.argv.slice();

        // Polymorphic dispatch — each benchmark's `src/run.ts` owns
        // its own execution shape (Cartesian profile × `TestDef`,
        // ingest→ask over `BenchmarkItem`, …). The CLI just hands
        // it the shared input shape; no `if (id === …)` ladder, no
        // manifest "driver" enum.
        let anyFailed = false;
        let threw = true;
        try {
          const result = await benchmark.run({
            profiles,
            filterIds,
            filterFlag: filter,
            limit: opts.limit,
            session,
            sessionLabel,
            cliArgv,
            progress,
            maxTurns: opts.maxTurns,
            workers: opts.workers,
            reportPlanned: emitter
              ? (planned) => emitter.runStarted(opts.benchmark, planned)
              : undefined,
          });
          anyFailed = result.anyFailed;
          threw = false;
        } finally {
          // Flush live events whether the run returned or threw (the
          // awaits below complete before a throw propagates out of this
          // block). Ordering satisfies the frozen contract — run_finished
          // arrives after every execution event: the bridge's pending
          // execution_completed builds enqueue onto the emitter chain
          // asynchronously, so first `await bridge.settle()` (all
          // execution_completed enqueued), THEN enqueue run_finished,
          // then `await emitter.settle()` to drain the sequential chain.
          // A later PR auto-publishes the report bundle after this block,
          // before --serve.
          if (emitter && bridge) {
            await bridge.settle();
            emitter.runFinished(threw || anyFailed ? "failed" : "succeeded");
            await emitter.settle();
            setRunMetadataObserver(undefined);
          }
        }

        if (anyFailed) {
          process.exitCode = 1;
        }

        if (opts.serve) {
          // Boot the same report server as `evals server` (using its
          // default host/port) and aim the browser at THIS run's
          // session page. The server then blocks on Bun.serve until
          // ctrl-C — we want failures to be reviewable inline, so the
          // exitCode=1 above only takes effect once the user kills
          // the server.
          const { url } = startReportServer();
          const sessionUrl = `${url}/sessions/${encodeURIComponent(session)}`;
          console.log(`Evals report server listening on ${url}`);
          console.log(`Opening ${sessionUrl}`);
          openInBrowser(sessionUrl);
        }
      },
    );
}
