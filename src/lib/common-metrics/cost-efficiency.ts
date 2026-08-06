import {
  readUsage,
  type MetricInput,
  type MetricResult,
  type MetricScorer,
} from "../metrics";
import { scoreCostAgainstBaseline } from "../cost-score";

export interface CostMetricOptions {
  /**
   * Target assistant spend for a good run, in USD. A run at or under this
   * baseline scores 100%; past it the score decays as the inverse cost
   * ratio (see `scoreCostAgainstBaseline`). Each test picks a baseline
   * sized to what its task should reasonably cost.
   */
  baselineUsd: number;
  /** Metric name surfaced in the report. Defaults to `"assistant-cost-usd"`. */
  name?: string;
}

/**
 * Build a metric that scores the run's assistant cost as a 0-1 quality
 * fraction measuring how far the spend lands from a caller-supplied
 * baseline (see `scoreCostAgainstBaseline`). Reporting cost on the 0-1
 * axis keeps it composable with quality metrics instead of injecting raw
 * negative dollars into the aggregate.
 *
 * A `partial`/`missing` cost figure can't be scored against the baseline:
 * it reflects only the requests we managed to price, so an under-baseline
 * subtotal would falsely award full marks while the unmetered traffic
 * (e.g. main-agent inference routed off the parsed host) is exactly what
 * would push spend over budget. Those runs return `applicable: false` —
 * an unmeasurable dimension is not a failed one, so `scoreTotal` excludes
 * the metric rather than averaging in a zero that would make a blocked
 * metering environment look like bad agent behavior.
 *
 * Shared across tests so a single cost metric is parameterized per test
 * rather than reimplemented: see `timeline-recall`.
 */
export function makeCostMetric(options: CostMetricOptions): MetricScorer {
  const { baselineUsd } = options;
  const name = options.name ?? "assistant-cost-usd";

  return async function scoreAssistantCost(
    input: MetricInput,
  ): Promise<MetricResult> {
    const usage = await readUsage(input.runId);
    const costUsd = usage.totalCostUsd;

    const unreliable =
      usage.costStatus === "partial" || usage.costStatus === "missing";
    if (costUsd === undefined || unreliable) {
      const unpriced = usage.costDiagnostics?.length ?? 0;
      const reason =
        costUsd === undefined
          ? "Assistant cost unavailable from current usage artifacts; not scored until egress metering records priced usage."
          : `Assistant cost only partially metered (${unpriced} request${
              unpriced === 1 ? "" : "s"
            } unpriced); not scored because a partial subtotal ($${costUsd.toFixed(
              6,
            )}) can't be trusted against the baseline.`;
      return {
        name,
        score: 0,
        applicable: false,
        reason,
        metadata: {
          baselineUsd,
          costUsd,
          totalInputTokens: usage.totalInputTokens,
          totalOutputTokens: usage.totalOutputTokens,
          costStatus: usage.costStatus,
          unpricedRequests: unpriced,
        },
      };
    }

    const score = scoreCostAgainstBaseline(costUsd, baselineUsd);
    return {
      name,
      score,
      reason: `Assistant cost $${costUsd.toFixed(6)} against a $${baselineUsd.toFixed(
        2,
      )} baseline → ${(score * 100).toFixed(
        0,
      )}% (100% at or under the baseline; the score then decays as the inverse cost ratio).`,
      metadata: {
        baselineUsd,
        costUsd,
        totalInputTokens: usage.totalInputTokens,
        totalOutputTokens: usage.totalOutputTokens,
        costStatus: usage.costStatus,
      },
    };
  };
}
