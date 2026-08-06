import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { AgentEvent } from "../adapter";
import { gradePatchNotRewrite } from "../../../benchmarks/personal-intelligence/tests/surgical-bugfix-ledger/metrics/patch-not-rewrite";
import { gradeLineDiff } from "../../../benchmarks/personal-intelligence/tests/surgical-bugfix-ledger/metrics/minimal-diff";
import { EXPECTED_CHANGED_LINES } from "../../../benchmarks/personal-intelligence/tests/surgical-bugfix-ledger/constants";

/** A direct tool call, the wire shape (see tool-activity.test.ts). */
function toolCall(
  toolName: string,
  input: Record<string, unknown>,
): AgentEvent {
  return { message: { type: "tool_use_start", toolName, input } };
}

describe("gradePatchNotRewrite", () => {
  test("scores 1 when the target was patched via file_edit only", () => {
    const result = gradePatchNotRewrite([
      toolCall("file_read", { path: "/workspace/src/ledger.ts" }),
      toolCall("file_edit", { path: "/workspace/src/ledger.ts" }),
    ]);
    expect(result.score).toBe(1);
    expect(result.applicable).toBeUndefined();
    expect(result.metadata?.targetEdited).toBe(true);
  });

  test("scores 0 when a staged file was rewritten via file_write", () => {
    const result = gradePatchNotRewrite([
      toolCall("file_write", { path: "/workspace/src/ledger.ts" }),
    ]);
    expect(result.score).toBe(0);
    expect(result.applicable).toBeUndefined();
  });

  test("a rewrite scores 0 even alongside surgical edits elsewhere", () => {
    // Fix style is judged on the whole run: patching one file does not
    // excuse regenerating another staged file wholesale.
    const result = gradePatchNotRewrite([
      toolCall("file_edit", { path: "/workspace/src/ledger.ts" }),
      toolCall("file_write", { path: "/workspace/report.ts" }),
    ]);
    expect(result.score).toBe(0);
  });

  test("a file_write creating a NEW file is not a rewrite", () => {
    const result = gradePatchNotRewrite([
      toolCall("file_edit", { path: "/workspace/src/ledger.ts" }),
      toolCall("file_write", { path: "/workspace/notes/debugging.md" }),
    ]);
    expect(result.score).toBe(1);
  });

  test("unwraps skill_execute-dispatched writes like direct ones", () => {
    const result = gradePatchNotRewrite([
      {
        message: {
          type: "tool_use_start",
          toolName: "skill_execute",
          input: {
            tool: "file_write",
            input: { path: "/workspace/src/ledger.ts" },
          },
        },
      },
    ]);
    expect(result.score).toBe(0);
  });

  test("is not applicable when no edit happened at all", () => {
    const result = gradePatchNotRewrite([
      toolCall("file_read", { path: "/workspace/src/ledger.ts" }),
    ]);
    expect(result.applicable).toBe(false);
    expect(result.metadata?.noEditObserved).toBe(true);
  });

  test("accepts workspace-relative paths for the staged files", () => {
    const result = gradePatchNotRewrite([
      toolCall("file_write", { path: "src/ledger.ts" }),
    ]);
    expect(result.score).toBe(0);
  });
});

describe("gradeLineDiff", () => {
  /** A synthetic 10-line file; the "intended fix" targets line 5. */
  const lines = Array.from({ length: 10 }, (_, i) => `line ${i + 1}`);
  const before = lines.join("\n");
  const expected = [5];

  const withLine = (index1: number, text: string): string =>
    lines.map((line, i) => (i + 1 === index1 ? text : line)).join("\n");

  test("the intended one-line fix scores 1", () => {
    const grade = gradeLineDiff(before, withLine(5, "fixed"), expected);
    expect(grade.score).toBe(1);
    expect(grade.changedLineCount).toBe(1);
    expect(grade.changedLines).toEqual([5]);
    expect(grade.unrelatedChangedLines).toEqual([]);
  });

  test("a change within the ±2 slack window still scores 1", () => {
    const grade = gradeLineDiff(before, withLine(7, "nudged"), expected);
    expect(grade.score).toBe(1);
    expect(grade.changedLines).toEqual([7]);
  });

  test("a change outside the slack window degrades the score", () => {
    const grade = gradeLineDiff(before, withLine(1, "stray"), expected);
    expect(grade.score).toBeLessThan(1);
    expect(grade.score).toBeGreaterThan(0);
    expect(grade.unrelatedChangedLines).toEqual([1]);
  });

  test("a wholesale rewrite scores 0", () => {
    const rewritten = Array.from(
      { length: 80 },
      (_, i) => `regenerated ${i + 1}`,
    ).join("\n");
    const grade = gradeLineDiff(before, rewritten, expected);
    expect(grade.score).toBe(0);
    expect(grade.changedLineCount).toBeGreaterThanOrEqual(10);
  });

  test("net inserted lines count toward churn", () => {
    const inserted = [
      ...lines.slice(0, 4),
      "fixed",
      "an extra explanatory line",
      ...lines.slice(5),
    ].join("\n");
    const grade = gradeLineDiff(before, inserted, expected);
    expect(grade.score).toBeLessThan(1);
    expect(grade.changedLineCount).toBe(2);
    expect(grade.unrelatedChurn).toBe(1);
  });

  test("an identical file reports zero changed lines", () => {
    const grade = gradeLineDiff(before, before, expected);
    expect(grade.changedLineCount).toBe(0);
    expect(grade.changedLines).toEqual([]);
  });

  test("scattered edits bridge into one region that overstates churn", () => {
    // Documented simplification: edits at lines 2 and 9 yield a changed
    // region spanning 2..9 — untouched lines in between count as churn.
    const scattered = lines
      .map((line, i) => (i + 1 === 2 || i + 1 === 9 ? `${line} touched` : line))
      .join("\n");
    const grade = gradeLineDiff(before, scattered, expected);
    expect(grade.changedLines).toEqual([2, 3, 4, 5, 6, 7, 8, 9]);
    expect(grade.score).toBeLessThan(1);
  });
});

describe("fixture ground truth", () => {
  test("EXPECTED_CHANGED_LINES matches the committed fixtures", () => {
    // Guards the regenerate-only rule: if someone hand-edits a fixture,
    // the staged-vs-expected diff no longer lands on the constant.
    const caseDir = join(
      import.meta.dir,
      "..",
      "..",
      "..",
      "benchmarks",
      "personal-intelligence",
      "tests",
      "surgical-bugfix-ledger",
    );
    const buggy = readFileSync(
      join(caseDir, "assets", "project", "src", "ledger.ts"),
      "utf8",
    );
    const fixed = readFileSync(
      join(caseDir, "assets", "expected-fixed", "ledger.ts"),
      "utf8",
    );
    const grade = gradeLineDiff(buggy, fixed, EXPECTED_CHANGED_LINES);
    expect(grade.score).toBe(1);
    expect(grade.changedLineCount).toBe(1);
    expect(grade.changedLines).toEqual(EXPECTED_CHANGED_LINES);
  });
});
