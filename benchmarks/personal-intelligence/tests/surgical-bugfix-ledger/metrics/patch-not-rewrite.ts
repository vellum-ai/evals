import type { AgentEvent } from "../../../../../src/lib/adapter";
import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import { editStyle } from "../../../../../src/lib/common-metrics/tool-activity";
import { STAGED_WORKSPACE_PATHS, TARGET_FILE } from "../constants";

const METRIC_NAME = "patch-not-rewrite";

/**
 * Staged paths in both spellings a file tool may use: workspace-relative
 * (as `setup.ts` declares them) and absolute under `/workspace/` (as the
 * assistant's file tools address them).
 */
const PREEXISTING_PATHS = STAGED_WORKSPACE_PATHS.flatMap((path) => [
  path,
  `/workspace/${path}`,
]);

/**
 * The pure half of the metric: given the run's events, did the fix land
 * as a targeted `file_edit` patch or a wholesale `file_write` rewrite?
 *
 *   1 — file modifications happened, all via `file_edit`; no staged
 *       (pre-existing) file was rewritten with `file_write`
 *   0 — any `file_write` rewrote a pre-existing file (new-file creations
 *       are excluded via `preexistingPaths`)
 *   applicable: false — no file modification at all; there is no edit
 *       style to grade (the metadata says so)
 *
 * Deliberately independent of whether the bug was actually fixed: a
 * wrong `file_edit` still scores 1 here (and 0 on `bug-fixed`), and a
 * fix-by-rewrite scores 0 here while `bug-fixed` can be 1 —
 * fixed-but-rewritten must be visible as exactly that.
 */
export function gradePatchNotRewrite(events: AgentEvent[]): MetricResult {
  const style = editStyle(events, { preexistingPaths: PREEXISTING_PATHS });
  const targetEdited = style.surgicalEdits.some((path) =>
    path.endsWith(TARGET_FILE),
  );
  const metadata = {
    surgicalEdits: style.surgicalEdits,
    fullWrites: style.fullWrites,
    targetEdited,
  };

  if (style.fullWrites.length > 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `A pre-existing file was rewritten wholesale via file_write: ${[...new Set(style.fullWrites)].join(", ")}.`,
      metadata,
    };
  }
  if (style.surgicalEdits.length > 0) {
    return {
      name: METRIC_NAME,
      score: 1,
      reason: targetEdited
        ? `All modifications were targeted file_edit patches, including ${TARGET_FILE}.`
        : "All modifications were targeted file_edit patches (though none touched the target file).",
      metadata,
    };
  }
  return {
    name: METRIC_NAME,
    score: 0,
    applicable: false,
    reason:
      "No file modification observed in the event stream — there is no edit style to grade.",
    metadata: { ...metadata, noEditObserved: true },
  };
}

/** See {@link gradePatchNotRewrite}. */
export default async function scorePatchNotRewrite(
  input: MetricInput,
): Promise<MetricResult> {
  return gradePatchNotRewrite(await readAssistantEvents(input.runId));
}
