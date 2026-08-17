/**
 * Neutral per-execution record of what tools a run called: verbatim
 * dispatched tool names, call counts, and payload sizes. No grouping, no
 * families, no derived flags. Investigations interpret this at read time;
 * the harness only states what happened.
 *
 * Envelope-unwrapping (via `readToolCalls`) is decoding, not
 * interpretation: the daemon dispatches workspace tools through
 * `skill_execute` with the real name in `input.tool`, so counting the
 * envelope name would record the transport rather than the tools.
 *
 * Scope: the summary covers tool calls only, and subagent-internal tool
 * calls do not appear in the parent event stream, so delegated work is
 * invisible here. A species whose delegation surfaces as a tool call
 * (Vellum's `subagent_spawn`) gets a row like any other tool; reading
 * spawn events that are not tool calls, and judging what delegation
 * implies, is the analysis script's job, which may be species-aware.
 */

import type { AgentEvent } from "./adapter";
import { readToolCalls } from "./common-metrics/tool-activity";

/** One tool's totals across the run. */
export interface ToolUsageEntry {
  /** The dispatched tool's real name, unwrapped from `skill_execute`. */
  tool: string;
  calls: number;
  /** Sum of `JSON.stringify(input).length` per call; 0 for empty input. */
  inputChars: number;
  /** Sum of paired result text lengths; 0 when no result arrived. */
  resultChars: number;
}

/** Every tool the parent stream called. */
export interface ToolUsageSummary {
  /** Sorted by calls descending, then tool name ascending. */
  tools: ToolUsageEntry[];
  totalCalls: number;
}

function inputChars(input: Record<string, unknown>): number {
  if (Object.keys(input).length === 0) return 0;
  return JSON.stringify(input).length;
}

/**
 * Tally the stream's tool calls per dispatched tool name.
 *
 * Ordering is calls descending, then name ascending, so two runs with the
 * same calls render the same table. The name comparison is codepoint-wise
 * rather than locale-aware, which keeps the order stable across machines.
 */
export function summarizeToolUsage(events: AgentEvent[]): ToolUsageSummary {
  const byTool = new Map<string, ToolUsageEntry>();
  let totalCalls = 0;

  for (const call of readToolCalls(events)) {
    let entry = byTool.get(call.name);
    if (entry === undefined) {
      entry = { tool: call.name, calls: 0, inputChars: 0, resultChars: 0 };
      byTool.set(call.name, entry);
    }
    entry.calls += 1;
    entry.inputChars += inputChars(call.input);
    entry.resultChars += call.resultText?.length ?? 0;
    totalCalls += 1;
  }

  const tools = Array.from(byTool.values()).sort((a, b) => {
    if (a.calls !== b.calls) return b.calls - a.calls;
    if (a.tool === b.tool) return 0;
    return a.tool < b.tool ? -1 : 1;
  });

  return { tools, totalCalls };
}
