/**
 * Shared reader for subagent activity in an agent's event stream, used by
 * the delegation tests.
 *
 * Subagent tools are not wire tools. The `subagent` skill is in the
 * daemon's `DEFAULT_PREACTIVATED_SKILL_IDS`, and its tools are dispatched
 * through `skill_execute` with the real tool name in `input.tool` — the
 * shape a production trace shows verbatim:
 *
 *   skill_execute {"tool":"subagent_spawn","input":{"label":"publish-episode-18",
 *                  "role":"coder","objective":"Publish episode 18 in /workspace …"}}
 *
 * So a metric that greps for a `subagent_spawn` TOOL NAME finds nothing
 * and reports a confident zero. Everything here unwraps the dispatch
 * envelope first, and tolerates a future world where the tools are also
 * exposed directly by accepting either shape.
 */

import type { AgentEvent } from "../adapter";

/** The subagent tools this module understands, by dispatched name. */
export type SubagentToolName =
  | "subagent_spawn"
  | "subagent_status"
  | "subagent_abort"
  | "subagent_message"
  | "subagent_read";

/** One unwrapped subagent tool call, in stream order. */
export interface SubagentCall {
  tool: SubagentToolName;
  /** The dispatched tool's own input (already unwrapped from skill_execute). */
  input: Record<string, unknown>;
  /** Stream index, so callers can reason about ordering. */
  index: number;
}

/** A spawn, with the fields the delegation metrics grade. */
export interface SubagentSpawn {
  label?: string;
  role?: string;
  /** The briefing text. A subagent sees this and NOT the conversation. */
  objective: string;
  index: number;
}

const SUBAGENT_TOOLS = new Set<string>([
  "subagent_spawn",
  "subagent_status",
  "subagent_abort",
  "subagent_message",
  "subagent_read",
]);

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Every subagent tool call in the stream, unwrapped from whichever
 * dispatch shape carried it.
 *
 * Two shapes are accepted: the `skill_execute` envelope that the daemon
 * actually uses today (`toolName: "skill_execute"`, `input.tool:
 * "subagent_spawn"`, `input.input: {...}`), and a direct call
 * (`toolName: "subagent_spawn"`) in case the tools are ever promoted to
 * the wire. Anything else is ignored.
 */
export function readSubagentCalls(events: AgentEvent[]): SubagentCall[] {
  const calls: SubagentCall[] = [];
  events.forEach((event, index) => {
    const message = event.message;
    if (message.type !== "tool_use_start") return;
    const toolName = readString(message.toolName);
    if (toolName === undefined) return;

    if (SUBAGENT_TOOLS.has(toolName)) {
      calls.push({
        tool: toolName as SubagentToolName,
        input: asRecord(message.input) ?? {},
        index,
      });
      return;
    }
    if (toolName !== "skill_execute") return;
    const envelope = asRecord(message.input);
    const dispatched = readString(envelope?.tool);
    if (dispatched === undefined || !SUBAGENT_TOOLS.has(dispatched)) return;
    calls.push({
      tool: dispatched as SubagentToolName,
      input: asRecord(envelope?.input) ?? {},
      index,
    });
  });
  return calls;
}

/**
 * The spawns among those calls. A spawn with no objective text still
 * counts as a spawn — "delegated but briefed emptily" is a real
 * behaviour the briefing metric needs to see and score badly, not a
 * parse failure to drop.
 */
export function readSubagentSpawns(events: AgentEvent[]): SubagentSpawn[] {
  return readSubagentCalls(events)
    .filter((call) => call.tool === "subagent_spawn")
    .map((call) => ({
      label: readString(call.input.label),
      role: readString(call.input.role),
      objective: readString(call.input.objective) ?? "",
      index: call.index,
    }));
}

/**
 * True when the run ever looked at what a subagent produced —
 * `subagent_read` or `subagent_status`. Distinguishes supervising a
 * delegate from firing one off and relaying its output unread.
 */
export function inspectedSubagentOutput(events: AgentEvent[]): boolean {
  return readSubagentCalls(events).some(
    (call) => call.tool === "subagent_read" || call.tool === "subagent_status",
  );
}

/**
 * How many spawns happened before the first `subagent_read`.
 *
 * A proxy for fan-out: an agent that parallelises spawns its workers and
 * then collects, so several spawns precede the first read. A serial
 * chain reads each worker before spawning the next, leaving this at 1.
 * Deliberately not "concurrent at the same instant" — the event stream
 * has no reliable completion timestamps to make that judgement from.
 */
export function spawnsBeforeFirstRead(events: AgentEvent[]): number {
  const calls = readSubagentCalls(events);
  const firstRead = calls.find((call) => call.tool === "subagent_read");
  const cutoff = firstRead?.index ?? Number.POSITIVE_INFINITY;
  return calls.filter(
    (call) => call.tool === "subagent_spawn" && call.index < cutoff,
  ).length;
}

/**
 * Which of `needles` appear in the combined briefing text of `spawns`.
 *
 * Case-insensitive substring matching over the concatenated objectives:
 * a constraint carried in any spawn's briefing counts, since splitting
 * work across workers legitimately splits the constraints too.
 */
export function constraintsCarried(
  spawns: SubagentSpawn[],
  needles: readonly string[],
): { carried: string[]; missing: string[] } {
  const haystack = spawns
    .map((spawn) => spawn.objective)
    .join("\n")
    .toLowerCase();
  const carried: string[] = [];
  const missing: string[] = [];
  for (const needle of needles) {
    if (haystack.includes(needle.toLowerCase())) carried.push(needle);
    else missing.push(needle);
  }
  return { carried, missing };
}
