import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import {
  defaultWindowTruncations,
  fileReadCalls,
  resumeOffsetHonored,
  type FileReadCall,
} from "../../../../../src/lib/common-metrics/tool-activity";
import { BIG_FILE_PATH } from "../constants";

const METRIC_NAME = "truncation-paging";

/** Reads land as container-absolute paths; match on the staged suffix. */
function isBigFileRead(read: FileReadCall): boolean {
  return read.path === BIG_FILE_PATH || read.path.endsWith(`/${BIG_FILE_PATH}`);
}

/**
 * The pure half of the metric: after a DEFAULT-WINDOW read of the
 * pricing file was truncated, did the run keep paging forward instead of
 * re-reading from the top or abandoning the file?
 *
 * CONTRACT (shared policy in `tool-activity.ts`): only default-window
 * truncations gate — the assistant stamps its notice on any windowed
 * read that stops short of the file's last line, so a grep-guided
 * explicit `offset`/`limit` slice earns a notice too, and that is a
 * winning strategy, not an unfinished one. A notice covering only the
 * trailing-newline phantom line is complete. A gating truncation is
 * resumed by any later read of the file that advances coverage past the
 * truncated window (overlap resumes included) — see
 * `resumeOffsetHonored`.
 *
 * Not applicable when no default-window read of the file was truncated
 * short of the end: the run never saw a resume offset it needed to
 * honor (never read the file, explicit-limit windows, search-first).
 * The observed strategy is recorded in metadata (`explicitLimits`,
 * `offsets`, truncation counts) instead of scored.
 */
export function gradeTruncationPaging(reads: FileReadCall[]): MetricResult {
  const bigReads = reads.filter(isBigFileRead);
  if (bigReads.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: `No file_read of ${BIG_FILE_PATH} was observed — nothing to page.`,
      metadata: { bigFileReads: 0 },
    };
  }

  const truncated = bigReads.filter((read) => read.truncated !== undefined);
  const gating = defaultWindowTruncations(bigReads);
  const strategyMetadata = {
    bigFileReads: bigReads.length,
    truncatedReads: truncated.length,
    gatingTruncatedReads: gating.length,
    explicitLimits: bigReads
      .map((read) => read.limit)
      .filter((limit): limit is number => limit !== undefined),
    offsets: bigReads.map((read) => read.offset ?? null),
  };

  if (gating.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: `No default-window read of ${BIG_FILE_PATH} was truncated short of the file's end — the run never saw a resume offset it needed to honor (explicit-limit windows and phantom-trailing-line notices don't gate).`,
      metadata: strategyMetadata,
    };
  }

  const honored = resumeOffsetHonored(bigReads);
  return {
    name: METRIC_NAME,
    score: honored ? 1 : 0,
    reason: honored
      ? `Every default-window truncated read of ${BIG_FILE_PATH} was followed by a read advancing coverage past the truncated window.`
      : `A default-window truncated read of ${BIG_FILE_PATH} was re-read from the top or abandoned instead of paging forward.`,
    metadata: {
      ...strategyMetadata,
      totalLinesObserved: truncated[0].truncated?.totalLines,
    },
  };
}

/** Did paging follow the truncation notice? See {@link gradeTruncationPaging}. */
export default async function scoreTruncationPaging(
  input: MetricInput,
): Promise<MetricResult> {
  const events = await readAssistantEvents(input.runId);
  return gradeTruncationPaging(fileReadCalls(events));
}
