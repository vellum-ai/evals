import { describe, expect, test } from "bun:test";
import { join } from "node:path";

import { loadTestDef } from "../test-def";
import {
  GRAND_TOTAL,
  TRACKER_DIR,
} from "../../../benchmarks/personal-intelligence/lib/fixtures/expense-tracker/truth";
import {
  MAY_UNFILTERED_TOTAL,
  PROBE_CATEGORY_TOTAL,
  PROBE_GRAND_TOTAL,
} from "../../../benchmarks/personal-intelligence/tests/feature-add-medium/constants";

const unitsDir = join(
  import.meta.dir,
  "..",
  "..",
  "..",
  "benchmarks",
  "personal-intelligence",
  "tests",
);

describe("feature-add-medium test definition", () => {
  test("is experimental and registers its three metrics", async () => {
    const def = await loadTestDef("feature-add-medium", unitsDir);
    expect(def.status).toBe("experimental");
    expect(def.metricPaths.map((path) => path.split("/").pop())).toEqual([
      "assistant-cost.ts",
      "feature-works.ts",
      "nothing-broken.ts",
    ]);
  });

  test(`stages the whole tracker project under ${TRACKER_DIR}/`, async () => {
    const def = await loadTestDef("feature-add-medium", unitsDir);
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

  test("the probe totals are the fixture totals plus the probe expenses", () => {
    // The metric reads these figures out of command output, so they have
    // to follow the fixture: an entry added to the seeded data moves the
    // grand total and this test, not a run, catches it.
    const usd = (amount: string): number => Number(amount.replace("$", ""));
    const probeFood = 18.25;
    const probeFun = 30.0;

    expect(usd(PROBE_CATEGORY_TOTAL)).toBeCloseTo(probeFood, 2);
    expect(usd(MAY_UNFILTERED_TOTAL)).toBeCloseTo(probeFood + probeFun, 2);
    expect(usd(PROBE_GRAND_TOTAL)).toBeCloseTo(
      usd(GRAND_TOTAL) + probeFood + probeFun,
      2,
    );
  });
});
