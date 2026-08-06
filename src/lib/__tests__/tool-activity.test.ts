import { describe, expect, test } from "bun:test";

import type { AgentEvent } from "../adapter";
import {
  defaultWindowTruncations,
  editStyle,
  fileReadCalls,
  isSpoolDerefRead,
  noObservableReadsReason,
  observedReadScope,
  readsPerFile,
  readToolCalls,
  resumeOffsetHonored,
} from "../common-metrics/tool-activity";

/** A direct tool call, the wire shape. */
function direct(
  toolName: string,
  input: Record<string, unknown>,
  toolUseId?: string,
): AgentEvent {
  return {
    message: { type: "tool_use_start", toolName, input, toolUseId },
  };
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

/** A tool result. The Vellum daemon's carries no toolUseId. */
function result(text: string, toolUseId?: string): AgentEvent {
  return { message: { type: "tool_result", result: text, toolUseId } };
}

/** A FAILED tool result — `isError: true`, text is the error message. */
function errorResult(text: string): AgentEvent {
  return { message: { type: "tool_result", result: text, isError: true } };
}

/** The assistant's truncation notice, verbatim shape. */
function truncationNotice(lastLine: number, total: number): string {
  return `[Truncated: showing through line ${lastLine} of ${total}. Read on with offset=${lastLine + 1}, or pass an explicit limit.]`;
}

/** The spool stub the assistant swaps in for an oversized result. */
const SPOOL_STUB_RESULT =
  "row 1\nrow 2\n\n...(5321 tokens omitted — full result: /workspace/.conversations/c1/.tool-results/ab12cd34ef56.txt — use file_read to view)\n\nrow 9999";

describe("readToolCalls", () => {
  test("unwraps the skill_execute dispatch envelope", () => {
    // The trap this module exists for: greping for a `file_read` TOOL
    // NAME finds nothing when the call rode a `skill_execute` envelope.
    const events = [
      dispatched("file_read", { path: "/workspace/notes.md" }),
      result("the notes"),
    ];
    const calls = readToolCalls(events);
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("file_read");
    expect(calls[0].input.path).toBe("/workspace/notes.md");
    expect(calls[0].resultText).toBe("the notes");
  });

  test("enveloped and direct calls normalize identically", () => {
    const viaEnvelope = readToolCalls([
      dispatched("file_read", { path: "/workspace/a.md" }),
      result("body"),
    ]);
    const viaWire = readToolCalls([
      direct("file_read", { path: "/workspace/a.md" }),
      result("body"),
    ]);
    expect(viaEnvelope).toEqual(viaWire);
  });

  test("pairs results to the oldest unresolved call when ids are absent", () => {
    // The Vellum daemon's tool_result omits toolUseId; results arrive
    // in start order on a single-threaded turn.
    const events = [
      direct("file_read", { path: "/workspace/a.md" }),
      direct("file_read", { path: "/workspace/b.md" }),
      result("contents of a"),
      result("contents of b"),
    ];
    const calls = readToolCalls(events);
    expect(calls[0].resultText).toBe("contents of a");
    expect(calls[1].resultText).toBe("contents of b");
  });

  test("pairs results by toolUseId when both sides carry one", () => {
    const events = [
      direct("file_read", { path: "/workspace/a.md" }, "tu-1"),
      direct("file_read", { path: "/workspace/b.md" }, "tu-2"),
      result("contents of b", "tu-2"),
    ];
    const calls = readToolCalls(events);
    expect(calls[0].resultText).toBeUndefined();
    expect(calls[1].resultText).toBe("contents of b");
  });

  test("ignores non-tool events", () => {
    const events: AgentEvent[] = [
      { message: { type: "assistant_text_delta", text: "file_read" } },
    ];
    expect(readToolCalls(events)).toHaveLength(0);
  });
});

describe("readToolCalls error flag", () => {
  test("captures isError from the paired result", () => {
    const calls = readToolCalls([
      direct("file_read", { path: "/workspace/a.md" }),
      errorResult("Error: file not found"),
      direct("file_read", { path: "/workspace/b.md" }),
      result("body"),
    ]);
    expect(calls[0].isError).toBe(true);
    // A result without the flag leaves it unset — only an explicit
    // `isError: true` marks failure.
    expect(calls[1].isError).toBeUndefined();
  });
});

describe("path canonicalization", () => {
  test("all spellings of a workspace file share one identity", () => {
    // Real runs mix these spellings for the SAME file.
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/catalog/price-table.ts" }),
      direct("file_read", { path: "catalog/price-table.ts" }),
      direct("file_read", { path: "./catalog/price-table.ts" }),
      direct("file_read", { path: "/workspace//catalog/price-table.ts" }),
      // Dot segment inside the prefix: the ./ strip must run AFTER the
      // /workspace/ strip, or this spelling forks a second identity.
      direct("file_read", { path: "/workspace/./catalog/price-table.ts" }),
    ]);
    expect(reads.map((read) => read.path)).toEqual(
      Array.from({ length: 5 }, () => "catalog/price-table.ts"),
    );
    expect(readsPerFile(reads).get("catalog/price-table.ts")).toBe(5);
  });

  test("paths outside the workspace keep their absolute spelling", () => {
    const reads = fileReadCalls([
      direct("host_file_read", { path: "/var/log/app.log" }),
    ]);
    expect(reads[0].path).toBe("/var/log/app.log");
  });
});

describe("fileReadCalls", () => {
  test("reads path, offset, limit and result size", () => {
    const reads = fileReadCalls([
      direct("host_file_read", {
        path: "/var/log/app.log",
        offset: 10,
        limit: 50,
      }),
      result("ten lines"),
    ]);
    expect(reads).toHaveLength(1);
    expect(reads[0]).toMatchObject({
      path: "/var/log/app.log",
      offset: 10,
      limit: 50,
      resultChars: "ten lines".length,
      spooled: false,
    });
    expect(reads[0].truncated).toBeUndefined();
  });

  test("captures both numbers from the truncation notice", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(`row 1\nrow 2\n${truncationNotice(400, 1200)}`),
    ]);
    expect(reads[0].truncated).toEqual({
      lastLineReturned: 400,
      totalLines: 1200,
    });
  });

  test("flags a result replaced by the spool stub, capturing its path", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/huge.json" }),
      result(SPOOL_STUB_RESULT),
    ]);
    expect(reads[0].spooled).toBe(true);
    // Canonical (workspace-relative) so a deref by any spelling matches.
    expect(reads[0].spoolPath).toBe(
      ".conversations/c1/.tool-results/ab12cd34ef56.txt",
    );
  });

  test("normalizes backslashes in the target path", () => {
    const reads = fileReadCalls([
      direct("file_read", { file_path: "C:\\conv\\.tool-results\\ab.txt" }),
    ]);
    expect(reads[0].path).toBe("C:/conv/.tool-results/ab.txt");
  });
});

describe("isSpoolDerefRead", () => {
  test("finds the deref read after a spooled result", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/huge.json" }),
      result(SPOOL_STUB_RESULT),
      direct("file_read", {
        path: "/workspace/.conversations/c1/.tool-results/ab12cd34ef56.txt",
      }),
      result("the full spooled content"),
    ]);
    const derefs = reads.filter(isSpoolDerefRead);
    expect(derefs).toHaveLength(1);
    expect(derefs[0].path).toBe(
      ".conversations/c1/.tool-results/ab12cd34ef56.txt",
    );
  });

  test("a spool dir at the workspace root is still a deref", () => {
    // Canonical paths are workspace-relative, so a root-level spool dir
    // becomes a LEADING `.tool-results/` segment with no slash before it.
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/.tool-results/ab12.txt" }),
    ]);
    expect(isSpoolDerefRead(reads[0])).toBe(true);
  });

  test("an ordinary read is not a deref", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/notes.md" }),
    ]);
    expect(reads.filter(isSpoolDerefRead)).toHaveLength(0);
  });
});

describe("readsPerFile", () => {
  test("counts reads per distinct path", () => {
    const counts = readsPerFile(
      fileReadCalls([
        direct("file_read", { path: "/workspace/a.md" }),
        direct("file_read", { path: "/workspace/a.md", offset: 100 }),
        direct("file_read", { path: "/workspace/b.md" }),
      ]),
    );
    expect(counts.get("a.md")).toBe(2);
    expect(counts.get("b.md")).toBe(1);
  });
});

describe("editStyle", () => {
  test("classifies edits vs wholesale writes", () => {
    const style = editStyle([
      direct("file_edit", { path: "/workspace/report.md" }),
      dispatched("file_write", { path: "/workspace/config.json" }),
    ]);
    expect(style.surgicalEdits).toEqual(["report.md"]);
    expect(style.fullWrites).toEqual(["config.json"]);
  });

  test("a write creating a new file is not a rewrite", () => {
    const style = editStyle(
      [
        direct("file_write", { path: "/workspace/fresh.md" }),
        direct("file_write", { path: "/workspace/existing.md" }),
      ],
      { preexistingPaths: ["/workspace/existing.md"] },
    );
    expect(style.fullWrites).toEqual(["existing.md"]);
  });

  test("a second write to a file the run created IS a rewrite", () => {
    const style = editStyle(
      [
        direct("file_write", { path: "/workspace/fresh.md" }),
        direct("file_write", { path: "/workspace/fresh.md" }),
      ],
      { preexistingPaths: [] },
    );
    expect(style.fullWrites).toEqual(["fresh.md"]);
  });

  test("a write via another spelling of a staged path IS a rewrite", () => {
    // The bug this canonicalization fixes: `./src/ledger.ts` was not in
    // the exact-string preexisting set, so a wholesale rewrite was
    // misread as a new-file creation.
    const style = editStyle(
      [
        direct("file_write", { path: "./src/ledger.ts" }),
        direct("file_write", { path: "/workspace/report.ts" }),
      ],
      { preexistingPaths: ["src/ledger.ts", "report.ts"] },
    );
    expect(style.fullWrites).toEqual(["src/ledger.ts", "report.ts"]);
  });
});

describe("defaultWindowTruncations", () => {
  test("a default-window truncation short of the end gates", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
    ]);
    expect(defaultWindowTruncations(reads)).toHaveLength(1);
  });

  test("an explicit-limit truncation is a chosen window, not a gate", () => {
    // The assistant stamps the notice on ANY windowed read that stops
    // before the last line — a grep-guided slice gets one too.
    const reads = fileReadCalls([
      direct("file_read", {
        path: "/workspace/big.csv",
        offset: 5197,
        limit: 200,
      }),
      result(`the table\n${truncationNotice(5396, 6000)}`),
    ]);
    expect(defaultWindowTruncations(reads)).toHaveLength(0);
  });

  test("a notice covering only the phantom trailing line is complete", () => {
    // A trailing newline makes split("\n") count an empty final "line",
    // so paging that reached line 6000 of "6001" is done.
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv", offset: 4001 }),
      result(truncationNotice(6000, 6001)),
    ]);
    expect(defaultWindowTruncations(reads)).toHaveLength(0);
  });
});

describe("resumeOffsetHonored", () => {
  test("true when the notice's offset is used to read on", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
      direct("file_read", { path: "/workspace/big.csv", offset: 2001 }),
      result(truncationNotice(4000, 6000)),
      direct("file_read", { path: "/workspace/big.csv", offset: 4001 }),
      result("rows 4001 through the end"),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(true);
  });

  test("a ranged read past the resume point also honors it", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
      direct("file_read", {
        path: "/workspace/big.csv",
        offset: 5200,
        limit: 100,
      }),
      result(`rows 5200-5299\n${truncationNotice(5299, 6000)}`),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(true);
  });

  test("a defensive overlap resume still counts as forward progress", () => {
    // GIVEN a resume that re-reads the boundary line (offset =
    // lastLineReturned) — the follow-up window still reads new lines
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
      direct("file_read", { path: "/workspace/big.csv", offset: 2000 }),
      result(truncationNotice(3999, 6000)),
      direct("file_read", { path: "/workspace/big.csv", offset: 3999 }),
      result("rows through the end"),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(true);
  });

  test("false when the agent re-reads from the top", () => {
    // A re-read of the same top window truncates at the same line again
    // — no coverage progress.
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
      direct("file_read", { path: "/workspace/big.csv", offset: 1 }),
      result(truncationNotice(2000, 6000)),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(false);
  });

  test("false when a truncated read has no follow-up at all", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(false);
  });

  test("a follow-up whose result never arrived is not a resume", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
      direct("file_read", { path: "/workspace/big.csv", offset: 2001 }),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(false);
  });

  test("an explicit-limit truncated read does not gate", () => {
    const reads = fileReadCalls([
      direct("file_read", {
        path: "/workspace/big.csv",
        offset: 5197,
        limit: 200,
      }),
      result(`the table\n${truncationNotice(5396, 6000)}`),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(true);
  });

  test("phantom-line sequential paging ends honored, not truncated", () => {
    // Canonical 1 → 2001 → 4001 paging of a 6000-line file whose
    // trailing newline makes the assistant report 6001 total lines.
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6001)),
      direct("file_read", { path: "/workspace/big.csv", offset: 2001 }),
      result(truncationNotice(4000, 6001)),
      direct("file_read", { path: "/workspace/big.csv", offset: 4001 }),
      result(truncationNotice(6000, 6001)),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(true);
  });

  test("vacuously true with no truncated reads", () => {
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/small.md" }),
      result("everything"),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(true);
  });

  test("a resume via another spelling of the path still counts", () => {
    // GIVEN a truncated relative-path read resumed via the absolute
    // spelling — the same file, previously scored 0 "abandoned"
    const reads = fileReadCalls([
      direct("file_read", { path: "catalog/price-table.ts" }),
      result(truncationNotice(2000, 6000)),
      direct("file_read", {
        path: "/workspace/catalog/price-table.ts",
        offset: 2001,
      }),
      result("rows 2001 through the end"),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(true);
  });

  test("an errored follow-up is not a resume", () => {
    // GIVEN a follow-up whose non-empty result is an ERROR message —
    // notice-free non-empty text must not read as "ran to EOF"
    const reads = fileReadCalls([
      direct("file_read", { path: "/workspace/big.csv" }),
      result(truncationNotice(2000, 6000)),
      direct("file_read", { path: "/workspace/big.csv", offset: 2001 }),
      errorResult("Error: file not found"),
    ]);
    expect(resumeOffsetHonored(reads)).toBe(false);
  });
});

describe("observedReadScope", () => {
  test("collects reads, search calls, spawns and the scope sentence", () => {
    const observed = observedReadScope([
      direct("file_read", { path: "/workspace/a.md" }),
      result("body"),
      direct("host_code_search", { query: "needle" }),
      result("a.md:1: needle"),
      dispatched("subagent_spawn", { label: "s", objective: "survey" }),
    ]);
    expect(observed.reads).toHaveLength(1);
    expect(observed.codeSearchCalls).toBe(1);
    expect(observed.subagentSpawnCount).toBe(1);
    expect(observed.scope).toContain("parent-events-only");
  });

  test("the not-applicable reason branches on delegation", () => {
    expect(
      noObservableReadsReason(
        { codeSearchCalls: 0, subagentSpawnCount: 2 },
        { delegated: "it is not scored", noReads: "nothing to grade" },
      ),
    ).toContain("2 subagent(s) were spawned");
    expect(
      noObservableReadsReason(
        { codeSearchCalls: 3, subagentSpawnCount: 0 },
        { delegated: "it is not scored", noReads: "nothing to grade" },
      ),
    ).toContain("(3 code_search call(s)) — nothing to grade.");
  });
});
