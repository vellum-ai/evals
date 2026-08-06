import { describe, expect, test } from "bun:test";

import scoreAnswerCorrect, {
  gradeAnswer,
} from "../../../benchmarks/personal-intelligence/tests/deep-file-fact-lookup/metrics/answer-correct";
import scoreTruncationPaging, {
  gradeTruncationPaging,
} from "../../../benchmarks/personal-intelligence/tests/deep-file-fact-lookup/metrics/truncation-paging";
import { mentionsStandaloneNumber } from "../common-metrics/number-mention";
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
    expect(mentionsStandaloneNumber(`$${CORRECT_TOTAL}9`, CORRECT_TOTAL)).toBe(
      false,
    );
    expect(mentionsStandaloneNumber(`1${CORRECT_TOTAL}`, CORRECT_TOTAL)).toBe(
      false,
    );
    expect(mentionsStandaloneNumber(`${CORRECT_TOTAL}.50`, CORRECT_TOTAL)).toBe(
      false,
    );
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

  test("not applicable when one precise grep-guided slice hit the notice", () => {
    // GIVEN the winning strategy: search located the current table, one
    // explicit-window read fetched it. The assistant stamps a notice on
    // any windowed read stopping short of the last line — that must not
    // read as a paging failure.
    const reads = fileReadCalls([
      read({ path: WORKSPACE_BIG_FILE, offset: 5197, limit: 200 }),
      result(
        `the current table\n${truncationNotice(5396, BIG_FILE_TOTAL_LINES)}`,
      ),
    ]);
    const graded = gradeTruncationPaging(reads);
    expect(graded.applicable).toBe(false);
    expect(graded.metadata).toMatchObject({
      truncatedReads: 1,
      gatingTruncatedReads: 0,
      explicitLimits: [200],
    });
  });

  test("a defensive overlap resume scores 1", () => {
    // GIVEN a resume from offset = lastLineReturned (one-line overlap)
    // that still advanced coverage
    const reads = fileReadCalls([
      ...truncatedFirstRead,
      read({ path: WORKSPACE_BIG_FILE, offset: 2000 }),
      result(truncationNotice(3999, BIG_FILE_TOTAL_LINES)),
      read({ path: WORKSPACE_BIG_FILE, offset: 3999 }),
      result("through the end"),
    ]);
    expect(gradeTruncationPaging(reads).score).toBe(1);
  });

  test("phantom-trailing-line paging scores 1, not a demand for line 6001", () => {
    // GIVEN canonical sequential paging of a file whose trailing newline
    // makes the assistant count a phantom final line (6001 "lines")
    const phantomTotal = BIG_FILE_TOTAL_LINES + 1;
    const reads = fileReadCalls([
      read({ path: WORKSPACE_BIG_FILE }),
      result(truncationNotice(2000, phantomTotal)),
      read({ path: WORKSPACE_BIG_FILE, offset: 2001 }),
      result(truncationNotice(4000, phantomTotal)),
      read({ path: WORKSPACE_BIG_FILE, offset: 4001 }),
      result(truncationNotice(BIG_FILE_TOTAL_LINES, phantomTotal)),
    ]);
    const graded = gradeTruncationPaging(reads);
    expect(graded.score).toBe(1);
    expect(graded.applicable).not.toBe(false);
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

// read-economy is a shared metric now — its grading tests live in
// `src/lib/__tests__/read-economy.test.ts` (one metadata schema across
// cases; the runbook aggregates the keys).
