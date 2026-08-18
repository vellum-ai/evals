import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { loadTestDef } from "../test-def";
import { TRACKER_DIR } from "../../../benchmarks/personal-intelligence/lib/fixtures/expense-tracker/truth";

const unitsDir = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "benchmarks",
  "personal-intelligence",
  "tests",
);

describe("feature-add-basic test definition", () => {
  test("is experimental and registers its three metrics", async () => {
    const def = await loadTestDef("feature-add-basic", unitsDir);
    expect(def.status).toBe("experimental");
    expect(def.metricPaths.map((path) => path.split("/").pop())).toEqual([
      "assistant-cost.ts",
      "feature-works.ts",
      "nothing-broken.ts",
    ]);
  });

  test(`stages the whole tracker project under ${TRACKER_DIR}/`, async () => {
    const def = await loadTestDef("feature-add-basic", unitsDir);
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
});
