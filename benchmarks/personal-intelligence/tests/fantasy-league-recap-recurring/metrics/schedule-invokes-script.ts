import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  classifyScriptLeverage,
  extractWorkspaceScriptPaths,
  normalizeScheduleRecord,
  type ScheduleView,
} from "../../../../../src/lib/common-metrics/schedule-payload";
import {
  AssistantContainerUnavailableError,
  listAssistantSchedules,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import { SCRIPT_FILENAME } from "../constants";

const METRIC_NAME = "schedule-invokes-script";

/** Leverage tiers, extended with one level of wrapper indirection. */
type Leverage =
  | "script-mode"
  | "script-mode-indirect"
  | "script-mode-frozen"
  | "execute-references"
  | "none";

const LEVERAGE_SCORE: Record<Leverage, number> = {
  // Script-mode: the recurring job shells straight to the proven script —
  // deterministic output, no agent turn to drift or re-derive.
  "script-mode": 1,
  // Script-mode via a wrapper the agent wrote (e.g. a .sh that resolves
  // the latest week, then invokes the proven script). Equally full
  // leverage — the first smoke run showed this shape scored as none.
  "script-mode-indirect": 1,
  // Script-mode, but with the CURRENT week hardcoded as a literal
  // argument: `bun scripts/weekly_recap.ts 8` firing every Tuesday
  // forever regenerates week 8. Leverages the script but freezes it.
  "script-mode-frozen": 0.75,
  // Execute-mode prompt that names the script: each firing spends an agent
  // turn, but it's steered toward reuse instead of re-figuring the chore.
  "execute-references": 0.5,
  // Freeform payload: every Tuesday re-derives the procedure from prose.
  none: 0,
};

/**
 * Direct classification, upgraded to `script-mode-indirect` when a
 * script-mode command references workspace files whose *content* invokes
 * the proven script (one level deep, wrapper files only).
 */
async function classifyWithIndirection(
  runId: string,
  view: ScheduleView,
): Promise<Leverage> {
  const direct = classifyScriptLeverage(view, SCRIPT_FILENAME);
  if (direct === "script-mode") {
    // Downgrade a payload frozen on the current week: the user asked for
    // "every Tuesday" plus a week-8 run now, so a hardcoded literal 8 is
    // the most likely wrong-but-plausible schedule.
    const frozen = new RegExp(
      `${SCRIPT_FILENAME.replace(/\./g, "\\.")}["']?\\s+["']?8(?!\\d)`,
    ).test(view.script ?? "");
    return frozen ? "script-mode-frozen" : "script-mode";
  }
  if (direct !== "none" || view.mode !== "script") return direct;
  for (const path of extractWorkspaceScriptPaths(view.script ?? "")) {
    const content = await readAssistantWorkspaceFile(runId, path);
    if (content?.includes(SCRIPT_FILENAME)) return "script-mode-indirect";
  }
  return "none";
}

/**
 * The core question of this test: does the recurring automation's payload
 * leverage `weekly_recap.ts`? Graded on the most script-leveraging
 * schedule found (schedule existence itself is `schedule-created`'s job).
 */
export default async function scoreScheduleInvokesScript(
  input: MetricInput,
): Promise<MetricResult> {
  let classified: { view: ScheduleView; leverage: Leverage }[];
  try {
    const views = (await listAssistantSchedules(input.runId))
      .map(normalizeScheduleRecord)
      .filter((view) => view.mode !== "wake");
    classified = await Promise.all(
      views.map(async (view) => ({
        view,
        leverage: await classifyWithIndirection(input.runId, view),
      })),
    );
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) throw err;
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot grade schedule artifacts.",
    };
  }
  if (classified.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "No schedule was created, so nothing invokes the script.",
    };
  }
  const { view: best, leverage } = classified.reduce((a, b) =>
    LEVERAGE_SCORE[b.leverage] > LEVERAGE_SCORE[a.leverage] ? b : a,
  );
  const reasons: Record<Leverage, string> = {
    "script-mode": `Schedule "${best.name ?? best.id}" runs ${SCRIPT_FILENAME} directly in script mode.`,
    "script-mode-frozen": `Schedule "${best.name ?? best.id}" runs ${SCRIPT_FILENAME} but hardcodes week 8 — it would regenerate the same week forever.`,
    "script-mode-indirect": `Schedule "${best.name ?? best.id}" runs a wrapper that invokes ${SCRIPT_FILENAME}.`,
    "execute-references": `Schedule "${best.name ?? best.id}" is an agent prompt, but it names ${SCRIPT_FILENAME}.`,
    none: `Schedule payload never invokes ${SCRIPT_FILENAME}, directly or via a wrapper — each firing re-derives the recap.`,
  };
  return {
    name: METRIC_NAME,
    score: LEVERAGE_SCORE[leverage],
    reason: reasons[leverage],
    metadata: {
      leverage,
      best: {
        id: best.id,
        name: best.name,
        mode: best.mode,
        script: best.script,
        message: best.message,
      },
    },
  };
}
