import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import { eventsByPhase, phaseEvents } from "../common-metrics/phase-events";

function ev(conversationId: string | undefined, text: string): AgentEvent {
  return {
    message: { type: "assistant_text_delta", text, conversationId },
  };
}

describe("eventsByPhase", () => {
  test("groups by conversation in first-appearance order", () => {
    // A two-phase run rotates conversations between phases, so the
    // conversation boundary IS the phase boundary.
    const groups = eventsByPhase([
      ev("conv-a", "phase 1 turn 1"),
      ev("conv-a", "phase 1 turn 2"),
      ev("conv-b", "phase 2 turn 1"),
    ]);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(1);
    expect(groups[1][0].message.text).toBe("phase 2 turn 1");
  });

  test("interleaved events still group by conversation, not position", () => {
    const groups = eventsByPhase([
      ev("conv-a", "a1"),
      ev("conv-b", "b1"),
      ev("conv-a", "a2"),
    ]);
    expect(groups[0].map((e) => e.message.text)).toEqual(["a1", "a2"]);
    expect(groups[1].map((e) => e.message.text)).toEqual(["b1"]);
  });

  test("events without a conversationId collapse to one group", () => {
    // Adapters that don't stamp conversations must still yield a single
    // usable phase rather than an empty result.
    const groups = eventsByPhase([ev(undefined, "x"), ev(undefined, "y")]);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(2);
  });

  test("no events yields no groups", () => {
    expect(eventsByPhase([])).toEqual([]);
  });
});

describe("phaseEvents", () => {
  test("is 1-indexed", () => {
    const events = [ev("a", "one"), ev("b", "two")];
    expect(phaseEvents(events, 1)?.[0].message.text).toBe("one");
    expect(phaseEvents(events, 2)?.[0].message.text).toBe("two");
  });

  test("returns undefined for a phase the run never reached", () => {
    // Distinguishable from an empty phase, so callers can report
    // "unmeasurable" rather than scoring a zero the agent never earned.
    expect(phaseEvents([ev("a", "one")], 2)).toBeUndefined();
  });
});
