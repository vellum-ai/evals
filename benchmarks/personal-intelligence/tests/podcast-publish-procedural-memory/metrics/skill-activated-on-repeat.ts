import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  readAssistantEvents,
  readProgressEvents,
} from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  listManagedSkills,
  type ManagedSkillInspection,
} from "../../../../../src/lib/vellum-artifacts";

const METRIC_NAME = "skill-activated-on-repeat";

/**
 * Assistant-authored managed skill. `author: "assistant"` is written only
 * by the retrospective path (in-conversation authoring writes "user");
 * meta-less directories don't count.
 */
function isAssistantAuthored(skill: ManagedSkillInspection): boolean {
  const meta = skill.installMeta;
  if (meta === undefined) return false;
  return (
    meta.author === "assistant" || meta.retrospectiveConversationId != null
  );
}

/**
 * ISO timestamp of the last completed between-phase directive, from the
 * run's progress log. Activation evidence must postdate it — the event
 * log and `lastUsedAt` are run-global, so without this boundary a skill
 * authored AND loaded during phase 1 would score as "activated on the
 * repeat" with phase 2 doing nothing.
 */
async function phaseBoundary(runId: string): Promise<string | undefined> {
  const events = await readProgressEvents(runId);
  const done = events.filter((e) => e.step === "phase" && e.status === "done");
  return done.length > 0 ? done[done.length - 1].emittedAt : undefined;
}

/**
 * The payoff link in the procedural-memory chain: given the retrospective
 * authored a skill between phases, did phase 2 actually USE it?
 *
 * The activation signal is a post-boundary `skill_load` tool call naming
 * the skill (events before the between-phase directives are excluded).
 * The daemon's `lastUsedAt` stamp corroborates in the reason text but is
 * day-granular, so it never substitutes for the load event.
 *
 *   1.0 — an authored skill shows activation evidence
 *   0.3 — a skill was authored but phase 2 never touched it (captured
 *         but not surfaced: an activation_hints / retrieval gap)
 *   0   — no authored skill exists (upstream capture failed; see
 *         proactive-skill-capture for that half of the story)
 */
export default async function scoreSkillActivatedOnRepeat(
  input: MetricInput,
): Promise<MetricResult> {
  let skills: ManagedSkillInspection[];
  try {
    skills = await listManagedSkills(input.runId);
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) throw err;
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot grade skill artifacts.",
    };
  }
  const authored = skills.filter(isAssistantAuthored);
  if (authored.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "No assistant-authored skill exists, so there was nothing to activate.",
    };
  }

  const boundary = await phaseBoundary(input.runId);
  const events = (await readAssistantEvents(input.runId)).filter(
    (event) =>
      boundary === undefined ||
      (typeof event.emittedAt === "string" && event.emittedAt >= boundary),
  );
  const skillLoadedInEvents = (skillId: string): boolean =>
    events.some((event) => {
      const message = event.message as Record<string, unknown> | undefined;
      if (message === undefined) return false;
      if (
        typeof message.type !== "string" ||
        !message.type.includes("tool_use")
      ) {
        return false;
      }
      if (message.toolName !== "skill_load") return false;
      return JSON.stringify(message.input ?? {}).includes(skillId);
    });

  for (const skill of authored) {
    const usageStamp =
      typeof skill.installMeta?.lastUsedAt === "string" &&
      skill.installMeta.lastUsedAt !== "";
    const loadEvidence = skillLoadedInEvents(skill.id);
    // `lastUsedAt` alone is day-granular and cannot be attributed to a
    // phase, so it corroborates but never substitutes for a
    // post-boundary skill_load event.
    if (loadEvidence) {
      return {
        name: METRIC_NAME,
        score: 1,
        reason:
          `Authored skill "${skill.id}" was activated on the repeat: ` +
          (loadEvidence && usageStamp
            ? "skill_load call observed and lastUsedAt stamped."
            : loadEvidence
              ? "skill_load call observed in the run's events."
              : "lastUsedAt usage stamp written by the daemon."),
        metadata: {
          skillId: skill.id,
          skillLoadObserved: loadEvidence,
          lastUsedAt: skill.installMeta?.lastUsedAt ?? null,
        },
      };
    }
  }
  return {
    name: METRIC_NAME,
    score: 0.3,
    reason:
      `A skill was authored (${authored.map((s) => s.id).join(", ")}) but phase 2 ` +
      "never loaded it — captured, but not surfaced when the chore repeated.",
    metadata: {
      authoredSkillIds: authored.map((s) => s.id),
    },
  };
}
