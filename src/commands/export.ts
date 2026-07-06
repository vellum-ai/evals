/**
 * `evals export` — export a report session in one of three shapes, chosen by
 * the `--out` value:
 *
 *   • `--out card.jsonl` → a flat JSONL summary (scores/metrics) for eval
 *     comparison and diffing.
 *   • `--out run.tar`    → a self-contained static-site bundle of the full
 *     report (overview + per-execution transcripts/events + raw artifacts),
 *     hostable as plain files — e.g. uploaded to the QA dashboard for viewing.
 *   • `--out https://qa.vellum.ai` → build the bundle and push it to the QA
 *     dashboard's upload endpoint, so the run is immediately viewable online.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import type { Command } from "commander";

import { pushBundleToUrl } from "../lib/bundle-push";
import {
  buildRunBundle,
  isBundleOutput,
  isHttpUrlOut,
  NoSessionError,
  writeBundleTar,
} from "../lib/report-bundle";
import {
  findExecutionRunId,
  readReportRun,
  readReportSession,
  readTestInSession,
} from "../lib/report-data";

type ExportRecord =
  | {
      // v2: the execution payload reports `assistantResponses` (folded
      // assistant replies) + `runtimeMs`, replacing v1's `transcriptTurns`
      // (raw per-delta transcript-entry count).
      type: "metadata";
      schemaVersion: 2;
      exportedAt: string;
      sessionId: string;
    }
  | { type: "session"; session: Awaited<ReturnType<typeof readReportSession>> }
  | {
      type: "test";
      test: NonNullable<Awaited<ReturnType<typeof readTestInSession>>>;
    }
  | {
      type: "execution";
      sessionId: string;
      testId: string;
      profileId: string;
      run: {
        runId: string;
        status: string;
        scoreTotal: number;
        metricCount: number;
        metrics: unknown[];
        assistantResponses: number;
        runtimeMs?: number;
        assistantEventCount: number;
        simulatorMessageCount: number;
        totalInputTokens?: number;
        totalOutputTokens?: number;
        totalCostUsd?: number;
      };
    };

function encodeJsonl(records: ExportRecord[]): string {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description(
      "Export a report session: --out *.jsonl for a comparison summary, " +
        "--out *.tar (or *.tar.gz/*.tgz) for a self-contained, viewable bundle",
    )
    .requiredOption("--session <id>", "Session id to export")
    .requiredOption(
      "--out <path>",
      "Output path; *.tar/*.tar.gz/*.tgz bundles the full report, " +
        "an https:// URL pushes the bundle to a QA dashboard, " +
        "anything else writes a JSONL summary",
    )
    .action(async (opts: { session: string; out: string }) => {
      if (isHttpUrlOut(opts.out)) {
        const { runId, viewUrl } = await pushBundleToUrl(
          opts.session,
          opts.out,
        );
        console.log(
          `Pushed session ${opts.session} → ${viewUrl} (run id: ${runId})`,
        );
        return;
      }

      if (isBundleOutput(opts.out)) {
        const files = await buildRunBundle(opts.session);
        await writeBundleTar(opts.out, files);
        console.log(
          `Bundled session ${opts.session} → ${opts.out} (${files.length} files)`,
        );
        return;
      }

      const session = await readReportSession(opts.session);
      if (!session) {
        throw new NoSessionError(opts.session);
      }

      const records: ExportRecord[] = [
        {
          type: "metadata",
          schemaVersion: 2,
          exportedAt: new Date().toISOString(),
          sessionId: opts.session,
        },
        { type: "session", session },
      ];

      for (const testEntry of session.tests) {
        const test = await readTestInSession(opts.session, testEntry.testId);
        if (!test) continue;
        records.push({ type: "test", test });

        for (const profile of test.profiles) {
          const runId = await findExecutionRunId(
            opts.session,
            test.testId,
            profile.profileId,
          );
          if (!runId) continue;
          const run = await readReportRun(runId);
          records.push({
            type: "execution",
            sessionId: opts.session,
            testId: test.testId,
            profileId: profile.profileId,
            run: {
              runId: run.runId,
              status: run.status,
              scoreTotal: run.scoreTotal,
              metricCount: run.metricCount,
              metrics: run.metrics,
              assistantResponses: run.assistantResponses,
              runtimeMs: run.runtimeMs,
              assistantEventCount: run.assistantEventCount,
              simulatorMessageCount: run.simulatorMessageCount,
              totalInputTokens: run.totalInputTokens,
              totalOutputTokens: run.totalOutputTokens,
              totalCostUsd: run.totalCostUsd,
            },
          });
        }
      }

      await mkdir(dirname(opts.out), { recursive: true });
      await writeFile(opts.out, encodeJsonl(records), "utf8");
      console.log(`Exported ${records.length} records to ${opts.out}`);
    });
}
