import {
  readAssistantEvents,
  type MetricInput,
  type MetricResult,
} from "../../../../../src/lib/metrics";
import {
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
 * The pure half of the metric: did the run use the truncation notice's
 * resume offset to page through the pricing file?
 *
 * Only applicable when a read of the file actually hit the notice. A run
 * that never read the file, or that dodged truncation with a large
 * explicit limit up front (or a search-first strategy), gives the notice
 * nothing to prove — that strategy is recorded in metadata instead of
 * scored.
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
  const limits = bigReads
    .map((read) => read.limit)
    .filter((limit): limit is number => limit !== undefined);
  if (truncated.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason: `No read of ${BIG_FILE_PATH} was truncated — the run never saw a resume offset to honor (e.g. an explicit limit up front).`,
      metadata: {
        bigFileReads: bigReads.length,
        truncatedReads: 0,
        explicitLimits: limits,
        offsets: bigReads.map((read) => read.offset ?? null),
      },
    };
  }

  const honored = resumeOffsetHonored(bigReads);
  return {
    name: METRIC_NAME,
    score: honored ? 1 : 0,
    reason: honored
      ? `Every truncated read of ${BIG_FILE_PATH} was followed by a read resuming at (or past) the notice's offset.`
      : `A truncated read of ${BIG_FILE_PATH} was re-read from the top or abandoned instead of resuming at the notice's offset.`,
    metadata: {
      bigFileReads: bigReads.length,
      truncatedReads: truncated.length,
      totalLinesObserved: truncated[0].truncated?.totalLines,
      offsets: bigReads.map((read) => read.offset ?? null),
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
