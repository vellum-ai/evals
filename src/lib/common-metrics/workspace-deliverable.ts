/**
 * Read the file a test asked the assistant to produce, and turn every
 * way that can fail into a scored result rather than a thrown one.
 *
 * Five metrics hand-rolled this and all five got it wrong the same way:
 *
 *   let memo: string;
 *   try { memo = await readAssistantWorkspaceFile(runId, path); }
 *   catch { return { score: 0, reason: "never written" }; }
 *
 * `readAssistantWorkspaceFile` does not throw when the file is missing —
 * it RETURNS `undefined` (a non-zero `cat` exit), and reserves throwing
 * for the container being gone. So the "never written" branch was dead
 * code, `memo` was `undefined`, and the next `.includes()` threw a
 * TypeError.
 *
 * That mattered more than it looks. `runMetrics` awaits a `Promise.all`,
 * so one metric throwing rejects the whole batch and fails the run —
 * meaning the single most interesting outcome, an assistant that never
 * produced the deliverable, was also the one outcome that destroyed the
 * other metrics' scores instead of recording a legible zero.
 *
 * None of it was caught by `tsc`, because `tsconfig.json` included
 * `src/**` and `benchmarks/*​/src/**` but never the per-test `metrics/`
 * directories. The scoring logic was the only unchecked code in the
 * repo. That is fixed alongside this file.
 */

import type { MetricResult } from "../metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../vellum-artifacts";

export type DeliverableRead =
  /** The file was there. */
  | { ok: true; content: string }
  /** It was not, and here is the zero to return verbatim. */
  | { ok: false; result: MetricResult };

export interface DeliverableOptions {
  /**
   * What to call the file when explaining a zero, e.g. "memo". Defaults
   * to "deliverable". The path is always named too, so this is only for
   * reading fluency.
   */
  noun?: string;
}

/**
 * Fetch `path` from the assistant's workspace for `metricName`.
 *
 * Returns `{ ok: true, content }` when the file exists, and otherwise a
 * ready-made zero distinguishing the two failures that mean different
 * things: a species with no inspectable container (the metric cannot be
 * graded at all) versus a deliverable that was never written (it can,
 * and the answer is zero).
 */
export async function readDeliverable(
  metricName: string,
  runId: string,
  path: string,
  options: DeliverableOptions = {},
): Promise<DeliverableRead> {
  const noun = options.noun ?? "deliverable";
  let content: string | undefined;
  try {
    content = await readAssistantWorkspaceFile(runId, path);
  } catch (err) {
    if (err instanceof AssistantContainerUnavailableError) {
      return {
        ok: false,
        result: {
          name: metricName,
          score: 0,
          reason: `Assistant container not inspectable (non-vellum species?); cannot grade the ${noun}.`,
          metadata: { deliverablePath: path, containerUnavailable: true },
        },
      };
    }
    // Anything else — a docker hiccup, a malformed runId — is still a
    // zero rather than a throw, so one unreadable file cannot take the
    // run's other metrics down with it.
    return {
      ok: false,
      result: {
        name: metricName,
        score: 0,
        reason: `Could not read ${path}: ${err instanceof Error ? err.message : String(err)}`,
        metadata: { deliverablePath: path, readError: true },
      },
    };
  }

  if (content === undefined) {
    return {
      ok: false,
      result: {
        name: metricName,
        score: 0,
        reason: `No ${noun} at ${path} — the deliverable was never written.`,
        metadata: { deliverablePath: path, deliverableExists: false },
      },
    };
  }

  return { ok: true, content };
}
