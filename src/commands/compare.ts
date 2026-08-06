/**
 * `evals compare` — A/B two exported JSONL sessions.
 *
 * Takes two flat exports produced by `evals export --session <id> --out
 * *.jsonl`, joins them on (testId, profileId), and prints per-test or
 * per-profile deltas/ratios for score, cost, tokens, and runtime. Passing
 * the same file twice with `--by profile` compares the profiles within a
 * single session (e.g. vellum-default vs hermes-default cost ratio).
 *
 * Thin wrapper: reads the files and delegates to `src/lib/compare-data.ts`.
 */
import { readFile } from "node:fs/promises";

import type { Command } from "commander";
import { Option } from "commander";

import {
  compareExports,
  formatComparison,
  parseExportJsonl,
  type CompareAxis,
  type CompareFormat,
} from "../lib/compare-data";

export function registerCompareCommand(program: Command): void {
  program
    .command("compare")
    .description(
      "Compare two exported JSONL sessions (from `evals export --out *.jsonl`) " +
        "on score, cost, tokens, and runtime",
    )
    .argument("<a>", "Baseline export (side A)")
    .argument("<b>", "Comparison export (side B)")
    .addOption(
      new Option("--format <format>", "Output format")
        .choices(["table", "md", "json"] satisfies CompareFormat[])
        .default("table"),
    )
    .addOption(
      new Option(
        "--by <axis>",
        "Comparison axis: test (per test × profile) or profile (aggregates)",
      )
        .choices(["test", "profile"] satisfies CompareAxis[])
        .default("test"),
    )
    .action(
      async (
        aPath: string,
        bPath: string,
        opts: { format: CompareFormat; by: CompareAxis },
      ) => {
        const [aText, bText] = await Promise.all([
          readFile(aPath, "utf8"),
          readFile(bPath, "utf8"),
        ]);
        const result = compareExports(
          parseExportJsonl(aText, aPath),
          parseExportJsonl(bText, bPath),
        );
        console.log(formatComparison(result, opts));
      },
    );
}
