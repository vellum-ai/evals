import { readFileSync } from "node:fs";
import { join } from "node:path";

import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  listManagedSkills,
  type ManagedSkillInspection,
} from "../../../../../src/lib/vellum-artifacts";
import { containsScriptInvocation } from "../../../../../src/lib/common-metrics/script-reuse";
import { SCRIPT_FILENAME } from "../constants";

const METRIC_NAME = "proactive-skill-capture";

/** The proven pipeline, byte-for-byte as staged into the workspace. */
const FIXTURE_SCRIPT = readFileSync(
  join(import.meta.dir, "..", "assets", "build_shownotes.ts"),
  "utf8",
);

/**
 * A skill captured WITHOUT the user asking. The product provides the
 * exact discriminator: `scaffold_managed_skill` writes `author:
 * "assistant"` (plus `retrospectiveConversationId`) only on the
 * retrospective path; in-conversation authoring — even the consented
 * "sure, whatever's easiest" kind this SPEC allows — writes `author:
 * "user"` and must NOT count as proactive. Meta-less directories don't
 * count either.
 */
function isProactivelyAuthored(skill: ManagedSkillInspection): boolean {
  const meta = skill.installMeta;
  if (meta === undefined) return false;
  return (
    meta.author === "assistant" || meta.retrospectiveConversationId != null
  );
}

/**
 * The "this just happens" half of procedural memory: the SPEC guarantees
 * the simulated user never asks for a skill, automation, or anything
 * durable — so any assistant-authored skill found here was captured
 * unprompted.
 *
 *   1.0  — an unprompted skill embeds a byte-identical copy of the
 *          proven script, or its body invokes it
 *   0.25 — an unprompted skill exists but re-derives the procedure
 *          (captured the habit, lost the fidelity)
 *   0    — nothing was captured; the procedure lives and dies with this
 *          conversation
 *
 * A zero from a stock profile is an informative baseline, not a bug —
 * this metric exists to measure the lift from proactive-learning
 * machinery (e.g. retrospective skill authoring, memory plugins).
 */
export default async function scoreProactiveSkillCapture(
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
  const authored = skills.filter(isProactivelyAuthored);
  if (authored.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "No skill was captured unprompted — the procedure lives and dies with this conversation.",
      metadata: { managedSkillIds: skills.map((s) => s.id) },
    };
  }

  const normalized = FIXTURE_SCRIPT.trim();
  for (const skill of authored) {
    const embeddedCopy = skill.files.find(
      (f) => f.content.trim() === normalized,
    );
    const referencesScript = containsScriptInvocation(
      skill.skillMd ?? "",
      SCRIPT_FILENAME,
    );
    if (embeddedCopy !== undefined || referencesScript) {
      return {
        name: METRIC_NAME,
        score: 1,
        reason:
          `Unprompted, skill "${skill.id}" was captured and it ` +
          (embeddedCopy !== undefined
            ? `embeds a byte-identical copy of ${SCRIPT_FILENAME} (${embeddedCopy.path}).`
            : `invokes ${SCRIPT_FILENAME} from its body.`),
        metadata: {
          skillId: skill.id,
          embeddedCopyPath: embeddedCopy?.path ?? null,
          bodyReferencesScript: referencesScript,
          retrospectiveConversationId:
            skill.installMeta?.retrospectiveConversationId ?? null,
        },
      };
    }
  }
  return {
    name: METRIC_NAME,
    score: 0.25,
    reason:
      `A skill was captured unprompted (${authored.map((s) => s.id).join(", ")}) ` +
      `but it neither copies nor invokes ${SCRIPT_FILENAME} — the habit was kept, the fidelity lost.`,
    metadata: {
      authoredSkillIds: authored.map((s) => s.id),
      companionFiles: authored.flatMap((s) => s.files.map((f) => f.path)),
    },
  };
}
