#!/usr/bin/env bun
/**
 * Regenerate `expected/` from the committed `project/` and print the
 * ground-truth figures `truth.ts` carries. Run this rather than editing
 * either by hand:
 *
 *   bun benchmarks/personal-intelligence/lib/fixtures/expense-tracker/regen-expected.ts
 *
 * The script is idempotent: with the project and its data file unchanged
 * it rewrites the same bytes, so a diff after running it means the
 * fixture and the committed ground truth have drifted apart.
 */
import { writeFileSync } from "node:fs";
import { join } from "node:path";

import { monthOf } from "./project/src/format/dates";
import { formatUsd, sumUsd } from "./project/src/format/money";
import { loadEntries } from "./project/src/storage/store";
import { EXPECTED_OUTPUTS, expectedOutputPath } from "./truth";

const projectDir = join(import.meta.dir, "project");

function runCli(args: string[]): string {
  const result = Bun.spawnSync(["bun", "run", "cli.ts", ...args], {
    cwd: projectDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  if (result.exitCode !== 0) {
    throw new Error(
      `bun run cli.ts ${args.join(" ")} exited ${result.exitCode}: ${result.stderr.toString()}`,
    );
  }
  return result.stdout.toString();
}

for (const [name, spec] of Object.entries(EXPECTED_OUTPUTS)) {
  writeFileSync(expectedOutputPath(name), runCli(spec.args), "utf8");
  console.log(`wrote expected/${spec.file}`);
}

const entries = loadEntries();
const months = [...new Set(entries.map((entry) => monthOf(entry.date)))].sort();

console.log("");
console.log("Ground truth (copy into truth.ts):");
for (const month of months) {
  const inMonth = entries.filter((entry) => monthOf(entry.date) === month);
  const total = formatUsd(sumUsd(inMonth.map((entry) => entry.amount)));
  console.log(`  ${month}: ${total} (${inMonth.length} entries)`);
}

const year2025 = entries.filter((entry) => entry.date.startsWith("2025-"));
console.log(
  `  2025 year total: ${formatUsd(sumUsd(year2025.map((entry) => entry.amount)))}`,
);
console.log(
  `  grand total:     ${formatUsd(sumUsd(entries.map((entry) => entry.amount)))}`,
);
