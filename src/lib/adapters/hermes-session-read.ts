import { type CommandRunner } from "../runtime/command-runner";
import { HERMES_RUNTIME_USER, HERMES_STATE_DB_PATH } from "./hermes-seed";

/**
 * Hermes turn read-back — pulls the structured message rows a completed
 * `hermes -z` one-shot wrote into the container's `state.db`, so the
 * report can render the turn's intermediate thinking and tool calls
 * instead of just the final answer text.
 *
 * ## Why read the DB at all
 *
 * `hermes -z` prints only the final assistant text to stdout (by design —
 * "no banner, no spinner, no tool previews"). The reasoning the model did
 * and the tools it called are not on stdout, but Hermes *does* persist
 * them: every one-shot creates a fresh `sessions` row and one `messages`
 * row per turn part (the user prompt, each assistant step with its
 * `reasoning_content`/`tool_calls`, and one row per `tool` result). Reading
 * that session back after the turn is the only way to recover the
 * intermediate parts for the transcript view.
 *
 * ## Which session
 *
 * Each one-shot writes a brand-new session, so the turn's session is simply
 * the most recently started one. The seed step (`seed-conversation`) writes
 * an *older* session, and turns within a run are sequential in a dedicated
 * container, so "newest session started at/after the turn began" identifies
 * this turn's rows unambiguously. The `since` epoch guard means a turn that
 * died before persisting a session (e.g. a provider error) reads back
 * nothing and the caller falls back to the plain single-event path rather
 * than mis-attributing the seed session's rows to the failed turn.
 *
 * ## Read-only + best-effort
 *
 * The probe connects read-only via a `file:?mode=ro` URI so it can never
 * create `state.db` as root (the same ownership trap the seed helper
 * guards against — see hermes-seed.ts). Any failure here is non-fatal:
 * `readHermesTurnSession` resolves to `undefined` and the turn still
 * produces its final-answer event, because enrichment must never be able
 * to break a turn that otherwise succeeded.
 *
 * @see ./hermes-seed.ts  state.db schema + ownership discipline.
 */

/** A single `messages` row, narrowed to the fields the transcript needs. */
export interface HermesSessionMessage {
  /** "user" | "assistant" | "tool" (other roles are ignored downstream). */
  role: string;
  /** Message text. Empty string on a pure tool-call assistant step. */
  content: string | null;
  /** For a `tool` row, the id of the call it answers. */
  toolCallId: string | null;
  /** For an assistant step, the JSON-encoded tool-call array (or null). */
  toolCalls: string | null;
  /** For a `tool` row, the tool that produced it. */
  toolName: string | null;
  /** Wall-clock epoch seconds (float) the row was written. */
  timestamp: number;
  /** "tool_calls" mid-turn, "stop" on the final answer step. */
  finishReason: string | null;
  /** The step's chain-of-thought, when the model emitted one. */
  reasoningContent: string | null;
}

/**
 * Inline Python read of the turn's session. Reads the newest session row
 * started at/after `since_epoch`, then its messages in turn order, and
 * prints `{session_id, messages: [...]}` as a single JSON line. Mirrors
 * the seed helper's `python3 -c` + stdin-JSON channel split so message
 * content never has to be shell-escaped.
 */
const READ_PYTHON_SCRIPT = `
import json, sqlite3, sys

payload = json.load(sys.stdin)
db_path = payload["db_path"]
since_epoch = payload["since_epoch"]

# Read-only file: URI so this probe can never create state.db as root.
conn = sqlite3.connect("file:" + db_path + "?mode=ro", uri=True, timeout=5)
try:
    row = conn.execute(
        "SELECT id FROM sessions WHERE started_at >= ? "
        "ORDER BY started_at DESC, rowid DESC LIMIT 1",
        (since_epoch,),
    ).fetchone()
    if row is None:
        print(json.dumps({"session_id": None, "messages": []}))
        sys.exit(0)
    session_id = row[0]
    cols = [
        "role", "content", "tool_call_id", "tool_calls",
        "tool_name", "timestamp", "finish_reason", "reasoning_content",
    ]
    messages = []
    for r in conn.execute(
        "SELECT role, content, tool_call_id, tool_calls, tool_name, "
        "timestamp, finish_reason, reasoning_content "
        "FROM messages WHERE session_id = ? ORDER BY timestamp, id",
        (session_id,),
    ):
        messages.append(dict(zip(cols, r)))
    print(json.dumps({"session_id": session_id, "messages": messages}))
finally:
    conn.close()
`.trim();

interface RawSessionMessage {
  role?: unknown;
  content?: unknown;
  tool_call_id?: unknown;
  tool_calls?: unknown;
  tool_name?: unknown;
  timestamp?: unknown;
  finish_reason?: unknown;
  reasoning_content?: unknown;
}

function asStringOrNull(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Coerce one raw row dict into a {@link HermesSessionMessage}. Returns
 * `undefined` for a row with no usable `role`/`timestamp` so a single
 * malformed row can't poison the whole read.
 */
function coerceRow(raw: RawSessionMessage): HermesSessionMessage | undefined {
  if (typeof raw.role !== "string") return undefined;
  if (typeof raw.timestamp !== "number" || !Number.isFinite(raw.timestamp)) {
    return undefined;
  }
  return {
    role: raw.role,
    content: asStringOrNull(raw.content),
    toolCallId: asStringOrNull(raw.tool_call_id),
    toolCalls: asStringOrNull(raw.tool_calls),
    toolName: asStringOrNull(raw.tool_name),
    timestamp: raw.timestamp,
    finishReason: asStringOrNull(raw.finish_reason),
    reasoningContent: asStringOrNull(raw.reasoning_content),
  };
}

/**
 * Parse the read script's stdout into typed rows. Exported so the wiring
 * and tests share one parser. Returns `undefined` when the payload is
 * unparseable or carries no session, so the caller treats it the same as
 * a turn that produced no readable intermediate parts.
 */
export function parseHermesSessionRead(
  stdout: string,
): HermesSessionMessage[] | undefined {
  const line = stdout.trim();
  if (line.length === 0) return undefined;
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const messages = (parsed as { messages?: unknown }).messages;
  if (!Array.isArray(messages)) return undefined;
  const rows: HermesSessionMessage[] = [];
  for (const entry of messages) {
    if (typeof entry !== "object" || entry === null) continue;
    const row = coerceRow(entry as RawSessionMessage);
    if (row) rows.push(row);
  }
  return rows;
}

export interface ReadHermesTurnSessionInput {
  runner: CommandRunner;
  containerName: string;
  /**
   * Epoch seconds the turn began. Only sessions started at/after this are
   * considered, so a failed turn never reads back the older seed session.
   */
  sinceEpoch: number;
  /** Override the container path to the state DB (test seam). */
  stateDbPath?: string;
  /** Override the in-container python3 binary path (test seam). */
  pythonBinary?: string;
  /** Override the user the read exec runs as (test seam). */
  runtimeUser?: string;
}

/**
 * Read back the just-completed turn's session rows. Best-effort: resolves
 * to `undefined` on any docker/exec/parse failure so a successful turn is
 * never failed by the enrichment read.
 */
export async function readHermesTurnSession({
  runner,
  containerName,
  sinceEpoch,
  stateDbPath = HERMES_STATE_DB_PATH,
  pythonBinary = "python3",
  runtimeUser = HERMES_RUNTIME_USER,
}: ReadHermesTurnSessionInput): Promise<HermesSessionMessage[] | undefined> {
  const payload = JSON.stringify({
    db_path: stateDbPath,
    since_epoch: sinceEpoch,
  });
  try {
    const result = await runner.run(
      "docker",
      [
        "exec",
        "-i",
        "--user",
        runtimeUser,
        containerName,
        pythonBinary,
        "-c",
        READ_PYTHON_SCRIPT,
      ],
      { stdin: payload },
    );
    if (result.exitCode !== 0) return undefined;
    return parseHermesSessionRead(result.stdout);
  } catch {
    return undefined;
  }
}
