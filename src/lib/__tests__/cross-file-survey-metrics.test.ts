import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import {
  EXPECTED_COUNT,
  NAIVE_COUNT_IF_OVERRIDES_MISSED,
  SERVICES_OVER_THRESHOLD,
  SERVICES_UNDER_THRESHOLD,
} from "../../../benchmarks/personal-intelligence/tests/cross-file-survey/constants";
import { gradeSurvey } from "../../../benchmarks/personal-intelligence/tests/cross-file-survey/metrics/survey-correct";
import {
  economyScore,
  FULL_MARKS_MEAN,
  gradeSliceEconomy,
  ZERO_MARKS_MEAN,
} from "../../../benchmarks/personal-intelligence/tests/cross-file-survey/metrics/slice-economy";

const OVER = Object.keys(SERVICES_OVER_THRESHOLD);

/**
 * The four trap services: the three in-file overrides plus the
 * over-threshold shared constant. A naive top-of-file pass misses
 * exactly these — see `NAIVE_COUNT_IF_OVERRIDES_MISSED` in constants.ts.
 */
const TRAP_SERVICES = [
  "billing-api",
  "search-worker",
  "exports-api",
  "analytics-worker",
];

/** An answer listing the given services, the way a chat answer writes them. */
function answerListing(names: string[], count?: number): string {
  return [
    count === undefined
      ? "Here are the services over 30 seconds:"
      : `${count} services are over 30 seconds:`,
    ...names.map(
      (name) => `- ${name} (${SERVICES_OVER_THRESHOLD[name] ?? 45}s)`,
    ),
  ].join("\n");
}

/** A direct tool call, the wire shape. */
function direct(toolName: string, input: Record<string, unknown>): AgentEvent {
  return { message: { type: "tool_use_start", toolName, input } };
}

/** A `skill_execute` envelope, the shape the daemon uses for skill tools. */
function dispatched(tool: string, input: Record<string, unknown>): AgentEvent {
  return {
    message: {
      type: "tool_use_start",
      toolName: "skill_execute",
      input: { tool, input },
    },
  };
}

/** A tool result. The Vellum daemon's carries no toolUseId. */
function result(text: string): AgentEvent {
  return { message: { type: "tool_result", result: text } };
}

describe("cross-file-survey constants", () => {
  test("the naive count misses exactly the four trap services", () => {
    expect(EXPECTED_COUNT).toBe(OVER.length);
    expect(EXPECTED_COUNT - NAIVE_COUNT_IF_OVERRIDES_MISSED).toBe(
      TRAP_SERVICES.length,
    );
    for (const name of TRAP_SERVICES) {
      expect(OVER).toContain(name);
    }
  });
});

describe("survey-correct set scoring", () => {
  test("the exact set with the exact count scores 1.0", () => {
    const grade = gradeSurvey(answerListing(OVER, EXPECTED_COUNT));
    expect(grade.score).toBe(1);
    expect(grade.missing).toEqual([]);
    expect(grade.falsePositives).toEqual([]);
    expect(grade.statesExpectedCount).toBe(true);
    expect(grade.statesNaiveCount).toBe(false);
  });

  test("missing services earn partial credit as a fraction of the set", () => {
    const partial = OVER.slice(0, OVER.length - 2);
    const grade = gradeSurvey(answerListing(partial));
    expect(grade.score).toBeCloseTo((OVER.length - 2) / OVER.length);
    expect(grade.missing).toHaveLength(2);
  });

  test("a false positive costs — it grows the denominator", () => {
    const grade = gradeSurvey(
      answerListing([...OVER, SERVICES_UNDER_THRESHOLD[0]]),
    );
    expect(grade.falsePositives).toEqual([SERVICES_UNDER_THRESHOLD[0]]);
    expect(grade.score).toBeCloseTo(OVER.length / (OVER.length + 1));
  });

  test("the traps-missed answer states the naive count and misses the traps", () => {
    // GIVEN the answer a top-of-file-literals pass produces: every plain
    // over-threshold service, none of the trap services, count of 10
    const naiveSet = OVER.filter((name) => !TRAP_SERVICES.includes(name));
    const grade = gradeSurvey(
      answerListing(naiveSet, NAIVE_COUNT_IF_OVERRIDES_MISSED),
    );

    // THEN the trap is detectable in metadata and the score is partial
    expect(grade.statesNaiveCount).toBe(true);
    expect(grade.statesExpectedCount).toBe(false);
    expect(grade.missing.sort()).toEqual([...TRAP_SERVICES].sort());
    expect(grade.score).toBeCloseTo(naiveSet.length / OVER.length);
  });

  test("a name inside a longer token is not a mention", () => {
    const grade = gradeSurvey("We ship auth-api-v2 and oauth-api next week.");
    expect(grade.reported).toEqual([]);
    expect(grade.falsePositives).toEqual([]);
  });

  test("explaining the near-miss exclusion is not a false positive", () => {
    // GIVEN the BEST answer: the exact set, plus the planted
    // looks-big-resolves-under service named only to show the work
    const answer = [
      answerListing(OVER, EXPECTED_COUNT),
      "",
      "Note: profiles-api's shared constant resolves to 20s, so it stays under the threshold.",
    ].join("\n");

    // WHEN graded
    const grade = gradeSurvey(answer);

    // THEN the exclusion framing clears the mention entirely
    expect(grade.falsePositives).toEqual([]);
    expect(grade.score).toBe(1);
    expect(grade.explanatoryMentions.map((m) => m.name)).toEqual([
      "profiles-api",
    ]);
  });

  test("an excluded-services block under a heading also clears", () => {
    const answer = [
      answerListing(OVER.slice(0, 3)),
      "",
      "**Excluded (under the threshold):**",
      "- profiles-api (20s effective)",
      "- payments-api (25s)",
    ].join("\n");
    const grade = gradeSurvey(answer);
    expect(grade.falsePositives).toEqual([]);
    expect(grade.explanatoryMentions.map((m) => m.name).sort()).toEqual([
      "payments-api",
      "profiles-api",
    ]);
  });

  test("a bare list including an under-threshold name still costs", () => {
    // GIVEN an under-threshold service listed among the findings with no
    // exclusion framing anywhere — a genuine wrong membership
    const grade = gradeSurvey(
      answerListing([...OVER.slice(0, 3), "profiles-api"]),
    );
    expect(grade.falsePositives).toEqual(["profiles-api"]);
    expect(grade.explanatoryMentions).toEqual([]);
    expect(grade.score).toBeCloseTo(3 / (OVER.length + 1));
  });
});

describe("slice-economy scoring curve", () => {
  test("one pass per file earns full marks; many slices earn none", () => {
    expect(economyScore(1)).toBe(1);
    expect(economyScore(FULL_MARKS_MEAN)).toBe(1);
    expect(economyScore(2.75)).toBeCloseTo(0.5);
    expect(economyScore(ZERO_MARKS_MEAN)).toBe(0);
    expect(economyScore(6)).toBe(0);
  });

  test("declines linearly between the anchors", () => {
    expect(economyScore(2)).toBeCloseTo((ZERO_MARKS_MEAN - 2) / 2.5);
    expect(economyScore(3)).toBeCloseTo((ZERO_MARKS_MEAN - 3) / 2.5);
  });
});

describe("gradeSliceEconomy over an event stream", () => {
  test("reading each file once scores 1", () => {
    const events = [
      direct("file_read", { path: "/workspace/services/auth-api/config.ts" }),
      result("config a"),
      dispatched("file_read", {
        path: "/workspace/services/billing-api/config.ts",
      }),
      result("config b"),
    ];
    const graded = gradeSliceEconomy(events);
    expect(graded.score).toBe(1);
    expect(graded.applicable).toBeUndefined();
    expect(graded.metadata?.meanReadsPerFile).toBe(1);
  });

  test("many small slices of one file decays the score", () => {
    // GIVEN one file read five times and another read once — mean 3
    const events = [
      ...Array.from({ length: 5 }, (_, i) =>
        direct("file_read", {
          path: "/workspace/services/auth-api/config.ts",
          offset: i * 40 + 1,
          limit: 40,
        }),
      ),
      direct("file_read", { path: "/workspace/services/shared/timeouts.ts" }),
    ];
    const graded = gradeSliceEconomy(events);
    expect(graded.score).toBeCloseTo((ZERO_MARKS_MEAN - 3) / 2.5);
    // Keys are canonical (workspace-relative) paths.
    expect(graded.metadata?.perFileReadCounts).toEqual({
      "services/auth-api/config.ts": 5,
      "services/shared/timeouts.ts": 1,
    });
  });

  test("spellings of the same file collapse into one slice count", () => {
    // GIVEN the same config read relative, dot-relative and absolute —
    // one file read three times, not three files read once
    const events = [
      direct("file_read", { path: "services/auth-api/config.ts" }),
      direct("file_read", { path: "./services/auth-api/config.ts" }),
      direct("file_read", { path: "/workspace/services/auth-api/config.ts" }),
    ];
    const graded = gradeSliceEconomy(events);
    expect(graded.metadata?.perFileReadCounts).toEqual({
      "services/auth-api/config.ts": 3,
    });
    expect(graded.metadata?.meanReadsPerFile).toBe(3);
  });

  test("no reads and no subagents is not applicable, with search count", () => {
    const events = [
      direct("code_search", { query: "timeoutSeconds" }),
      result("services/auth-api/config.ts:7: timeoutSeconds: 20,"),
    ];
    const graded = gradeSliceEconomy(events);
    expect(graded.applicable).toBe(false);
    expect(graded.metadata?.codeSearchCalls).toBe(1);
    expect(graded.reason).toContain("no file reads");
  });

  test("no observable reads after delegating is not a confident zero", () => {
    // GIVEN a run that spawned a subagent and read nothing itself —
    // the subagent's internal reads never reach the parent stream
    const events = [
      dispatched("subagent_spawn", {
        label: "survey",
        objective: "Survey timeouts under services/",
      }),
      dispatched("subagent_read", { id: "survey" }),
    ];
    const graded = gradeSliceEconomy(events);

    // THEN the metric declines to score rather than under-counting
    expect(graded.applicable).toBe(false);
    expect(graded.metadata?.subagentSpawnCount).toBe(1);
    expect(String(graded.metadata?.scope)).toContain("parent-events-only");
  });

  test("spool deref reads are counted separately, not as slices", () => {
    const spoolStub =
      "…(5321 tokens omitted — full result: /workspace/.conversations/c1/.tool-results/ab12.txt — use file_read to view)";
    const events = [
      direct("file_read", { path: "/workspace/services/media-api/config.ts" }),
      result(spoolStub),
      direct("file_read", {
        path: "/workspace/.conversations/c1/.tool-results/ab12.txt",
      }),
      result("the full spooled content"),
    ];
    const graded = gradeSliceEconomy(events);
    expect(graded.score).toBe(1);
    expect(graded.metadata?.spooledReadCount).toBe(1);
    expect(graded.metadata?.spoolDerefReadCount).toBe(1);
    expect(graded.metadata?.perFileReadCounts).toEqual({
      "services/media-api/config.ts": 1,
    });
  });
});
