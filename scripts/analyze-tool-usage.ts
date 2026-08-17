/**
 * analyze-tool-usage: a standalone investigation over an `evals export`
 * JSONL, NOT part of the harness.
 *
 * The harness records neutrally (`src/lib/tool-usage.ts`) and stays
 * species-agnostic. Everything below is interpretation, and is allowed to
 * be Vellum-aware: it reads shell command lines to judge whether the run
 * read or edited files through the terminal instead of the file tools,
 * and it reads subagent spawns to spot delegation that hid the work from
 * the parent's stream.
 *
 * Usage:
 *   bun scripts/analyze-tool-usage.ts <export.jsonl> [--runs-dir .runs]
 *
 * The export rows carry the neutral summary and the runId. The
 * interpretation needs the full event stream, read from
 * `<runs-dir>/<runId>/assistant-events.json`, so it only runs where those
 * artifacts are on disk; without them the neutral summary is still
 * printed.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import type { AgentEvent } from "../src/lib/adapter";
import { readSubagentSpawns } from "../src/lib/common-metrics/subagent-activity";
import { readToolCalls } from "../src/lib/common-metrics/tool-activity";
import type { ToolUsageSummary } from "../src/lib/tool-usage";

// ---------------------------------------------------------------------------
// Terminal command classification
// ---------------------------------------------------------------------------

/** What a shell command line did to files, as far as its text shows. */
export interface TerminalClassification {
  /** Pulled file content into the transcript (`cat`, `head`, `sed -n`, …). */
  readsFiles: boolean;
  /** Changed a file in place or by redirection (`sed -i`, `tee`, `>`, `>>`). */
  editsFiles: boolean;
}

/** Commands whose whole job is printing a file's content. */
const READER_COMMANDS = new Set(["cat", "head", "tail", "more", "less"]);

/** Shell operators that end one command and start the next. */
const SEGMENT_SPLIT = /\|\||&&|[|;\n]/;

/**
 * A redirection into a file: an optional fd, `>` or `>>`, and a target.
 * The target class excludes `&`, so fd duplications (`2>&1`, `>&2`) do
 * not match at all.
 */
const REDIRECT = /(\d?)>>?\s*([^\s|;&<>]+)/g;

/**
 * Drop single- and double-quoted spans so their contents cannot be read
 * as shell syntax: `echo "a > b"` writes nothing, and `sed -n '1,50p'`
 * carries a `p` that is a sed script, not a path.
 */
function stripQuoted(command: string): string {
  return command.replace(/'[^']*'/g, " ").replace(/"[^"]*"/g, " ");
}

/**
 * Whether a token looks like a file path rather than a flag, a flag's
 * numeric value, or a bare subcommand. Requires a slash or a filename
 * extension, which is what real command lines in these runs carry.
 */
function looksLikePath(token: string): boolean {
  if (token === "" || token.startsWith("-")) return false;
  if (/^\d+$/.test(token)) return false;
  return token.includes("/") || /\.[A-Za-z0-9]+$/.test(token);
}

/** The command name, with any directory prefix dropped (`/bin/cat` → `cat`). */
function commandName(token: string): string {
  const parts = token.split("/");
  return parts[parts.length - 1];
}

/**
 * Classify one shell command line.
 *
 * KNOWN LIMITS, accepted deliberately because this is a signal for a
 * human reader and not a gate:
 *   - quoted spans are dropped wholesale, so a quoted path
 *     (`cat "my notes.md"`) is invisible and a redirect into a quoted or
 *     variable target (`> "$OUT"`) is missed
 *   - no expansion of variables, aliases, command substitution, or
 *     process substitution
 *   - a heredoc body is treated as command text, so a path mentioned
 *     inside one can be read as an argument
 *   - `sed -i` counts as an edit only, never a read: it prints nothing
 *     back, so no file content enters the transcript
 *   - plain `sed 's/a/b/' file` (no `-i`) counts as a READ: sed without
 *     `-i` streams the file to stdout, which is exactly the "file content
 *     arrived through the terminal" case this looks for
 */
export function classifyTerminalCommand(
  command: string,
): TerminalClassification {
  let readsFiles = false;
  let editsFiles = false;

  for (const rawSegment of stripQuoted(command).split(SEGMENT_SPLIT)) {
    const segment = rawSegment.trim();
    if (segment === "") continue;

    for (const match of segment.matchAll(REDIRECT)) {
      const target = match[2];
      if (target === "/dev/null") continue;
      if (looksLikePath(target)) {
        editsFiles = true;
      }
    }

    // Redirect targets are not arguments to the command, so strip them
    // before reading the argument list (`cat > SKILL.md <<EOF` writes
    // SKILL.md, it does not read it).
    const tokens = segment
      .replace(REDIRECT, " ")
      .split(/\s+/)
      .filter((token) => token !== "");
    if (tokens.length === 0) continue;

    const name = commandName(tokens[0]);
    const args = tokens.slice(1);
    const hasPathArg = args.some(looksLikePath);

    if (name === "tee") {
      if (hasPathArg) editsFiles = true;
      continue;
    }
    if (READER_COMMANDS.has(name)) {
      if (hasPathArg) readsFiles = true;
      continue;
    }
    if (name === "sed") {
      const inPlace = args.some((arg) => arg === "-i" || arg.startsWith("-i"));
      if (inPlace) {
        editsFiles = true;
      } else if (hasPathArg) {
        readsFiles = true;
      }
      continue;
    }
    if (name === "awk") {
      if (hasPathArg) readsFiles = true;
      continue;
    }
  }

  return { readsFiles, editsFiles };
}

// ---------------------------------------------------------------------------
// Event-stream interpretation
// ---------------------------------------------------------------------------

const TERMINAL_TOOLS = new Set(["bash", "host_bash"]);
const FILE_TOOLS = new Set([
  "file_read",
  "host_file_read",
  "file_edit",
  "host_file_edit",
  "file_write",
  "host_file_write",
]);

/**
 * Local copy of the canonical path normalizer in
 * `src/lib/common-metrics/tool-activity.ts` (`normalizePath`, not
 * exported): forward slashes, no `/workspace/` prefix, no leading `./`,
 * so one file has one identity however a call spelled it.
 */
function normalizePath(path: string): string {
  let canonical = path.replace(/\\/g, "/").replace(/\/{2,}/g, "/");
  if (canonical.startsWith("/workspace/")) {
    canonical = canonical.slice("/workspace/".length);
  }
  while (canonical.startsWith("./")) {
    canonical = canonical.slice(2);
  }
  return canonical;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Distinct files the parent stream touched through the file tools, in
 * canonical form. The denominator for the delegation signal: a run that
 * spawned workers but touched at most one file itself did its reading
 * where this stream cannot see it.
 */
export function distinctFilePathsTouched(events: AgentEvent[]): string[] {
  const paths = new Set<string>();
  for (const call of readToolCalls(events)) {
    if (!FILE_TOOLS.has(call.name)) continue;
    const raw = readString(call.input.path) ?? readString(call.input.file_path);
    if (raw === undefined) continue;
    paths.add(normalizePath(raw));
  }
  return Array.from(paths).sort();
}

/** What the full event stream says beyond the neutral summary. */
interface EventAnalysis {
  terminalCommands: number;
  terminalReads: number;
  terminalEdits: number;
  distinctFilePaths: number;
  subagentSpawns: number;
  /** Spawned workers while touching at most one file in this stream. */
  subagentOveruse: boolean;
}

function analyzeEvents(events: AgentEvent[]): EventAnalysis {
  let terminalCommands = 0;
  let terminalReads = 0;
  let terminalEdits = 0;

  for (const call of readToolCalls(events)) {
    if (!TERMINAL_TOOLS.has(call.name)) continue;
    const command = readString(call.input.command);
    if (command === undefined) continue;
    terminalCommands += 1;
    const classified = classifyTerminalCommand(command);
    if (classified.readsFiles) terminalReads += 1;
    if (classified.editsFiles) terminalEdits += 1;
  }

  const distinctFilePaths = distinctFilePathsTouched(events).length;
  const subagentSpawns = readSubagentSpawns(events).length;
  return {
    terminalCommands,
    terminalReads,
    terminalEdits,
    distinctFilePaths,
    subagentSpawns,
    subagentOveruse: subagentSpawns > 0 && distinctFilePaths <= 1,
  };
}

// ---------------------------------------------------------------------------
// Export rows
// ---------------------------------------------------------------------------

interface ExecutionRow {
  sessionId: string;
  testId: string;
  profileId: string;
  runId: string;
  toolUsage?: ToolUsageSummary;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * The execution rows of a JSONL export, read leniently: a row missing the
 * fields this script prints is skipped rather than fatal, so an export
 * written before `toolUsage` existed still analyzes.
 */
function readExecutionRows(text: string): ExecutionRow[] {
  const rows: ExecutionRow[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const row = asRecord(parsed);
    if (row?.type !== "execution") continue;
    const run = asRecord(row.run);
    const runId = readString(run?.runId);
    if (runId === undefined) continue;
    rows.push({
      sessionId: readString(row.sessionId) ?? "unknown",
      testId: readString(row.testId) ?? "unknown",
      profileId: readString(row.profileId) ?? "unknown",
      runId,
      toolUsage: run?.toolUsage as ToolUsageSummary | undefined,
    });
  }
  return rows;
}

async function readRunEvents(
  runsDir: string,
  runId: string,
): Promise<AgentEvent[] | undefined> {
  const path = join(runsDir, runId, "assistant-events.json");
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(text);
    return Array.isArray(parsed) ? (parsed as AgentEvent[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function printToolUsage(usage: ToolUsageSummary | undefined): void {
  if (usage === undefined) {
    console.log("  tool usage: not in this export (row predates the field)");
    return;
  }
  if (usage.tools.length === 0) {
    console.log("  tool usage: no tool calls recorded");
    return;
  }
  console.log(`  tool usage: ${usage.totalCalls} call(s)`);
  for (const entry of usage.tools) {
    console.log(
      `    ${entry.tool}: ${entry.calls} call(s), ` +
        `in ${entry.inputChars} chars, out ${entry.resultChars} chars`,
    );
  }
}

function printAnalysis(analysis: EventAnalysis): void {
  console.log(
    `  terminal: ${analysis.terminalCommands} command(s), ` +
      `${analysis.terminalReads} read file(s), ${analysis.terminalEdits} edit file(s)`,
  );
  console.log(
    `  files touched via file tools: ${analysis.distinctFilePaths} distinct path(s)`,
  );
  console.log(`  subagent spawns: ${analysis.subagentSpawns}`);
  if (analysis.subagentOveruse) {
    console.log(
      "  SIGNAL subagent-overuse: spawned workers while touching " +
        `${analysis.distinctFilePaths} file(s) directly`,
    );
  }
}

interface CliArgs {
  exportPath: string;
  runsDir: string;
}

function parseArgs(argv: string[]): CliArgs | undefined {
  let exportPath: string | undefined;
  let runsDir = ".runs";
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--runs-dir") {
      const next = argv[i + 1];
      if (next === undefined) return undefined;
      runsDir = next;
      i += 1;
      continue;
    }
    if (arg.startsWith("--runs-dir=")) {
      runsDir = arg.slice("--runs-dir=".length);
      continue;
    }
    if (arg.startsWith("-")) return undefined;
    if (exportPath !== undefined) return undefined;
    exportPath = arg;
  }
  return exportPath === undefined ? undefined : { exportPath, runsDir };
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (args === undefined) {
    console.error(
      "usage: bun scripts/analyze-tool-usage.ts <export.jsonl> [--runs-dir .runs]",
    );
    return 1;
  }

  let text: string;
  try {
    text = await readFile(args.exportPath, "utf8");
  } catch (err) {
    console.error(
      `analyze-tool-usage: cannot read ${args.exportPath}: ${(err as Error).message}`,
    );
    return 1;
  }

  const rows = readExecutionRows(text);
  if (rows.length === 0) {
    console.log(`No execution rows in ${args.exportPath}.`);
    return 0;
  }

  let analyzed = 0;
  let missingEvents = 0;
  const totals = {
    terminalCommands: 0,
    terminalReads: 0,
    terminalEdits: 0,
    distinctFilePaths: 0,
    subagentSpawns: 0,
  };
  let overuseRuns = 0;
  let totalCalls = 0;

  for (const row of rows) {
    console.log("");
    console.log(`${row.testId} × ${row.profileId}`);
    console.log(`  session ${row.sessionId}, run ${row.runId}`);
    printToolUsage(row.toolUsage);
    totalCalls += row.toolUsage?.totalCalls ?? 0;

    const events = await readRunEvents(args.runsDir, row.runId);
    if (events === undefined) {
      missingEvents += 1;
      console.log(
        `  no ${join(args.runsDir, row.runId, "assistant-events.json")}: ` +
          "event-level analysis needs the local runs dir",
      );
      continue;
    }
    const analysis = analyzeEvents(events);
    analyzed += 1;
    totals.terminalCommands += analysis.terminalCommands;
    totals.terminalReads += analysis.terminalReads;
    totals.terminalEdits += analysis.terminalEdits;
    totals.distinctFilePaths += analysis.distinctFilePaths;
    totals.subagentSpawns += analysis.subagentSpawns;
    if (analysis.subagentOveruse) overuseRuns += 1;
    printAnalysis(analysis);
  }

  console.log("");
  console.log("aggregate");
  console.log(
    `  executions: ${rows.length} (${analyzed} with events, ${missingEvents} without)`,
  );
  console.log(`  tool calls recorded in the export: ${totalCalls}`);
  console.log(
    `  terminal commands: ${totals.terminalCommands} ` +
      `(${totals.terminalReads} reading files, ${totals.terminalEdits} editing files)`,
  );
  console.log(
    `  files touched via file tools: ${totals.distinctFilePaths} distinct path(s) summed over runs`,
  );
  console.log(
    `  subagent spawns: ${totals.subagentSpawns}, subagent-overuse runs: ${overuseRuns}`,
  );
  return 0;
}

if (import.meta.main) {
  process.exit(await main(process.argv.slice(2)));
}
