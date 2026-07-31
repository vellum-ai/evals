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

const METRIC_NAME = "skill-embeds-script";

/** The proven pipeline, byte-for-byte as staged into the workspace. */
const FIXTURE_SCRIPT = readFileSync(
  join(import.meta.dir, "..", "assets", "build_shownotes.ts"),
  "utf8",
);

/**
 * A skill authored during this run: `scaffold_managed_skill` writes
 * `install-meta.json` with `origin: "custom"` (its `author` field is
 * `"user"` for in-conversation authoring and `"assistant"` only on the
 * retrospective path), unlike catalog installs (`origin: "vellum"`).
 * Directories with no parseable meta are NOT counted — a stray folder
 * must not convert a true zero into partial credit.
 */
function isRunAuthored(skill: ManagedSkillInspection): boolean {
  const meta = skill.installMeta;
  if (meta === undefined) return false;
  return meta.origin === "custom" || meta.author === "assistant";
}

/**
 * The core question of this test: when the assistant captured the
 * publishing procedure as a skill, did it carry the proven script along —
 * a byte-identical companion copy, or a body that invokes the script at
 * its workspace path — instead of a prose recipe or a from-memory
 * rewrite?
 *
 *   1.0  — skill embeds an identical copy of the script, or its body
 *          invokes the original (by `{baseDir}` copy or workspace path)
 *   0.25 — a skill was saved, but the script was neither copied nor
 *          referenced (prose recipe / reimplementation: logic-drift risk)
 *   0    — no assistant-authored skill exists at all
 */
export default async function scoreSkillEmbedsScript(
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
  const authored = skills.filter(isRunAuthored);
  if (authored.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "No assistant-authored skill exists under /workspace/skills.",
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
          embeddedCopy !== undefined
            ? `Skill "${skill.id}" embeds a byte-identical copy of ${SCRIPT_FILENAME} (${embeddedCopy.path}).`
            : `Skill "${skill.id}" invokes ${SCRIPT_FILENAME} from its body.`,
        metadata: {
          skillId: skill.id,
          embeddedCopyPath: embeddedCopy?.path ?? null,
          bodyReferencesScript: referencesScript,
        },
      };
    }
  }
  return {
    name: METRIC_NAME,
    score: 0.25,
    reason:
      `A skill was saved (${authored.map((s) => s.id).join(", ")}) but it neither ` +
      `copies nor invokes ${SCRIPT_FILENAME} — the procedure was re-derived, risking logic drift.`,
    metadata: {
      authoredSkillIds: authored.map((s) => s.id),
      companionFiles: authored.flatMap((s) => s.files.map((f) => f.path)),
    },
  };
}
