import { describe, expect, test } from "bun:test";

import {
  compareExports,
  formatComparison,
  parseExportJsonl,
} from "../compare-data";

interface ExecutionFixture {
  testId: string;
  profileId: string;
  scoreTotal: number;
  totalCostUsd?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  runtimeMs?: number;
  status?: string;
}

/** Build a schemaVersion-2 JSONL export string like `evals export` writes. */
function exportFixture(
  sessionId: string,
  executions: ExecutionFixture[],
): string {
  const rows: unknown[] = [
    {
      type: "metadata",
      schemaVersion: 2,
      exportedAt: "2026-08-06T00:00:00.000Z",
      sessionId,
    },
    { type: "session", session: { sessionId, tests: [] } },
  ];
  for (const testId of new Set(executions.map((e) => e.testId))) {
    rows.push({ type: "test", test: { testId, profiles: [] } });
  }
  for (const e of executions) {
    rows.push({
      type: "execution",
      sessionId,
      testId: e.testId,
      profileId: e.profileId,
      run: {
        runId: `run-${e.testId}-${e.profileId}`,
        status: e.status ?? "completed",
        scoreTotal: e.scoreTotal,
        metricCount: 2,
        metrics: [{ id: "m1" }, { id: "m2" }],
        assistantResponses: 3,
        runtimeMs: e.runtimeMs,
        assistantEventCount: 10,
        simulatorMessageCount: 4,
        totalInputTokens: e.totalInputTokens,
        totalOutputTokens: e.totalOutputTokens,
        totalCostUsd: e.totalCostUsd,
      },
    });
  }
  return `${rows.map((r) => JSON.stringify(r)).join("\n")}\n`;
}

/** Pre-fix baseline: one profile, two tests. */
const BASELINE = exportFixture("session-a", [
  {
    testId: "calculator-app",
    profileId: "vellum-default",
    scoreTotal: 0.5,
    totalCostUsd: 0.2,
    totalInputTokens: 1000,
    totalOutputTokens: 400,
    runtimeMs: 60_000,
  },
  {
    testId: "ecomm-support-chat",
    profileId: "vellum-default",
    scoreTotal: 0.8,
    totalCostUsd: 0.1,
    totalInputTokens: 500,
    totalOutputTokens: 200,
    runtimeMs: 30_000,
  },
]);

/** Post-fix: same profile, one shared test improved, one new test. */
const POST_FIX = exportFixture("session-b", [
  {
    testId: "calculator-app",
    profileId: "vellum-default",
    scoreTotal: 0.75,
    totalCostUsd: 0.05,
    totalInputTokens: 250,
    totalOutputTokens: 100,
    runtimeMs: 30_000,
  },
  {
    testId: "motorcycle-manual-qa",
    profileId: "vellum-default",
    scoreTotal: 0.9,
    totalCostUsd: 0.02,
    totalInputTokens: 100,
    totalOutputTokens: 50,
    runtimeMs: 10_000,
  },
]);

/** One session carrying both a vellum and a hermes profile. */
const MULTI_PROFILE = exportFixture("session-multi", [
  {
    testId: "calculator-app",
    profileId: "vellum-default",
    scoreTotal: 0.9,
    totalCostUsd: 0.6,
  },
  {
    testId: "ecomm-support-chat",
    profileId: "vellum-default",
    scoreTotal: 0.7,
    totalCostUsd: 0.13,
  },
  {
    testId: "calculator-app",
    profileId: "hermes-default",
    scoreTotal: 0.6,
    totalCostUsd: 0.08,
  },
  {
    testId: "ecomm-support-chat",
    profileId: "hermes-default",
    scoreTotal: 0.5,
    totalCostUsd: 0.02,
  },
]);

describe("parseExportJsonl", () => {
  test("reads the metadata row and one entry per execution", () => {
    // GIVEN a well-formed schemaVersion-2 export
    // WHEN it is parsed
    const parsed = parseExportJsonl(BASELINE, "a.jsonl");

    // THEN the session identity and every execution survive
    expect(parsed.sessionId).toBe("session-a");
    expect(parsed.exportedAt).toBe("2026-08-06T00:00:00.000Z");
    expect(parsed.executions).toHaveLength(2);
    expect(parsed.executions[0]).toMatchObject({
      testId: "calculator-app",
      profileId: "vellum-default",
      scoreTotal: 0.5,
      totalCostUsd: 0.2,
      runtimeMs: 60_000,
    });
  });

  test("rejects a file without a schemaVersion-2 metadata row", () => {
    // GIVEN a JSONL file that never declares its schema
    const text = `${JSON.stringify({ type: "session", session: {} })}\n`;

    // WHEN parsed THEN it fails loudly instead of comparing garbage
    expect(() => parseExportJsonl(text, "x.jsonl")).toThrow(
      /no schemaVersion-2 metadata row/,
    );
  });

  test("rejects malformed JSON and schema violations with line numbers", () => {
    // GIVEN a file with a broken line
    expect(() => parseExportJsonl("not json\n", "x.jsonl")).toThrow(
      /x\.jsonl:1: not valid JSON/,
    );

    // AND a file whose execution row is missing required fields
    const bad = `${JSON.stringify({ type: "execution", testId: "t" })}\n`;
    expect(() => parseExportJsonl(bad, "y.jsonl")).toThrow(
      /y\.jsonl:1: not a schemaVersion-2 export row/,
    );
  });

  test("rejects duplicate (testId, profileId) keys", () => {
    // GIVEN an export carrying the same execution key twice
    const doubled = exportFixture("s", [
      { testId: "t1", profileId: "p1", scoreTotal: 0.1 },
      { testId: "t1", profileId: "p1", scoreTotal: 0.2 },
    ]);

    // WHEN parsed THEN the ambiguity is an error, not a silent overwrite
    expect(() => parseExportJsonl(doubled, "d.jsonl")).toThrow(
      /duplicate execution for test "t1"/,
    );
  });
});

describe("compareExports — per-test join", () => {
  const result = compareExports(
    parseExportJsonl(BASELINE, "a.jsonl"),
    parseExportJsonl(POST_FIX, "b.jsonl"),
  );

  test("shared keys get deltas and ratios on every axis", () => {
    // GIVEN the calculator test present in both exports
    const row = result.byTest.find((r) => r.testId === "calculator-app");

    // THEN score delta, cost ratio, token and runtime deltas are computed
    expect(row).toMatchObject({ presence: "both" });
    expect(row!.score.delta).toBeCloseTo(0.25, 10);
    expect(row!.score.ratio).toBeCloseTo(1.5, 10);
    expect(row!.costUsd.delta).toBeCloseTo(-0.15, 10);
    expect(row!.costUsd.ratio).toBeCloseTo(0.25, 10);
    expect(row!.inputTokens.delta).toBe(-750);
    expect(row!.outputTokens.delta).toBe(-300);
    expect(row!.runtimeMs.delta).toBe(-30_000);
    expect(row!.runtimeMs.ratio).toBeCloseTo(0.5, 10);
  });

  test("one-sided keys are kept and flagged, not dropped", () => {
    // GIVEN a test only in the baseline and a test only in the post-fix run
    const aOnly = result.byTest.find((r) => r.testId === "ecomm-support-chat");
    const bOnly = result.byTest.find(
      (r) => r.testId === "motorcycle-manual-qa",
    );

    // THEN both appear with explicit presence and no fabricated deltas
    expect(aOnly).toMatchObject({ presence: "a-only" });
    expect(aOnly!.score).toEqual({ a: 0.8 });
    expect(bOnly).toMatchObject({ presence: "b-only" });
    expect(bOnly!.score).toEqual({ b: 0.9 });
    expect(bOnly!.costUsd.delta).toBeUndefined();
  });

  test("a zero baseline yields a delta but no ratio", () => {
    // GIVEN a metric that goes from 0 to a positive value
    const a = parseExportJsonl(
      exportFixture("za", [
        { testId: "t", profileId: "p", scoreTotal: 0, totalCostUsd: 0 },
      ]),
      "za.jsonl",
    );
    const b = parseExportJsonl(
      exportFixture("zb", [
        { testId: "t", profileId: "p", scoreTotal: 1, totalCostUsd: 0.5 },
      ]),
      "zb.jsonl",
    );

    // WHEN compared THEN division by zero is represented as "no ratio"
    const [row] = compareExports(a, b).byTest;
    expect(row.score.delta).toBe(1);
    expect(row.score.ratio).toBeUndefined();
    expect(row.costUsd.ratio).toBeUndefined();
  });
});

describe("compareExports — profile aggregates", () => {
  test("aggregates sum cost and mean score per side", () => {
    // GIVEN the baseline vs post-fix comparison
    const result = compareExports(
      parseExportJsonl(BASELINE, "a.jsonl"),
      parseExportJsonl(POST_FIX, "b.jsonl"),
    );

    // THEN the single profile aggregates both executions on each side
    expect(result.byProfile).toHaveLength(1);
    const [profile] = result.byProfile;
    expect(profile.profileId).toBe("vellum-default");
    expect(profile.presence).toBe("both");
    expect(profile.aggregateA!.executionCount).toBe(2);
    expect(profile.aggregateA!.meanScore).toBeCloseTo(0.65, 10);
    expect(profile.aggregateA!.sumCostUsd).toBeCloseTo(0.3, 10);
    expect(profile.aggregateB!.meanScore).toBeCloseTo(0.825, 10);
    expect(profile.sumCostUsd.ratio).toBeCloseTo(0.07 / 0.3, 10);
  });

  test("same-file profile-vs-profile yields a headline cost ratio", () => {
    // GIVEN one session containing vellum and hermes rows, compared to itself
    const parsed = parseExportJsonl(MULTI_PROFILE, "multi.jsonl");
    const result = compareExports(parsed, parsed);

    // THEN both profiles appear as aggregates on both sides
    expect(result.byProfile.map((p) => p.profileId)).toEqual([
      "hermes-default",
      "vellum-default",
    ]);
    expect(result.byProfile[1].sumCostUsd).toMatchObject({
      a: 0.73,
      b: 0.73,
      delta: 0,
      ratio: 1,
    });

    // AND the headline says how much pricier vellum is than hermes,
    // computed over the tests both profiles ran, on each side
    expect(result.headlineCostRatios).toHaveLength(2);
    const [headline] = result.headlineCostRatios;
    expect(headline).toMatchObject({
      side: "a",
      profileId: "vellum-default",
      vsProfileId: "hermes-default",
      sharedTestCount: 2,
    });
    expect(headline.costRatio).toBeCloseTo(7.3, 10);
  });

  test("a profile present on only one side is flagged", () => {
    // GIVEN a multi-profile session compared against a vellum-only session
    const result = compareExports(
      parseExportJsonl(MULTI_PROFILE, "multi.jsonl"),
      parseExportJsonl(POST_FIX, "b.jsonl"),
    );

    // THEN hermes is a-only with no cross-side deltas
    const hermes = result.byProfile.find(
      (p) => p.profileId === "hermes-default",
    );
    expect(hermes).toMatchObject({ presence: "a-only" });
    expect(hermes!.aggregateB).toBeUndefined();
    expect(hermes!.sumCostUsd.delta).toBeUndefined();
  });
});

describe("formatComparison", () => {
  const result = compareExports(
    parseExportJsonl(BASELINE, "a.jsonl"),
    parseExportJsonl(POST_FIX, "b.jsonl"),
  );

  test("json output round-trips through JSON.parse", () => {
    // WHEN rendered as json
    const out = formatComparison(result, { format: "json", by: "test" });

    // THEN it parses back into the same comparison
    expect(JSON.parse(out)).toEqual(JSON.parse(JSON.stringify(result)));
  });

  test("table output names both sessions and every join key", () => {
    // WHEN rendered as a table by test
    const out = formatComparison(result, { format: "table", by: "test" });

    // THEN the header identifies the sides and rows carry the values
    expect(out).toContain("A: session session-a");
    expect(out).toContain("B: session session-b");
    expect(out).toContain("calculator-app");
    expect(out).toContain("a-only");
    expect(out).toContain("b-only");
    expect(out).toContain("0.500 → 0.750");
  });

  test("markdown output is a pipe table", () => {
    // WHEN rendered as markdown by profile
    const out = formatComparison(result, { format: "md", by: "profile" });

    // THEN it emits a header row, separator, and one row per profile
    expect(out).toContain("| Profile |");
    expect(out).toContain("| --- |");
    expect(out).toContain("| vellum-default |");
  });

  test("profile view of a multi-profile session prints the headline", () => {
    // GIVEN the same multi-profile file on both sides
    const parsed = parseExportJsonl(MULTI_PROFILE, "multi.jsonl");
    const out = formatComparison(compareExports(parsed, parsed), {
      format: "table",
      by: "profile",
    });

    // THEN the cross-profile cost story is stated once, not once per side
    const matches = out.match(/vellum-default is 7\.3x hermes-default/g);
    expect(matches).toHaveLength(1);
  });
});
