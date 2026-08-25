import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import {
  gradeImageAskUsage,
  readImageAskUsage,
} from "../common-metrics/image-ask-usage";

/** A direct tool call, the wire shape (see tool-activity.test.ts). */
function direct(
  toolName: string,
  input: Record<string, unknown> = {},
): AgentEvent {
  return { message: { type: "tool_use_start", toolName, input } };
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

function result(text: string): AgentEvent {
  return { message: { type: "tool_result", result: text } };
}

function errorResult(text: string): AgentEvent {
  return { message: { type: "tool_result", result: text, isError: true } };
}

describe("readImageAskUsage", () => {
  test("counts image_ask calls and keeps their questions and targets", () => {
    const usage = readImageAskUsage([
      direct("file_read", { path: "/workspace/receipt.png" }),
      result('[Image "receipt.png" available via image_ask]'),
      direct("image_ask", {
        path: "receipt.png",
        question: "What is the printed TOTAL?",
      }),
      result("The total is $148.34.\nConfidence: high"),
    ]);
    expect(usage.imageAskCalls).toHaveLength(1);
    expect(usage.questions).toEqual(["What is the printed TOTAL?"]);
    expect(usage.targets).toEqual(["receipt.png"]);
    expect(usage.errorCount).toBe(0);
  });

  test("unwraps a skill_execute-dispatched image_ask", () => {
    // The trap tool-activity exists for: greping the wire tool name
    // alone reports a confident zero on a dispatched call.
    const usage = readImageAskUsage([
      dispatched("image_ask", { path: "chart.png", question: "Y axis?" }),
      result("Downloads (thousands)\nConfidence: high"),
    ]);
    expect(usage.imageAskCalls).toHaveLength(1);
    expect(usage.targets).toEqual(["chart.png"]);
  });

  test("counts sibling vision tools in the broad total", () => {
    const usage = readImageAskUsage([
      direct("image_ask", { path: "a.png", question: "q" }),
      direct("image_describe", { path: "a.png" }),
      direct("file_read", { path: "notes.md" }),
    ]);
    expect(usage.imageAskCalls).toHaveLength(1);
    expect(usage.visionToolCalls).toHaveLength(2);
    expect(usage.visionToolCounts).toEqual({
      image_ask: 1,
      image_describe: 1,
    });
  });

  test("reads the question from either input field", () => {
    const usage = readImageAskUsage([
      direct("image_ask", { image: "photo.png", prompt: "What text?" }),
    ]);
    expect(usage.questions).toEqual(["What text?"]);
    expect(usage.targets).toEqual(["photo.png"]);
  });

  test("counts failed image_ask calls", () => {
    const usage = readImageAskUsage([
      direct("image_ask", { path: "missing.png", question: "q" }),
      errorResult("Error: no such image"),
    ]);
    expect(usage.errorCount).toBe(1);
  });

  test("a run with no image tooling reports zeroes, not nothing", () => {
    const usage = readImageAskUsage([
      direct("file_read", { path: "receipt.png" }),
      result("a caption of the receipt"),
    ]);
    expect(usage.imageAskCalls).toHaveLength(0);
    expect(usage.visionToolCalls).toHaveLength(0);
    expect(usage.visionToolCounts).toEqual({});
  });
});

describe("gradeImageAskUsage", () => {
  test("an answered run scores 1 whatever the call count", () => {
    // Diagnostic, not pass/fail: zero calls in caption mode is a
    // perfectly good run, and so is five in handle-only mode.
    const withCalls = gradeImageAskUsage(
      [direct("image_ask", { path: "a.png", question: "q" })],
      true,
    );
    const without = gradeImageAskUsage([direct("file_read", {})], true);
    expect(withCalls.score).toBe(1);
    expect(without.score).toBe(1);
    expect(withCalls.metadata?.imageAskCallCount).toBe(1);
    expect(without.metadata?.imageAskCallCount).toBe(0);
  });

  test("a run that never answered scores 0", () => {
    const result = gradeImageAskUsage([], false);
    expect(result.score).toBe(0);
    expect(result.reason).toContain("no assistant response");
  });

  test("the metadata carries what the comparison reads", () => {
    const graded = gradeImageAskUsage(
      [
        direct("image_ask", { path: "table.png", question: "South Q2?" }),
        result("-4700.00\nConfidence: high"),
        direct("image_ask", { path: "table.png", question: "West Q3?" }),
        errorResult("Error: vision profile unavailable"),
      ],
      true,
    );
    expect(graded.metadata).toMatchObject({
      imageAskCallCount: 2,
      visionToolCallCount: 2,
      imageAskErrorCount: 1,
      imageAskTargets: ["table.png", "table.png"],
      diagnostic: true,
    });
  });
});
