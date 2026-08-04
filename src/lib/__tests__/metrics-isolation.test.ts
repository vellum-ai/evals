import { describe, expect, test } from "bun:test";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runMetrics } from "../metrics";
import type { TestDef } from "../test-def";

/** Write a throwaway metric file and return its path. */
async function metricFile(name: string, body: string): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), "evals-metric-"));
  const path = join(dir, `${name}.ts`);
  await writeFile(path, body, "utf8");
  return path;
}

const SCORER = (name: string, score: number) => `
export default async function scorer() {
  return { name: ${JSON.stringify(name)}, score: ${score}, reason: "ok" };
}
`;

const THROWER = `
export default async function scorer() {
  throw new TypeError("undefined is not an object (evaluating 'memo.includes')");
}
`;

function testDef(metricPaths: string[]): TestDef {
  return {
    id: "isolation",
    specPath: "/nonexistent/SPEC.md",
    betweenPhaseDirectives: [],
    setupPath: "/nonexistent/setup.ts",
    setupCommands: [],
    metricsDir: "/nonexistent/metrics",
    metricPaths,
  };
}

describe("runMetrics isolation", () => {
  test("one throwing metric does not destroy the other results", async () => {
    // GIVEN a test whose middle metric throws the way a metric reading a
    // deliverable that was never written used to throw
    const paths = [
      await metricFile("good-first", SCORER("good-first", 1)),
      await metricFile("explodes", THROWER),
      await metricFile("good-last", SCORER("good-last", 0.5)),
    ];

    // WHEN the batch is scored
    const results = await runMetrics({
      test: testDef(paths),
      runId: "isolation-run",
    });

    // THEN all three come back, with the failure recorded as its own zero
    expect(results).toHaveLength(3);
    expect(results[0]).toMatchObject({ name: "good-first", score: 1 });
    expect(results[2]).toMatchObject({ name: "good-last", score: 0.5 });
    expect(results[1]?.score).toBe(0);
    expect(results[1]?.name).toBe("explodes");
    expect(results[1]?.reason).toContain("Metric threw");
    expect(results[1]?.metadata).toMatchObject({ threw: true });
  });

  test("the thrown metric is named after its file", async () => {
    // GIVEN a single throwing metric
    const paths = [await metricFile("audit-correct", THROWER)];

    // WHEN scored
    const results = await runMetrics({
      test: testDef(paths),
      runId: "isolation-run-2",
    });

    // THEN the row is still attributable in the report
    expect(results[0]?.name).toBe("audit-correct");
  });
});
