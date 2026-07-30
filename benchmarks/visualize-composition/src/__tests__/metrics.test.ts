import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../../../../src/lib/adapter";
import {
  appendAssistantEvents,
  appendTranscriptTurn,
  ensureRunArtifacts,
} from "../../../../src/lib/metrics";
import { measureMarkup } from "../metrics/markup";
import { readVisualRun, thinkingBeforeFirstUiShow } from "../metrics/run-view";
import scoreVisualShown from "../metrics/visual-shown";
import scoreTimeToVisual, { BASELINE_MS } from "../metrics/time-to-visual";
import scoreMarkupInThinking, {
  MARKUP_CHAR_BUDGET,
} from "../metrics/markup-in-thinking";
import scoreThinkingBurn, { BASELINE_CHARS } from "../metrics/thinking-burn";
import scoreFirstTryValid from "../metrics/first-try-valid";

const T0 = Date.parse("2026-07-30T12:00:00.000Z");

function at(offsetMs: number): string {
  return new Date(T0 + offsetMs).toISOString();
}

async function freshRunId(name: string): Promise<string> {
  const runId = `test-viz-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await ensureRunArtifacts(runId);
  return runId;
}

function event(offsetMs: number, message: AgentEvent["message"]): AgentEvent {
  return { emittedAt: at(offsetMs), message };
}

/**
 * A run in which the agent loaded the skill, thought briefly, and wrote
 * one accepted visual. The shape every variant is trying to produce.
 */
async function seedCleanRun(name: string): Promise<string> {
  const runId = await freshRunId(name);
  await appendTranscriptTurn(runId, {
    role: "simulator",
    content: "how do hash tables handle collisions?",
    emittedAt: at(0),
  });
  await appendAssistantEvents(runId, [
    event(500, {
      type: "tool_use_start",
      toolName: "skill_load",
      input: { skill: "visualize" },
    }),
    event(900, {
      type: "tool_result",
      toolName: "skill_load",
      result: "Skill: Visualize",
      isError: false,
    }),
    event(1200, {
      type: "assistant_thinking_delta",
      thinking:
        "A side by side of chaining and open addressing will land better than prose.",
    }),
    event(2000, {
      type: "ui_surface_pending",
      surfaceType: "visual",
      toolUseId: "tu-1",
    }),
    event(4000, {
      type: "tool_use_start",
      toolName: "ui_show",
      toolUseId: "tu-1",
      input: {
        surface_type: "visual",
        data: { html: '<svg viewBox="0 0 10 10"></svg>' },
      },
    }),
    event(4200, {
      type: "tool_result",
      toolName: "ui_show",
      toolUseId: "tu-1",
      result: '{"surfaceId":"s1"}',
      isError: false,
    }),
    event(4300, {
      type: "ui_surface_show",
      surfaceType: "visual",
      surfaceId: "s1",
      toolCallId: "tu-1",
    }),
    event(4400, { type: "message_complete" }),
  ]);
  return runId;
}

describe("markup detection", () => {
  test("GIVEN prose about a visual THEN no markup is found", () => {
    const measurement = measureMarkup(
      "A bar chart would read better than a table here, and g < p in this ordering.",
    );
    expect(measurement.present).toBe(false);
    expect(measurement.markupChars).toBe(0);
  });

  test("GIVEN a drafted svg fragment THEN whole markup lines are counted", () => {
    const fragment = [
      "Let me draft it:",
      '<svg viewBox="0 0 400 200">',
      '  <rect x="0" y="0" width="100" height="40" fill="var(--accent)" />',
      "</svg>",
    ].join("\n");
    const measurement = measureMarkup(fragment);
    expect(measurement.present).toBe(true);
    expect(measurement.tokenCount).toBeGreaterThan(3);
    // Every line but the prose opener counts.
    expect(measurement.markupChars).toBe(
      fragment.length - "Let me draft it:".length - 3,
    );
    expect(measurement.sample).toContain("<svg");
  });

  test("GIVEN html attributes without tags THEN they still register", () => {
    expect(measureMarkup('the style="color: red" bit').present).toBe(true);
  });
});

describe("visualize-composition metrics on a clean run", () => {
  test("GIVEN one accepted visual THEN every metric reports the good outcome", async () => {
    const runId = await seedCleanRun("clean");

    const shown = await scoreVisualShown({ runId });
    expect(shown.score).toBe(1);
    expect(shown.metadata?.surfaceEvents).toBe(1);

    const latency = await scoreTimeToVisual({ runId });
    expect(latency.score).toBe(1);
    expect(latency.metadata?.elapsedMs).toBe(4300);

    const markup = await scoreMarkupInThinking({ runId });
    expect(markup.score).toBe(1);
    expect(markup.metadata?.markupInThinking).toBe(false);

    const burn = await scoreThinkingBurn({ runId });
    expect(burn.score).toBe(1);
    expect(burn.metadata?.attributed).toBe(true);

    const firstTry = await scoreFirstTryValid({ runId });
    expect(firstTry.score).toBe(1);
    expect(firstTry.metadata?.rejections).toBe(0);
  });
});

describe("markup-in-thinking", () => {
  test("GIVEN a fragment drafted in thinking THEN the score falls with its size", async () => {
    const runId = await freshRunId("drafted");
    const drafted = Array.from(
      { length: 30 },
      (_, i) =>
        `  <rect x="${i}" y="0" width="10" height="10" fill="var(--accent)" />`,
    ).join("\n");
    await appendAssistantEvents(runId, [
      event(100, {
        type: "assistant_thinking_delta",
        thinking: "Let me lay it out.\n",
      }),
      event(200, { type: "assistant_thinking_delta", thinking: drafted }),
    ]);

    const result = await scoreMarkupInThinking({ runId });

    expect(result.metadata?.markupInThinking).toBe(true);
    expect(result.metadata?.markupChars).toBeGreaterThan(MARKUP_CHAR_BUDGET);
    expect(result.score).toBe(0);
  });

  test("GIVEN a small markup leak THEN the score is docked but not zeroed", async () => {
    const runId = await freshRunId("leak");
    await appendAssistantEvents(runId, [
      event(100, {
        type: "assistant_thinking_delta",
        thinking: "I could open with <svg> here.",
      }),
    ]);

    const result = await scoreMarkupInThinking({ runId });

    expect(result.score).toBeGreaterThan(0.9);
    expect(result.score).toBeLessThan(1);
  });
});

describe("thinking-burn", () => {
  test("GIVEN heavy reasoning before the tool call THEN the score decays", async () => {
    const runId = await freshRunId("burn");
    await appendTranscriptTurn(runId, {
      role: "simulator",
      content: "explain it",
      emittedAt: at(0),
    });
    await appendAssistantEvents(runId, [
      event(100, {
        type: "assistant_thinking_delta",
        thinking: "x".repeat(BASELINE_CHARS * 4),
      }),
      event(200, {
        type: "tool_use_start",
        toolName: "ui_show",
        toolUseId: "tu-1",
        input: {
          surface_type: "visual",
          data: { html: '<svg viewBox="0 0 1 1"></svg>' },
        },
      }),
      // Reasoning after the call is outside the window.
      event(300, {
        type: "assistant_thinking_delta",
        thinking: "y".repeat(BASELINE_CHARS * 4),
      }),
    ]);

    const result = await scoreThinkingBurn({ runId });

    expect(result.metadata?.attributed).toBe(true);
    expect(result.metadata?.thinkingChars).toBe(BASELINE_CHARS * 4);
    expect(result.score).toBeCloseTo(0.25, 5);
  });

  test("GIVEN no ui_show call THEN the whole turn is measured and flagged unattributed", async () => {
    const runId = await freshRunId("no-call");
    await appendAssistantEvents(runId, [
      event(100, {
        type: "assistant_thinking_delta",
        thinking: "z".repeat(BASELINE_CHARS * 2),
      }),
    ]);

    const result = await scoreThinkingBurn({ runId });

    expect(result.metadata?.attributed).toBe(false);
    expect(result.score).toBeCloseTo(0.5, 5);
  });
});

describe("first-try-valid", () => {
  test("GIVEN one validator rejection before acceptance THEN the score halves", async () => {
    const runId = await freshRunId("retry");
    await appendAssistantEvents(runId, [
      event(100, {
        type: "tool_use_start",
        toolName: "ui_show",
        toolUseId: "tu-1",
        input: { surface_type: "visual", data: { html: "<svg></svg>" } },
      }),
      event(150, {
        type: "tool_result",
        toolName: "ui_show",
        toolUseId: "tu-1",
        result: "Error: ui_show visual was not displayed",
        isError: true,
      }),
      event(200, {
        type: "tool_use_start",
        toolName: "ui_show",
        toolUseId: "tu-2",
        input: {
          surface_type: "visual",
          data: { html: '<svg viewBox="0 0 1 1"></svg>' },
        },
      }),
      event(250, {
        type: "tool_result",
        toolName: "ui_show",
        toolUseId: "tu-2",
        result: '{"surfaceId":"s1"}',
        isError: false,
      }),
    ]);

    const result = await scoreFirstTryValid({ runId });

    expect(result.score).toBeCloseTo(0.5, 5);
    expect(result.metadata?.rejections).toBe(1);
    expect(result.metadata?.accepted).toBe(true);
  });

  test("GIVEN no visual attempt THEN it scores zero", async () => {
    const runId = await freshRunId("none");
    await appendAssistantEvents(runId, [
      event(100, { type: "message_complete" }),
    ]);

    const result = await scoreFirstTryValid({ runId });

    expect(result.score).toBe(0);
    expect(result.metadata?.attempts).toBe(0);
  });

  test("GIVEN a non-visual ui_show THEN it is not counted as a visual attempt", async () => {
    const runId = await freshRunId("card");
    await appendAssistantEvents(runId, [
      event(100, {
        type: "tool_use_start",
        toolName: "ui_show",
        toolUseId: "tu-1",
        input: { surface_type: "card", data: {} },
      }),
      event(150, {
        type: "tool_result",
        toolName: "ui_show",
        toolUseId: "tu-1",
        result: "{}",
        isError: false,
      }),
    ]);

    const result = await scoreFirstTryValid({ runId });

    expect(result.score).toBe(0);
    expect(result.metadata?.attempts).toBe(0);
  });
});

describe("visual-shown and time-to-visual on a failed turn", () => {
  test("GIVEN a pending visual that never landed THEN the failure mode is named", async () => {
    const runId = await freshRunId("truncated");
    await appendTranscriptTurn(runId, {
      role: "simulator",
      content: "explain it",
      emittedAt: at(0),
    });
    await appendAssistantEvents(runId, [
      event(1000, {
        type: "ui_surface_pending",
        surfaceType: "visual",
        toolUseId: "tu-1",
      }),
      event(90_000, { type: "error", message: "max_tokens" }),
    ]);

    const shown = await scoreVisualShown({ runId });
    expect(shown.score).toBe(0);
    expect(shown.reason).toContain("turn ended before");

    const latency = await scoreTimeToVisual({ runId });
    expect(latency.score).toBe(0);
    expect(latency.metadata?.elapsedMs).toBeNull();
  });

  test("GIVEN a slow visual THEN latency decays hyperbolically", async () => {
    const runId = await freshRunId("slow");
    await appendTranscriptTurn(runId, {
      role: "simulator",
      content: "explain it",
      emittedAt: at(0),
    });
    await appendAssistantEvents(runId, [
      event(BASELINE_MS * 4, {
        type: "ui_surface_show",
        surfaceType: "visual",
        surfaceId: "s1",
      }),
    ]);

    const result = await scoreTimeToVisual({ runId });

    expect(result.score).toBeCloseTo(0.25, 5);
  });
});

describe("run-view attribution", () => {
  test("GIVEN a skill load THEN the burn window opens at its result", async () => {
    const runId = await seedCleanRun("window");
    const view = await readVisualRun(runId);
    const { thinking, attributed } = thinkingBeforeFirstUiShow(view);

    expect(attributed).toBe(true);
    expect(view.skillLoads[0]?.skill).toBe("visualize");
    expect(thinking).toContain("side by side");
  });

  test("GIVEN a tool_result with no toolUseId THEN it resolves the oldest open call", async () => {
    const runId = await freshRunId("unmatched");
    await appendAssistantEvents(runId, [
      event(100, {
        type: "tool_use_start",
        toolName: "ui_show",
        input: {
          surface_type: "visual",
          data: { html: '<svg viewBox="0 0 1 1"></svg>' },
        },
      }),
      event(150, {
        type: "tool_result",
        toolName: "ui_show",
        result: "{}",
        isError: false,
      }),
    ]);

    const view = await readVisualRun(runId);

    expect(view.uiShowCalls).toHaveLength(1);
    expect(view.uiShowCalls[0].isError).toBe(false);
  });
});
