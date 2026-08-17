import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { loadTestDef } from "../test-def";
import {
  EXPECTED_OUTPUTS,
  GRAND_TOTAL,
  MARCH_2025_TOTAL,
  readExpectedOutput,
  TRACKER_DIR,
  YEAR_2025_TOTAL,
  type ExpectedOutputName,
} from "../../../benchmarks/personal-intelligence/lib/fixtures/expense-tracker/truth";

const benchmarkDir = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "benchmarks",
  "personal-intelligence",
);
const unitsDir = join(benchmarkDir, "tests");
const projectDir = join(
  benchmarkDir,
  "lib",
  "fixtures",
  "expense-tracker",
  "project",
);

function runCli(args: string[]): { exitCode: number; stdout: string } {
  const result = Bun.spawnSync(["bun", "run", "cli.ts", ...args], {
    cwd: projectDir,
    stdout: "pipe",
    stderr: "pipe",
  });
  return { exitCode: result.exitCode, stdout: result.stdout.toString() };
}

describe("expense-tracker fixture ground truth", () => {
  test("the committed totals appear in the committed command output", () => {
    // Guards the regenerate-only rule: hand-editing either side drifts
    // `truth.ts` away from what the commands actually print.
    expect(readExpectedOutput("report-month-2025-03")).toContain(
      MARCH_2025_TOTAL,
    );
    expect(readExpectedOutput("report-total")).toContain(GRAND_TOTAL);
  });

  test("the year total is not something the shipped commands print", () => {
    // The year view is the feature under test, so its total must not be
    // reachable from the fixture as committed.
    for (const name of Object.keys(EXPECTED_OUTPUTS)) {
      expect(readExpectedOutput(name as ExpectedOutputName)).not.toContain(
        YEAR_2025_TOTAL,
      );
    }
  });

  test("re-running the shipped commands reproduces the committed output", () => {
    // Same assertion `regen-expected.ts` idempotency rests on, without
    // rewriting the fixture: the local project, not a container.
    for (const [name, spec] of Object.entries(EXPECTED_OUTPUTS)) {
      const run = runCli([...spec.args]);
      expect(run.exitCode).toBe(0);
      expect(run.stdout.trim()).toBe(
        readExpectedOutput(name as ExpectedOutputName),
      );
    }
  });

  test("the shipped CLI has no year report yet", () => {
    expect(runCli(["report", "year", "2025"]).exitCode).toBe(1);
  });
});

describe("feature-add test definitions", () => {
  const ids = ["feature-add-basic", "feature-add-medium"];

  for (const id of ids) {
    test(`${id} is experimental and registers its three metrics`, async () => {
      const def = await loadTestDef(id, unitsDir);
      expect(def.status).toBe("experimental");
      expect(def.metricPaths.map((path) => path.split("/").pop())).toEqual([
        "assistant-cost.ts",
        "feature-works.ts",
        "nothing-broken.ts",
      ]);
    });

    test(`${id} stages the whole tracker project under ${TRACKER_DIR}/`, async () => {
      const def = await loadTestDef(id, unitsDir);
      const paths = def.setupCommands.map((command) =>
        command.type === "stage-workspace-file" ? command.path : "",
      );
      expect(paths.length).toBeGreaterThan(10);
      expect(paths.every((path) => path.startsWith(`${TRACKER_DIR}/`))).toBe(
        true,
      );
      expect(paths).toContain(`${TRACKER_DIR}/cli.ts`);
      expect(paths).toContain(`${TRACKER_DIR}/data/expenses.json`);
    });
  }
});
