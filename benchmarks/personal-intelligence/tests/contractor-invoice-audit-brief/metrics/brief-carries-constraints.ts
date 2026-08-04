import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readAssistantEvents } from "../../../../../src/lib/metrics";
import {
  constraintsCarried,
  readSubagentSpawns,
} from "../../../../../src/lib/common-metrics/subagent-activity";
import { BRIEFING_CONSTRAINTS } from "../constants";

const METRIC_NAME = "brief-carries-constraints";

/**
 * Of the three constraints that exist only in the conversation, how many
 * reached a subagent's briefing?
 *
 * A subagent gets its `objective` and the workspace — never the chat. So
 * a constraint left out of the briefing is one the delegate cannot
 * honour, and the files actively mislead: they say Halberd overcharged,
 * and that Bracken Labs did too. Both are out of scope for reasons only
 * the user stated.
 *
 * Scored as the fraction carried rather than all-or-nothing, because
 * partial briefing is a real and distinct behaviour — an assistant that
 * passes on the date cutoff but forgets the excluded vendor is closer to
 * right than one that passes on nothing, and the metadata names exactly
 * which one went missing.
 *
 * Not applicable when nothing was delegated: a run that did the work
 * itself never had a handoff to get wrong, and scoring that zero would
 * punish a legitimate choice.
 */
export default async function scoreBriefCarriesConstraints(
  input: MetricInput,
): Promise<MetricResult> {
  const events = await readAssistantEvents(input.runId);
  const spawns = readSubagentSpawns(events);

  if (spawns.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Not applicable: nothing was delegated, so there was no briefing to " +
        "carry the constraints. See work-delegated.",
      metadata: { spawnCount: 0 },
    };
  }

  const { carried, missing } = constraintsCarried(spawns, BRIEFING_CONSTRAINTS);
  const score = carried.length / BRIEFING_CONSTRAINTS.length;
  return {
    name: METRIC_NAME,
    score,
    reason:
      missing.length === 0
        ? `All ${carried.length} conversation-only constraints reached the briefing.`
        : `Briefing dropped ${missing.length} of ${BRIEFING_CONSTRAINTS.length} ` +
          `conversation-only constraint(s): ${missing.join(", ")}. The delegate ` +
          "could not have honoured them from the workspace alone.",
    metadata: {
      spawnCount: spawns.length,
      carried,
      missing,
      objectives: spawns.map((s) => s.objective),
    },
  };
}
