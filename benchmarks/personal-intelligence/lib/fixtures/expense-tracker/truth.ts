/**
 * Ground truth for the shared expense-tracker fixture, used by every test
 * that stages `project/` into the agent workspace. Derived by running
 * `bun regen-expected.ts` in this directory, which rewrites `expected/`
 * and prints exactly these figures. Regenerate that way rather than
 * editing here.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Workspace-relative directory the project is staged under. */
export const TRACKER_DIR = "tracker";

/** What `report month 2025-03` totals. */
export const MARCH_2025_TOTAL = "$157.42";

/** What every 2025 entry totals: the answer a year report must state. */
export const YEAR_2025_TOTAL = "$614.49";

/** What `report total` totals, 2024 entries included. */
export const GRAND_TOTAL = "$717.09";

/**
 * The committed stdout of each command the fixture ships unchanged, keyed
 * by the name metrics refer to it by.
 */
export const EXPECTED_OUTPUTS = {
  list: { file: "list.txt", args: ["list"] },
  "report-month-2025-03": {
    file: "report-month-2025-03.txt",
    args: ["report", "month", "2025-03"],
  },
  "report-total": { file: "report-total.txt", args: ["report", "total"] },
} as const satisfies Record<string, { file: string; args: string[] }>;

export type ExpectedOutputName = keyof typeof EXPECTED_OUTPUTS;

/** Absolute path of one committed expected-output file. */
export function expectedOutputPath(name: string): string {
  const spec = EXPECTED_OUTPUTS[name as ExpectedOutputName];
  if (spec === undefined) {
    throw new Error(`Unknown expected output: ${name}`);
  }
  return join(import.meta.dir, "expected", spec.file);
}

/** The committed stdout of one command, trimmed for comparison. */
export function readExpectedOutput(name: ExpectedOutputName): string {
  return readFileSync(expectedOutputPath(name), "utf8").trim();
}
