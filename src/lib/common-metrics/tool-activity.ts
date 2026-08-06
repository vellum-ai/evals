/**
 * Shared reader for tool activity in an agent's event stream: file reads
 * (truncation notices, resume offsets, spool stubs), spool deref reads,
 * reads-per-file, and edit-vs-rewrite classification. Pure policy over
 * `AgentEvent[]` — unit-testable without Docker.
 *
 * Same dispatch-envelope gotcha as `subagent-activity.ts`: workspace tools
 * may not arrive as wire tools. A call can be dispatched through
 * `skill_execute` with the real tool name in `input.tool`:
 *
 *   skill_execute {"tool":"file_read","input":{"path":"/workspace/notes.md"}}
 *
 * so a metric that greps for a `file_read` TOOL NAME finds nothing and
 * reports a confident zero. Everything here unwraps the envelope first,
 * and accepts direct calls too.
 *
 * Results are paired to calls the way `transcript-view.ts` does: by
 * `toolUseId` when both sides carry one, else the oldest still-running
 * call (the Vellum daemon's `tool_result` omits the id; results arrive
 * in start order on a single-threaded turn).
 */

import type { AgentEvent } from "../adapter";

/** One normalized tool call (envelope-unwrapped), in stream order. */
export interface ToolCall {
  /** The dispatched tool's real name (unwrapped from skill_execute). */
  name: string;
  /** The dispatched tool's own input (already unwrapped). */
  input: Record<string, unknown>;
  /** The paired tool result's text, when one arrived. */
  resultText?: string;
  /** The `tool_use_start` event's stamp. */
  emittedAt?: string;
}

/** One `file_read`/`host_file_read` call, with what its result showed. */
export interface FileReadCall {
  /** Target path, backslashes normalized to forward slashes. */
  path: string;
  offset?: number;
  limit?: number;
  /** Length of the paired result text (0 when no result arrived). */
  resultChars: number;
  /**
   * Present when the result carries the assistant's truncation notice
   * `[Truncated: showing through line N of M. Read on with offset=N+1,
   * or pass an explicit limit.]` — N is `lastLineReturned`, M is
   * `totalLines`.
   */
  truncated?: { lastLineReturned: number; totalLines: number };
  /** True when the result was replaced by a `.tool-results/` spool stub. */
  spooled: boolean;
  /**
   * The `.tool-results/` file the spool stub points at, when `spooled`.
   * A later read of exactly this path is the deref that recovers THIS
   * read's omitted content.
   */
  spoolPath?: string;
}

/** Classification of how the run touched files it changed. */
export interface EditStyle {
  /** Paths touched via `file_edit`/`host_file_edit` (targeted diffs). */
  surgicalEdits: string[];
  /** Paths rewritten wholesale via `file_write`/`host_file_write`. */
  fullWrites: string[];
}

/** Mirrors the assistant's `FILE_READ_TOOL_NAMES`. */
const FILE_READ_TOOLS = new Set<string>(["file_read", "host_file_read"]);
const FILE_EDIT_TOOLS = new Set<string>(["file_edit", "host_file_edit"]);
const FILE_WRITE_TOOLS = new Set<string>(["file_write", "host_file_write"]);

/**
 * The workspace-search tools, host variant included. Shared so metrics
 * that classify a search-first strategy agree on what counts as a search
 * (`host_code_search` was being missed by hand-rolled copies).
 */
export const CODE_SEARCH_TOOLS = new Set<string>([
  "code_search",
  "host_code_search",
]);

/** The assistant's in-result truncation notice, capturing (N, M). */
const TRUNCATION_NOTICE = /\[Truncated: showing through line (\d+) of (\d+)\./;

/**
 * The spool stub's recovery marker. Hardcoded copy of the shape built by
 * `recoveryMarker()` around `TRUNCATION_MARKER` ("— full result:") in
 * the assistant repo's `src/context/post-turn-tool-result-truncation.ts`
 * — evals cannot import assistant code, so keep this in sync with that
 * file:
 *
 *   (N tokens omitted — full result: <path> — use file_read to view)
 *
 * The capture group is the spool file's path — the deref target.
 */
const SPOOL_STUB =
  /\d+ tokens omitted — full result: (.+?) — use file_read to view/;

/**
 * Directory name the assistant spools oversized tool results into
 * (`TOOL_RESULT_DIR` in the same assistant source file).
 */
const TOOL_RESULT_DIR = ".tool-results";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

/**
 * Backslashes → forward slashes, mirroring the assistant's
 * `isSpooledToolResultRead`, whose spool paths come from `join` and are
 * backslash-separated on Windows.
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/");
}

/** Target path of a file tool call: `path` (workspace tools) or `file_path`. */
function readPath(input: Record<string, unknown>): string | undefined {
  const raw = readString(input.path) ?? readString(input.file_path);
  return raw === undefined ? undefined : normalizePath(raw);
}

/**
 * Every tool call in the stream, normalized, with its paired result.
 *
 * Two call shapes are accepted: the `skill_execute` envelope the daemon
 * uses for skill-dispatched tools (`toolName: "skill_execute"`,
 * `input.tool: "<name>"`, `input.input: {...}`) and a direct call
 * (`toolName: "<name>"`). Result events (any `type` containing
 * `tool_result`, matching `script-reuse.ts`'s tolerance) attach by
 * `toolUseId` when carried, else to the oldest unresolved call.
 */
export function readToolCalls(events: AgentEvent[]): ToolCall[] {
  interface OpenCall {
    call: ToolCall;
    toolUseId?: string;
    resolved: boolean;
  }
  const calls: ToolCall[] = [];
  const open: OpenCall[] = [];

  for (const event of events) {
    const message = event.message;

    if (message.type === "tool_use_start") {
      const toolName = readString(message.toolName);
      if (toolName === undefined) continue;
      let name = toolName;
      let input = asRecord(message.input) ?? {};
      if (toolName === "skill_execute") {
        const dispatched = readString(input.tool);
        if (dispatched !== undefined) {
          name = dispatched;
          input = asRecord(input.input) ?? {};
        }
      }
      const call: ToolCall = { name, input, emittedAt: event.emittedAt };
      calls.push(call);
      open.push({
        call,
        toolUseId: readString(message.toolUseId),
        resolved: false,
      });
      continue;
    }

    if (!message.type.includes("tool_result")) continue;
    const toolUseId = readString(message.toolUseId);
    const target = open.find(
      (entry) =>
        !entry.resolved &&
        (toolUseId === undefined || entry.toolUseId === toolUseId),
    );
    if (target === undefined) continue;
    target.resolved = true;
    if (typeof message.result === "string") {
      target.call.resultText = message.result;
    }
  }

  return calls;
}

/**
 * All `file_read`/`host_file_read` calls, with truncation and spooling
 * read out of their results. Calls with no string path are dropped —
 * there is nothing to attribute the read to.
 */
export function fileReadCalls(events: AgentEvent[]): FileReadCall[] {
  const reads: FileReadCall[] = [];
  for (const call of readToolCalls(events)) {
    if (!FILE_READ_TOOLS.has(call.name)) continue;
    const path = readPath(call.input);
    if (path === undefined) continue;
    const result = call.resultText ?? "";
    const notice = TRUNCATION_NOTICE.exec(result);
    const stub = SPOOL_STUB.exec(result);
    reads.push({
      path,
      offset: readNumber(call.input.offset),
      limit: readNumber(call.input.limit),
      resultChars: result.length,
      truncated:
        notice === null
          ? undefined
          : {
              lastLineReturned: Number(notice[1]),
              totalLines: Number(notice[2]),
            },
      spooled: stub !== null,
      spoolPath: stub === null ? undefined : normalizePath(stub[1]),
    });
  }
  return reads;
}

/**
 * Whether a read targets a `.tool-results/` spool file — a deref that
 * pages previously omitted content back in, not a workspace slice.
 */
export function isSpoolDerefRead(read: FileReadCall): boolean {
  return read.path.includes(`/${TOOL_RESULT_DIR}/`);
}

/**
 * File reads that dereference a spooled result. Takes `fileReadCalls`
 * output (like `resumeOffsetHonored`) so callers walk the event stream
 * once and slice the same array many ways.
 */
export function spoolDerefReads(reads: FileReadCall[]): FileReadCall[] {
  return reads.filter(isSpoolDerefRead);
}

/**
 * File-read calls per distinct path. Feeds the "many small slices"
 * metric: a path read a dozen times in tiny windows reads very
 * differently from one read once. Takes `fileReadCalls` output.
 */
export function readsPerFile(reads: FileReadCall[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const read of reads) {
    counts.set(read.path, (counts.get(read.path) ?? 0) + 1);
  }
  return counts;
}

/**
 * Classify how the run changed files: `file_edit`/`host_file_edit` are
 * surgical edits; `file_write`/`host_file_write` are wholesale rewrites.
 *
 * When `preexistingPaths` is given, a `file_write` to a path not in it
 * (and not touched earlier in the stream) is a new-file creation, not a
 * rewrite, and is excluded. A second write to that same path IS a
 * rewrite. Without `preexistingPaths` every write counts — callers who
 * can't enumerate the initial workspace get the conservative reading.
 */
export function editStyle(
  events: AgentEvent[],
  opts?: { preexistingPaths?: string[] },
): EditStyle {
  const known =
    opts?.preexistingPaths === undefined
      ? undefined
      : new Set(opts.preexistingPaths.map(normalizePath));
  const surgicalEdits: string[] = [];
  const fullWrites: string[] = [];

  for (const call of readToolCalls(events)) {
    const path = readPath(call.input);
    if (path === undefined) continue;
    if (FILE_EDIT_TOOLS.has(call.name)) {
      surgicalEdits.push(path);
      known?.add(path);
    } else if (FILE_WRITE_TOOLS.has(call.name)) {
      if (known !== undefined && !known.has(path)) {
        known.add(path);
        continue;
      }
      fullWrites.push(path);
    }
  }

  return { surgicalEdits, fullWrites };
}

/**
 * The truncated reads that actually gate a paging metric — the shared
 * policy for which truncation notices demand a follow-up:
 *
 *   - Only DEFAULT-WINDOW truncations gate (no explicit `limit`). The
 *     assistant stamps the notice on ANY windowed read that stops before
 *     the file's last line, so a grep-guided `offset`/`limit` slice gets
 *     one too — that read chose its window and is a winning strategy,
 *     not an unfinished one.
 *   - A notice whose `lastLineReturned` already reaches `totalLines - 1`
 *     is complete. A file ending in a trailing newline makes the
 *     assistant's `split("\n")` count a phantom final "line", so
 *     canonical sequential paging ends with a notice demanding a
 *     redundant read of that empty line; tolerate it.
 */
export function defaultWindowTruncations(
  reads: FileReadCall[],
): FileReadCall[] {
  return reads.filter(
    (read) =>
      read.truncated !== undefined &&
      read.limit === undefined &&
      read.truncated.lastLineReturned < read.truncated.totalLines - 1,
  );
}

/**
 * Whether the run kept making forward progress after default-window
 * truncation, instead of re-reading from the top or abandoning the file.
 *
 * CONTRACT: a gating truncated read (see `defaultWindowTruncations`) is
 * "resumed" when a LATER non-empty read of the same path advances
 * coverage past the truncated window — either that later read is itself
 * truncated further into the file (`lastLineReturned` strictly greater),
 * or it carries no truncation notice at all (the notice appears on every
 * windowed read that stops short of the file's last line, so a
 * notice-free result ran through to the end). Judging progress from the
 * result's own truncation state rather than offset arithmetic
 * deliberately accepts defensive overlap resumes (an `offset` at or
 * before `lastLineReturned` that still reads new lines) and rejects a
 * re-read of the same top window, which truncates at the same line
 * again.
 *
 * Takes `fileReadCalls` output, which is in stream order.
 */
export function resumeOffsetHonored(reads: FileReadCall[]): boolean {
  const gating = new Set(defaultWindowTruncations(reads));
  return reads.every((read, index) => {
    const cut = read.truncated;
    if (cut === undefined || !gating.has(read)) return true;
    return reads
      .slice(index + 1)
      .some(
        (later) =>
          later.path === read.path &&
          later.resultChars > 0 &&
          (later.truncated === undefined ||
            later.truncated.lastLineReturned > cut.lastLineReturned),
      );
  });
}
