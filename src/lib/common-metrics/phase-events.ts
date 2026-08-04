/**
 * Splitting a run's event stream back into its phases.
 *
 * `readAssistantEvents` returns every event the run produced, across all
 * phases, in one array — there is no phase marker on the events. But a
 * multi-phase test rotates conversations between phases (the
 * `new-conversation` directive), and every event carries the
 * `conversationId` it belongs to. So conversation boundaries ARE phase
 * boundaries for these tests, and grouping by first appearance recovers
 * them in order.
 *
 * This matters for any metric that asks "did it do X in phase 2 but not
 * phase 1". Without the split, a metric that greps the whole stream
 * cannot tell a phase-1 spawn from a phase-2 one, and a test built on
 * "delegated here, correctly didn't there" silently grades both phases
 * as one.
 */

import type { AgentEvent } from "../adapter";

/**
 * Events grouped by conversation, ordered by when each conversation
 * first appears. For a two-phase test that is `[phase1, phase2]`.
 *
 * Events with no `conversationId` (adapters that don't stamp one) all
 * land in a single leading group, so a single-phase run still yields one
 * group rather than an empty result.
 */
export function eventsByPhase(events: AgentEvent[]): AgentEvent[][] {
  const groups = new Map<string, AgentEvent[]>();
  for (const event of events) {
    const raw = event.message.conversationId;
    const key = typeof raw === "string" && raw !== "" ? raw : "";
    const bucket = groups.get(key);
    if (bucket) bucket.push(event);
    else groups.set(key, [event]);
  }
  return [...groups.values()];
}

/**
 * The events for a 1-indexed phase, or `undefined` when the run never
 * reached it. Callers should treat `undefined` as "unmeasurable" rather
 * than as a failure — a phase that never ran says nothing about the
 * agent.
 */
export function phaseEvents(
  events: AgentEvent[],
  phase: number,
): AgentEvent[] | undefined {
  return eventsByPhase(events)[phase - 1];
}
