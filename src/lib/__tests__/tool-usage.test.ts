import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import { summarizeToolUsage } from "../tool-usage";

/** A direct tool call, the wire shape. */
function direct(
  toolName: string,
  input: Record<string, unknown>,
  toolUseId?: string,
): AgentEvent {
  return {
    message: { type: "tool_use_start", toolName, input, toolUseId },
  };
}

/** A `skill_execute` envelope, the shape the daemon uses for skill tools. */
function dispatched(tool: string, input: Record<string, unknown>): AgentEvent {
  return {
    message: {
      type: "tool_use_start",
      toolName: "skill_execute",
      input: { tool, input, activity: "working" },
    },
  };
}

/** A tool result. The Vellum daemon's carries no toolUseId. */
function result(text: string, toolUseId?: string): AgentEvent {
  return { message: { type: "tool_result", result: text, toolUseId } };
}

describe("summarizeToolUsage", () => {
  test("counts calls per tool across direct and enveloped shapes", () => {
    // The same tool arriving both ways is one tool, not two: the envelope
    // is transport, and the summary records the dispatched name.
    const summary = summarizeToolUsage([
      dispatched("file_read", { path: "/workspace/notes.md" }),
      result("the notes"),
      direct("file_read", { path: "/workspace/plan.md" }),
      result("the plan"),
      direct("bash", { command: "ls -la" }),
      result("notes.md\nplan.md"),
    ]);

    expect(summary.totalCalls).toBe(3);
    expect(summary.tools.map((entry) => entry.tool)).toEqual([
      "file_read",
      "bash",
    ]);
    expect(summary.tools[0].calls).toBe(2);
    expect(summary.tools[1].calls).toBe(1);
  });

  test("sums payload chars, counting an unresolved call as zero result", () => {
    const readInput = { path: "/workspace/notes.md" };
    const writeInput = { path: "/workspace/notes.md", content: "hello" };
    const summary = summarizeToolUsage([
      direct("file_read", readInput),
      result("body text"),
      // No result event: the run ended (or the call failed to return)
      // before this one resolved.
      direct("file_write", writeInput),
    ]);

    const read = summary.tools.find((entry) => entry.tool === "file_read");
    const write = summary.tools.find((entry) => entry.tool === "file_write");
    expect(read?.inputChars).toBe(JSON.stringify(readInput).length);
    expect(read?.resultChars).toBe("body text".length);
    expect(write?.inputChars).toBe(JSON.stringify(writeInput).length);
    expect(write?.resultChars).toBe(0);
  });

  test("an empty input records zero input chars, not the `{}` literal", () => {
    const summary = summarizeToolUsage([direct("host_ps", {}), result("ok")]);
    expect(summary.tools[0].inputChars).toBe(0);
    expect(summary.tools[0].resultChars).toBe(2);
  });

  test("orders by calls desc then name asc", () => {
    const summary = summarizeToolUsage([
      direct("zebra", { a: 1 }),
      direct("alpha", { a: 1 }),
      direct("middle", { a: 1 }),
      direct("middle", { a: 1 }),
    ]);
    expect(summary.tools.map((entry) => entry.tool)).toEqual([
      "middle",
      "alpha",
      "zebra",
    ]);
  });

  test("an empty stream summarizes to nothing", () => {
    const summary = summarizeToolUsage([]);
    expect(summary.tools).toEqual([]);
    expect(summary.totalCalls).toBe(0);
  });

  test("records delegation tools as plain rows, with no special handling", () => {
    const summary = summarizeToolUsage([
      dispatched("subagent_spawn", { label: "worker-1", objective: "read x" }),
      result("spawned worker-1"),
      dispatched("subagent_spawn", { label: "worker-2", objective: "read y" }),
      result("spawned worker-2"),
      dispatched("subagent_read", { label: "worker-1" }),
      result("worker-1 said: done"),
    ]);

    // Spawns are tool calls like any other: they appear under their own
    // dispatched names, not folded into a delegation bucket.
    expect(summary.tools.map((entry) => entry.tool)).toEqual([
      "subagent_spawn",
      "subagent_read",
    ]);
    expect(summary.totalCalls).toBe(3);
  });
});
