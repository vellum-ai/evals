import { describe, expect, test } from "bun:test";

import { scoreSpawns } from "../common-metrics/spawn-restraint";
import type { SubagentSpawn } from "../common-metrics/subagent-activity";

const spawn = (
  overrides: Partial<SubagentSpawn> & { objective?: string } = {},
): SubagentSpawn => ({
  label: overrides.label,
  role: overrides.role,
  objective: overrides.objective ?? "Look into it",
  index: overrides.index ?? 0,
});

const OPTIONS = {
  warranted: 0,
  zeroAt: 3,
  job: "a two-line fix",
  itemNames: ["invoicing", "billing", "catalog"],
  itemNoun: "package",
};

describe("spawn restraint", () => {
  test("doing the job yourself scores full marks", () => {
    const result = scoreSpawns([], OPTIONS);
    expect(result.score).toBe(1);
    expect(result.reason).toContain("Did the job itself");
    expect(result.metadata?.spawnCount).toBe(0);
  });

  test("each spawn past what the job is worth costs its share", () => {
    // zeroAt 3 with nothing warranted: one third of the score per spawn.
    expect(scoreSpawns([spawn()], OPTIONS).score).toBeCloseTo(2 / 3, 5);
    expect(scoreSpawns([spawn(), spawn()], OPTIONS).score).toBeCloseTo(
      1 / 3,
      5,
    );
    expect(scoreSpawns([spawn(), spawn(), spawn()], OPTIONS).score).toBe(0);
  });

  test("the score floors at zero rather than going negative", () => {
    const many = Array.from({ length: 9 }, () => spawn());
    expect(scoreSpawns(many, OPTIONS).score).toBe(0);
  });

  test("spawns a case does budget for are not counted against it", () => {
    const options = { ...OPTIONS, warranted: 1, zeroAt: 4 };
    expect(scoreSpawns([spawn()], options).score).toBe(1);
    expect(scoreSpawns([spawn(), spawn()], options).score).toBeCloseTo(
      2 / 3,
      5,
    );
  });

  test("an advisor consult is counted apart from a worker", () => {
    const result = scoreSpawns(
      [spawn({ role: "advisor" }), spawn({ role: "researcher" })],
      OPTIONS,
    );
    expect(result.metadata?.advisorCount).toBe(1);
    expect(result.metadata?.workerCount).toBe(1);
    expect(result.reason).toContain("1 of them advisor consult(s)");
  });

  test("a briefing that names a workspace item shows the fan-out", () => {
    const result = scoreSpawns(
      [
        spawn({
          label: "check-invoicing",
          objective: "Run the invoicing tests",
        }),
        spawn({ objective: "Read every file under packages/catalog" }),
      ],
      OPTIONS,
    );
    expect(result.metadata?.perItemSpawnCount).toBe(2);
    expect(result.metadata?.itemsNamed).toEqual(["catalog", "invoicing"]);
    expect(result.reason).toContain("named package(s)");
  });

  test("an item nobody was briefed about is not reported as named", () => {
    const result = scoreSpawns([spawn({ objective: "Look into it" })], OPTIONS);
    expect(result.metadata?.perItemSpawnCount).toBe(0);
    expect(result.metadata?.itemsNamed).toEqual([]);
    expect(result.reason).not.toContain("named package(s)");
  });

  test("a ladder with no rungs is a case-definition error, not a score", () => {
    // Without this the score would step from 1 straight to 0 and the
    // metric would report no gradient at all.
    expect(() => scoreSpawns([], { ...OPTIONS, zeroAt: 0 })).toThrow(
      /zeroAt .* above warranted/,
    );
  });
});
