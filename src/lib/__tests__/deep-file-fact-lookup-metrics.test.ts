import { describe, expect, test } from "bun:test";

import scoreAnswerCorrect, {
  gradeAnswer,
  mentionsAmount,
} from "../../../benchmarks/personal-intelligence/tests/deep-file-fact-lookup/metrics/answer-correct";
import scoreTruncationPaging, {
  gradeTruncationPaging,
} from "../../../benchmarks/personal-intelligence/tests/deep-file-fact-lookup/metrics/truncation-paging";
import { gradeReadEconomy } from "../../../benchmarks/personal-intelligence/tests/deep-file-fact-lookup/metrics/read-economy";
import {
  BIG_FILE_PATH,
  BIG_FILE_TOTAL_LINES,
  CORRECT_TOTAL,
  DEPRECATED_TABLE_TOTAL,
} from "../../../benchmarks/personal-intelligence/tests/deep-file-fact-lookup/constants";
import { fileReadCalls } from "../common-metrics/tool-activity";
import {
  appendAssistantEvents,
  appendTranscriptTurn,
  ensureRunArtifacts,
} from "../metrics";

import type { AgentEvent } from "../adapter";

const WORKSPACE_BIG_FILE = `/workspace/${BIG_FILE_PATH}`;

/** A direct tool call, the wire shape. */
function read(input: Record<string, unknown>): AgentEvent {
  return { message: { type: "tool_use_start", toolName: "file_read", input } };
}

/** A tool result. The Vellum daemon's carries no toolUseId. */
function result(text: string): AgentEvent {
  return { message: { type: "tool_result", result: text } };
}

/** The assistant's truncation notice, verbatim shape. */
function truncationNotice(lastLine: number, total: number): string {
  return `[Truncated: showing through line ${lastLine} of ${total}. Read on with offset=${lastLine + 1}, or pass an explicit limit.]`;
}

/** The spool stub the assistant swaps in for an oversized result. */
const SPOOL_STUB_RESULT =
  "...(5321 tokens omitted — full result: /workspace/.conversations/c1/.tool-results/ab12cd34ef56.txt — use file_read to view)";

/** Formats 20270 as "20,270". */
function withCommas(value: number): string {
  return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

async function freshRunId(name: string): Promise<string> {
  const runId = `test-deep-file-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await ensureRunArtifacts(runId);
  return runId;
}

describe("deep-file-fact-lookup answer-correct grading", () => {
  test("the correct total earns the point, in any common formatting", () => {
    for (const text of [
      `The order comes to $${withCommas(CORRECT_TOTAL)}.`,
      `Total: ${CORRECT_TOTAL} USD`,
      `That would cost $${CORRECT_TOTAL}.00 all in.`,
    ]) {
      expect(gradeAnswer(text).matched).toBe("correct");
    }
  });

  test("the deprecated table's total is the trap", () => {
    const grade = gradeAnswer(
      `One of everything comes to $${withCommas(DEPRECATED_TABLE_TOTAL)}.`,
    );
    expect(grade.matched).toBe("deprecated-trap");
    expect(grade.mentionsDeprecated).toBe(true);
  });

  test("explaining the superseded total alongside the right one still passes", () => {
    const grade = gradeAnswer(
      `The deprecated 2025 table sums to $${withCommas(DEPRECATED_TABLE_TOTAL)}, but the current catalog totals $${withCommas(CORRECT_TOTAL)}.`,
    );
    expect(grade.matched).toBe("correct");
    expect(grade.mentionsDeprecated).toBe(true);
  });

  test("neither total scores nothing", () => {
    expect(gradeAnswer("I could not find a price table.").matched).toBe("none");
  });

  test("a longer number containing the total does not count as it", () => {
    expect(mentionsAmount(`$${CORRECT_TOTAL}9`, CORRECT_TOTAL)).toBe(false);
    expect(mentionsAmount(`1${CORRECT_TOTAL}`, CORRECT_TOTAL)).toBe(false);
    expect(mentionsAmount(`${CORRECT_TOTAL}.50`, CORRECT_TOTAL)).toBe(false);
  });

  test("the default scorer reads the assistant transcript", async () => {
    const runId = await freshRunId("transcript");
    await appendTranscriptTurn(runId, {
      role: "assistant",
      content: `Ordering one of every SKU costs $${withCommas(CORRECT_TOTAL)}.`,
      emittedAt: "now",
    });
    const scored = await scoreAnswerCorrect({ runId });
    expect(scored.score).toBe(1);
    expect(scored.metadata).toMatchObject({ matched: "correct" });
  });

  test("the default scorer flags the trap value with metadata.matched", async () => {
    const runId = await freshRunId("trap");
    await appendTranscriptTurn(runId, {
      role: "assistant",
      content: `The total is $${withCommas(DEPRECATED_TABLE_TOTAL)}.`,
      emittedAt: "now",
    });
    const scored = await scoreAnswerCorrect({ runId });
    expect(scored.score).toBe(0);
    expect(scored.metadata).toMatchObject({ matched: "deprecated-trap" });
  });
});

describe("deep-file-fact-lookup truncation-paging grading", () => {
  const truncatedFirstRead = [
    read({ path: WORKSPACE_BIG_FILE }),
    result(truncationNotice(2000, BIG_FILE_TOTAL_LINES)),
  ];

  test("scores 1 when the resume offset from the notice is honored", () => {
    const reads = fileReadCalls([
      ...truncatedFirstRead,
      read({ path: WORKSPACE_BIG_FILE, offset: 2001 }),
      result("lines 2001 onward"),
    ]);
    const graded = gradeTruncationPaging(reads);
    expect(graded.score).toBe(1);
    expect(graded.applicable).not.toBe(false);
    expect(graded.metadata).toMatchObject({
      truncatedReads: 1,
      totalLinesObserved: BIG_FILE_TOTAL_LINES,
    });
  });

  test("a ranged read past the resume point also honors it", () => {
    const reads = fileReadCalls([
      ...truncatedFirstRead,
      read({ path: WORKSPACE_BIG_FILE, offset: 5150, limit: 300 }),
      result("the current table"),
    ]);
    expect(gradeTruncationPaging(reads).score).toBe(1);
  });

  test("scores 0 when the agent re-reads from the top", () => {
    const reads = fileReadCalls([
      ...truncatedFirstRead,
      read({ path: WORKSPACE_BIG_FILE, offset: 1 }),
      result(truncationNotice(2000, BIG_FILE_TOTAL_LINES)),
    ]);
    const graded = gradeTruncationPaging(reads);
    expect(graded.score).toBe(0);
    expect(graded.applicable).not.toBe(false);
  });

  test("scores 0 when the truncated read is abandoned", () => {
    const graded = gradeTruncationPaging(fileReadCalls(truncatedFirstRead));
    expect(graded.score).toBe(0);
    expect(graded.applicable).not.toBe(false);
  });

  test("not applicable when a large explicit limit dodged truncation", () => {
    const reads = fileReadCalls([
      read({ path: WORKSPACE_BIG_FILE, limit: 10000 }),
      result("the whole file"),
    ]);
    const graded = gradeTruncationPaging(reads);
    expect(graded.applicable).toBe(false);
    expect(graded.metadata).toMatchObject({
      bigFileReads: 1,
      truncatedReads: 0,
      explicitLimits: [10000],
    });
  });

  test("not applicable when the file was never read", () => {
    const reads = fileReadCalls([
      read({ path: "/workspace/catalog/README.md" }),
      result("readme"),
    ]);
    const graded = gradeTruncationPaging(reads);
    expect(graded.applicable).toBe(false);
    expect(graded.metadata).toMatchObject({ bigFileReads: 0 });
  });

  test("truncated reads of OTHER files do not gate this metric", () => {
    // A truncated read of an unrelated file with no follow-up must not
    // fail the pricing-file verdict.
    const reads = fileReadCalls([
      ...truncatedFirstRead,
      read({ path: WORKSPACE_BIG_FILE, offset: 2001 }),
      result("lines 2001 onward"),
      read({ path: "/workspace/other.log" }),
      result(truncationNotice(2000, 9000)),
    ]);
    expect(gradeTruncationPaging(reads).score).toBe(1);
  });

  test("the default scorer reads assistant events", async () => {
    const runId = await freshRunId("paging");
    await appendAssistantEvents(runId, [
      ...truncatedFirstRead,
      read({ path: WORKSPACE_BIG_FILE, offset: 2001 }),
      result("lines 2001 onward"),
    ]);
    const scored = await scoreTruncationPaging({ runId });
    expect(scored.score).toBe(1);
  });
});

describe("deep-file-fact-lookup read-economy grading", () => {
  test("sums inline result chars across all file reads", () => {
    const graded = gradeReadEconomy([
      read({ path: WORKSPACE_BIG_FILE }),
      result("a".repeat(100)),
      read({ path: "/workspace/catalog/README.md" }),
      result("b".repeat(40)),
    ]);
    expect(graded.score).toBe(140);
    expect(graded.unit).toBe("raw");
  });

  test("counts default-limit reads, spooled reads, and reads per file", () => {
    const graded = gradeReadEconomy([
      read({ path: WORKSPACE_BIG_FILE }),
      result(SPOOL_STUB_RESULT),
      read({ path: WORKSPACE_BIG_FILE, offset: 2001, limit: 500 }),
      result("lines 2001-2500"),
      read({ path: "/workspace/catalog/README.md" }),
      result("readme"),
    ]);
    expect(graded.metadata).toMatchObject({
      totalReads: 3,
      defaultLimitReads: 2,
      spooledReads: 1,
      readsPerFile: {
        [WORKSPACE_BIG_FILE]: 2,
        "/workspace/catalog/README.md": 1,
      },
    });
  });

  test("a run with no file reads pulled zero chars inline", () => {
    const graded = gradeReadEconomy([]);
    expect(graded.score).toBe(0);
    expect(graded.metadata).toMatchObject({ totalReads: 0 });
  });
});
