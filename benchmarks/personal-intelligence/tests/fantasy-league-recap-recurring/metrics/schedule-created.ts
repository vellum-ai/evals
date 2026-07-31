import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  firesOnTuesday,
  isRecurring,
  normalizeScheduleRecord,
  type ScheduleView,
} from "../../../../../src/lib/common-metrics/schedule-payload";
import {
  AssistantContainerUnavailableError,
  listAssistantSchedules,
} from "../../../../../src/lib/vellum-artifacts";

const METRIC_NAME = "schedule-created";

/**
 * Is there a durable recurring automation for the recap? Graded on the
 * best candidate schedule the assistant left behind: it must exist, be
 * enabled, actually recur (not a one-shot), and fire specifically on
 * Tuesdays (daily over-firing doesn't count as "every Tuesday").
 */
export default async function scoreScheduleCreated(
  input: MetricInput,
): Promise<MetricResult> {
  let views: ScheduleView[];
  try {
    views = (await listAssistantSchedules(input.runId))
      .map(normalizeScheduleRecord)
      .filter((view) => view.mode !== "wake");
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) throw err;
    return {
      name: METRIC_NAME,
      score: 0,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot grade schedule artifacts.",
    };
  }
  if (views.length === 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: "No schedule was created.",
    };
  }
  const quality = (v: ScheduleView) =>
    (v.enabled !== false ? 1 : 0) +
    (isRecurring(v) ? 2 : 0) +
    (firesOnTuesday(v) ? 4 : 0);
  const best = views.reduce((a, b) => (quality(b) > quality(a) ? b : a));
  const checks: Record<string, boolean> = {
    scheduleExists: true,
    enabled: best.enabled !== false,
    recurring: isRecurring(best),
    firesOnTuesday: firesOnTuesday(best),
  };
  const names = Object.keys(checks);
  const passed = names.filter((n) => checks[n]);
  return {
    name: METRIC_NAME,
    score: passed.length / names.length,
    reason:
      passed.length === names.length
        ? `Enabled weekly-Tuesday schedule "${best.name ?? best.id}" exists.`
        : `Best schedule "${best.name ?? best.id}" failed: ${names
            .filter((n) => !checks[n])
            .join(", ")}.`,
    metadata: {
      checks,
      scheduleCount: views.length,
      best: {
        id: best.id,
        name: best.name,
        mode: best.mode,
        expression: best.expression,
        syntax: best.syntax,
      },
    },
  };
}
