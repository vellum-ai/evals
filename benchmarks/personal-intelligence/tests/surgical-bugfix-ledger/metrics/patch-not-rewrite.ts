import type { AgentEvent } from "../../../../../src/lib/adapter";
import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import { editStyle } from "../../../../../src/lib/common-metrics/tool-activity";
import { STAGED_WORKSPACE_PATHS, TARGET_FILE } from "../constants";

const METRIC_NAME = "patch-not-rewrite";

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
  // `editStyle` canonicalizes path identity (workspace-relative, no
  // leading `./`), so the staged paths need only their declared spelling
  // — a write via `/workspace/src/ledger.ts` or `./src/ledger.ts` still
  // matches.
  const style = editStyle(events, {
    preexistingPaths: STAGED_WORKSPACE_PATHS,
  });
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
