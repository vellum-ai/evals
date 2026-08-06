import { describe, expect, test } from "bun:test";

import { makeCostMetric } from "../common-metrics/cost-efficiency";
import { ensureRunArtifacts, writeUsage, type UsageSummary } from "../metrics";

async function freshRunWithUsage(
  name: string,
  usage: UsageSummary,
): Promise<string> {
  const runId = `test-cost-efficiency-${name}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  await ensureRunArtifacts(runId);
  await writeUsage(runId, usage);
  return runId;
}

describe("makeCostMetric", () => {
  test("scores 1 for a fully priced run at or under the baseline", async () => {
    // GIVEN a metric baselined to five cents
    const score = makeCostMetric({ baselineUsd: 0.05 });
    // AND a fully priced run that spent under the baseline
    const runId = await freshRunWithUsage("under", {
      requests: [],
      totalInputTokens: 1_200,
      totalOutputTokens: 300,
      totalCostUsd: 0.03,
      costStatus: "ok",
    });

    // WHEN the metric scores the run
    const result = await score({ runId });

    // THEN an under-baseline spend earns full marks and stays applicable
    expect(result.name).toBe("assistant-cost-usd");
    expect(result.score).toBe(1);
    expect(result.applicable).toBeUndefined();
    expect(result.metadata).toEqual({
      baselineUsd: 0.05,
      costUsd: 0.03,
      totalInputTokens: 1_200,
      totalOutputTokens: 300,
      costStatus: "ok",
    });
  });

  test("decays hyperbolically as the inverse cost ratio past the baseline", async () => {
    // GIVEN a metric baselined to five cents
    const score = makeCostMetric({ baselineUsd: 0.05 });
    // AND a fully priced run that spent 4x the baseline
    const runId = await freshRunWithUsage("over", {
      requests: [],
      totalCostUsd: 0.2,
      costStatus: "ok",
    });

    // WHEN the metric scores the run
    const result = await score({ runId });

    // THEN 4x the baseline scores min(1, 0.05 / 0.20) = 25%
    expect(result.score).toBeCloseTo(0.25, 5);
  });

  test("partial cost metering yields applicable: false, not a zero score", async () => {
    // GIVEN a metric baselined to five cents
    const score = makeCostMetric({ baselineUsd: 0.05 });
    // AND a run whose subtotal is under baseline but only partially metered
    const runId = await freshRunWithUsage("partial", {
      requests: [],
      totalCostUsd: 0.01,
      costStatus: "partial",
      costDiagnostics: [
        { requestIndex: 0, reason: "unpriced_model", model: "mystery-model" },
        { requestIndex: 2, reason: "missing_tokens" },
      ],
    });

    // WHEN the metric scores the run
    const result = await score({ runId });

    // THEN the untrustworthy subtotal is not scored — the metric is
    // inapplicable so scoreTotal excludes it rather than averaging a 0
    expect(result.applicable).toBe(false);
    expect(result.reason).toContain("partially metered (2 requests unpriced)");
    expect(result.metadata?.costStatus).toBe("partial");
    expect(result.metadata?.unpricedRequests).toBe(2);
  });

  test("missing cost metering yields applicable: false with an explanatory reason", async () => {
    // GIVEN a metric baselined to five cents
    const score = makeCostMetric({ baselineUsd: 0.05 });
    // AND a run where no request could be priced at all
    const runId = await freshRunWithUsage("missing", {
      requests: [],
      costStatus: "missing",
    });

    // WHEN the metric scores the run
    const result = await score({ runId });

    // THEN the run is inapplicable and says why
    expect(result.applicable).toBe(false);
    expect(result.reason).toContain("Assistant cost unavailable");
    expect(result.metadata?.costStatus).toBe("missing");
  });

  test("uses a caller-supplied metric name", async () => {
    // GIVEN a metric built with a custom name
    const score = makeCostMetric({ baselineUsd: 0.05, name: "ingest-cost" });
    // AND a fully priced run
    const runId = await freshRunWithUsage("named", {
      requests: [],
      totalCostUsd: 0.05,
      costStatus: "ok",
    });

    // WHEN the metric scores the run
    const result = await score({ runId });

    // THEN the result carries the custom name
    expect(result.name).toBe("ingest-cost");
  });
});
