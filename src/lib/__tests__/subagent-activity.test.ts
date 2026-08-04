import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import {
  constraintsCarried,
  inspectedSubagentOutput,
  readSubagentCalls,
  readSubagentSpawns,
  spawnsBeforeFirstRead,
} from "../common-metrics/subagent-activity";

/** A `skill_execute` envelope, the shape the daemon actually emits. */
function dispatched(tool: string, input: Record<string, unknown>): AgentEvent {
  return {
    message: {
      type: "tool_use_start",
      toolName: "skill_execute",
      input: { tool, input, activity: "working" },
    },
  };
}

function other(toolName: string): AgentEvent {
  return { message: { type: "tool_use_start", toolName, input: {} } };
}

describe("readSubagentCalls", () => {
  test("unwraps the skill_execute dispatch envelope", () => {
    // The trap this module exists for: greping for a `subagent_spawn`
    // TOOL NAME finds nothing, because the real tool name lives in
    // `input.tool` of a `skill_execute` call.
    const events = [
      other("bash"),
      dispatched("subagent_spawn", { label: "audit", objective: "Audit." }),
    ];
    const calls = readSubagentCalls(events);
    expect(calls).toHaveLength(1);
    expect(calls[0].tool).toBe("subagent_spawn");
    expect(calls[0].input.label).toBe("audit");
  });

  test("also accepts a direct call, in case the tools reach the wire", () => {
    const events: AgentEvent[] = [
      {
        message: {
          type: "tool_use_start",
          toolName: "subagent_read",
          input: { label: "audit" },
        },
      },
    ];
    expect(readSubagentCalls(events)[0]?.tool).toBe("subagent_read");
  });

  test("ignores skill_execute dispatching something unrelated", () => {
    const events = [dispatched("scaffold_managed_skill", { skill_id: "x" })];
    expect(readSubagentCalls(events)).toHaveLength(0);
  });

  test("ignores non-tool events", () => {
    const events: AgentEvent[] = [
      { message: { type: "assistant_text_delta", text: "subagent_spawn" } },
    ];
    expect(readSubagentCalls(events)).toHaveLength(0);
  });
});

describe("readSubagentSpawns", () => {
  test("keeps a spawn whose briefing is empty", () => {
    // "Delegated but briefed emptily" is a real behaviour the briefing
    // metric must see and score badly — not a parse failure to drop.
    const spawns = readSubagentSpawns([
      dispatched("subagent_spawn", { label: "a" }),
    ]);
    expect(spawns).toHaveLength(1);
    expect(spawns[0].objective).toBe("");
  });

  test("reads label, role and objective", () => {
    const spawns = readSubagentSpawns([
      dispatched("subagent_spawn", {
        label: "invoice-audit",
        role: "coder",
        objective: "Reconcile invoices against rates.csv.",
      }),
    ]);
    expect(spawns[0]).toMatchObject({
      label: "invoice-audit",
      role: "coder",
      objective: "Reconcile invoices against rates.csv.",
    });
  });
});

describe("inspectedSubagentOutput", () => {
  test("false when the run spawns and never looks", () => {
    expect(
      inspectedSubagentOutput([dispatched("subagent_spawn", { label: "a" })]),
    ).toBe(false);
  });

  test("true for subagent_read or subagent_status", () => {
    expect(
      inspectedSubagentOutput([dispatched("subagent_read", { label: "a" })]),
    ).toBe(true);
    expect(
      inspectedSubagentOutput([dispatched("subagent_status", { label: "a" })]),
    ).toBe(true);
  });
});

describe("spawnsBeforeFirstRead", () => {
  test("counts a fan-out", () => {
    const events = [
      dispatched("subagent_spawn", { label: "a" }),
      dispatched("subagent_spawn", { label: "b" }),
      dispatched("subagent_spawn", { label: "c" }),
      dispatched("subagent_read", { label: "a" }),
    ];
    expect(spawnsBeforeFirstRead(events)).toBe(3);
  });

  test("a serial chain scores 1", () => {
    // spawn → read → spawn → read is delegation without parallelism.
    const events = [
      dispatched("subagent_spawn", { label: "a" }),
      dispatched("subagent_read", { label: "a" }),
      dispatched("subagent_spawn", { label: "b" }),
      dispatched("subagent_read", { label: "b" }),
    ];
    expect(spawnsBeforeFirstRead(events)).toBe(1);
  });

  test("spawns with no read at all still count", () => {
    const events = [
      dispatched("subagent_spawn", { label: "a" }),
      dispatched("subagent_spawn", { label: "b" }),
    ];
    expect(spawnsBeforeFirstRead(events)).toBe(2);
  });
});

describe("constraintsCarried", () => {
  test("matches case-insensitively across all briefings", () => {
    // Splitting work across workers legitimately splits the constraints,
    // so a constraint carried by any one briefing counts.
    const spawns = readSubagentSpawns([
      dispatched("subagent_spawn", { objective: "Bill everything in EUR." }),
      dispatched("subagent_spawn", { objective: "Skip the Halberd vendor." }),
    ]);
    const { carried, missing } = constraintsCarried(spawns, [
      "EUR",
      "halberd",
      "2026-03-01",
    ]);
    expect(carried).toEqual(["EUR", "halberd"]);
    expect(missing).toEqual(["2026-03-01"]);
  });

  test("no spawns means everything is missing", () => {
    const { carried, missing } = constraintsCarried([], ["EUR"]);
    expect(carried).toEqual([]);
    expect(missing).toEqual(["EUR"]);
  });
});
