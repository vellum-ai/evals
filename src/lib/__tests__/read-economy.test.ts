import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import { gradeReadEconomy } from "../common-metrics/read-economy";

/** A direct tool call, the wire shape (see tool-activity.test.ts). */
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

/** The spool stub the assistant swaps in for an oversized result. */
const SPOOL_STUB_RESULT =
  "...(5321 tokens omitted — full result: /workspace/.conversations/c1/.tool-results/ab12cd34ef56.txt — use file_read to view)";

describe("read-economy grading (shared across cases)", () => {
  test("sums inline result chars across all file reads", () => {
    const graded = gradeReadEconomy([
      direct("file_read", { path: "/workspace/catalog/price-table.ts" }),
      result("a".repeat(100)),
      direct("file_read", { path: "/workspace/catalog/README.md" }),
      result("b".repeat(40)),
    ]);
    expect(graded.score).toBe(140);
    expect(graded.unit).toBe("raw");
    expect(graded.applicable).not.toBe(false);
  });

  test("emits the one shared metadata schema the runbook aggregates", () => {
    // The runbook sums these keys ACROSS cases — read-economy in every
    // case must emit exactly these names.
    const graded = gradeReadEconomy([
      direct("file_read", { path: "/workspace/logs/gateway.log" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", {
        path: "/workspace/.conversations/c1/.tool-results/ab12cd34ef56.txt",
        offset: 38000,
      }),
      result("the incident window, inline"),
      direct("file_read", {
        path: "/workspace/logs/gateway.log",
        offset: 2001,
        limit: 500,
      }),
      result("lines 2001-2500"),
    ]);
    expect(graded.metadata).toMatchObject({
      fileReadCount: 3,
      defaultLimitReadCount: 2,
      spooledReadCount: 1,
      spoolDerefReadCount: 1,
      // Keys are canonical (workspace-relative) paths — see
      // `normalizePath` in tool-activity.ts.
      readsPerFile: {
        "logs/gateway.log": 2,
        ".conversations/c1/.tool-results/ab12cd34ef56.txt": 1,
      },
    });
  });

  test("no reads and no subagents is not applicable, naming the searches", () => {
    // Hermes-shaped or pure-search runs surface no file reads: that is
    // "nothing measurable", not "zero chars pulled".
    const graded = gradeReadEconomy([
      direct("code_search", { query: "ERROR checkout-service" }),
      result("logs/gateway.log:38601: ..."),
    ]);
    expect(graded.applicable).toBe(false);
    expect(graded.metadata).toMatchObject({
      fileReadCount: 0,
      codeSearchCalls: 1,
    });
    expect(graded.reason).toContain("no file reads");
  });

  test("no observable reads after delegating is not a confident zero", () => {
    // GIVEN a run that delegated the reading — the subagent's internal
    // reads never reach the parent stream
    const events = [
      dispatched("subagent_spawn", {
        label: "triage",
        objective: "Find the incident window in logs/gateway.log",
      }),
      dispatched("subagent_read", { id: "triage" }),
    ];
    const graded = gradeReadEconomy(events);

    // THEN the metric declines to score rather than under-counting
    expect(graded.applicable).toBe(false);
    expect(graded.metadata?.subagentSpawnCount).toBe(1);
    expect(String(graded.metadata?.scope)).toContain("parent-events-only");
  });
});
