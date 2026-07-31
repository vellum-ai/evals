import { describe, expect, test } from "bun:test";

import {
  buildCacheObservations,
  computeCacheMetrics,
  normalizeTokens,
  parseCacheMarkers,
} from "../cache-metrics";
import { PROMPT_CACHE_SCENARIOS, resolveScenario } from "../scenarios";

function anthropicRecord(input: {
  at: string;
  model?: string;
  inputTokens: number;
  cacheRead?: number;
  cacheWrite?: number;
  outputTokens?: number;
  statusCode?: number;
  requestBody?: string;
}): Record<string, unknown> {
  return {
    provider: "anthropic",
    model: input.model ?? "claude-sonnet-4-6",
    recorded_at: input.at,
    input_tokens: input.inputTokens,
    cache_read_input_tokens: input.cacheRead ?? 0,
    cache_creation_input_tokens: input.cacheWrite ?? 0,
    output_tokens: input.outputTokens ?? 10,
    status_code: input.statusCode ?? 200,
    request_path: "/v1/messages?beta=true",
    duration_ms: 1200,
    ...(input.requestBody === undefined
      ? {}
      : { request_body: input.requestBody }),
  };
}

function openaiRecord(input: {
  at: string;
  model?: string;
  inputTokens: number;
  cachedTokens?: number;
  cacheWriteTokens?: number;
}): Record<string, unknown> {
  return {
    provider: "openai",
    model: input.model ?? "gpt-5.6-luna",
    recorded_at: input.at,
    input_tokens: input.inputTokens,
    cache_read_input_tokens: input.cachedTokens ?? 0,
    cache_creation_input_tokens: input.cacheWriteTokens ?? 0,
    output_tokens: 12,
    status_code: 200,
    request_path: "/v1/responses",
  };
}

describe("normalizeTokens", () => {
  test("keeps Anthropic's buckets disjoint as reported", () => {
    // GIVEN Anthropic usage, where input_tokens is the uncached remainder
    const tokens = normalizeTokens(
      anthropicRecord({
        at: "2026-07-30T00:00:00Z",
        inputTokens: 40,
        cacheRead: 9000,
        cacheWrite: 100,
      }),
    );

    // THEN the three buckets pass through untouched
    expect(tokens).toEqual({
      directInputTokens: 40,
      cacheReadTokens: 9000,
      cacheWriteTokens: 100,
      outputTokens: 10,
    });
  });

  test("splits the OpenAI family's inclusive input count back out", () => {
    // GIVEN OpenAI usage, where input_tokens already contains both subsets
    const tokens = normalizeTokens(
      openaiRecord({
        at: "2026-07-30T00:00:00Z",
        inputTokens: 9140,
        cachedTokens: 9000,
        cacheWriteTokens: 100,
      }),
    );

    // THEN direct is the remainder, so the triple is comparable to Anthropic's
    expect(tokens.directInputTokens).toBe(40);
    expect(tokens.cacheReadTokens).toBe(9000);
    expect(tokens.cacheWriteTokens).toBe(100);
  });

  test("never reports negative direct input when subsets exceed the total", () => {
    const tokens = normalizeTokens({
      provider: "fireworks",
      input_tokens: 100,
      cache_read_input_tokens: 500,
    });
    expect(tokens.directInputTokens).toBe(0);
  });
});

describe("parseCacheMarkers", () => {
  test("counts Anthropic cache_control blocks wherever they sit", () => {
    const markers = parseCacheMarkers(
      JSON.stringify({
        system: [
          { type: "text", text: "x", cache_control: { type: "ephemeral" } },
        ],
        tools: [{ name: "bash", cache_control: { type: "ephemeral" } }],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "hi",
                cache_control: { type: "ephemeral" },
              },
            ],
          },
        ],
      }),
    );
    expect(markers?.cacheControlBlocks).toBe(3);
    expect(markers?.promptCacheKey).toBe(false);
    expect(markers?.promptCacheMode).toBeNull();
  });

  test("reads OpenAI explicit-mode markers off a Responses request", () => {
    const markers = parseCacheMarkers(
      JSON.stringify({
        model: "gpt-5.6-luna",
        prompt_cache_key: "conv-xyz",
        prompt_cache_options: { mode: "explicit" },
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "hi",
                prompt_cache_breakpoint: { mode: "explicit" },
              },
            ],
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "again",
                prompt_cache_breakpoint: { mode: "explicit" },
              },
            ],
          },
        ],
      }),
    );
    expect(markers).toEqual({
      cacheControlBlocks: 0,
      promptCacheKey: true,
      promptCacheMode: "explicit",
      promptCacheBreakpoints: 2,
    });
  });

  test("returns null for a truncated body instead of reporting zero markers", () => {
    // GIVEN a body the recorder cut off mid-JSON
    const markers = parseCacheMarkers('{"model":"gpt-5.6-luna","input":[{"rol');

    // THEN "could not tell" stays distinguishable from "no markers"
    expect(markers).toBeNull();
  });

  test("returns null when no body was recorded", () => {
    expect(parseCacheMarkers(undefined)).toBeNull();
  });
});

describe("buildCacheObservations", () => {
  test("orders by recorded_at rather than NDJSON arrival order", () => {
    const observations = buildCacheObservations({
      records: [
        anthropicRecord({ at: "2026-07-30T00:00:02Z", inputTokens: 30 }),
        anthropicRecord({ at: "2026-07-30T00:00:01Z", inputTokens: 20 }),
      ],
    });
    expect(observations.requests.map((r) => r.recordedAt)).toEqual([
      "2026-07-30T00:00:01Z",
      "2026-07-30T00:00:02Z",
    ]);
    expect(observations.requests.map((r) => r.index)).toEqual([1, 2]);
  });

  test("scores only the model carrying the most prompt tokens", () => {
    // GIVEN a main-agent model plus a cheap auxiliary call site
    const observations = buildCacheObservations({
      records: [
        anthropicRecord({
          at: "2026-07-30T00:00:01Z",
          inputTokens: 100,
          cacheWrite: 9000,
        }),
        anthropicRecord({
          at: "2026-07-30T00:00:02Z",
          model: "claude-haiku-4-5",
          inputTokens: 80,
        }),
        anthropicRecord({
          at: "2026-07-30T00:00:03Z",
          inputTokens: 40,
          cacheRead: 9000,
        }),
      ],
    });

    // THEN the auxiliary model's tiny prompts never enter the ratios
    expect(observations.mainModel).toBe("claude-sonnet-4-6");
    expect(observations.requests).toHaveLength(2);
    expect(observations.skipped.otherModel).toBe(1);
    expect(observations.modelTotals.map((t) => t.model)).toEqual([
      "claude-haiku-4-5",
      "claude-sonnet-4-6",
    ]);
  });

  test("honors an explicit main-model override", () => {
    const observations = buildCacheObservations({
      records: [
        anthropicRecord({ at: "2026-07-30T00:00:01Z", inputTokens: 9000 }),
        anthropicRecord({
          at: "2026-07-30T00:00:02Z",
          model: "claude-haiku-4-5",
          inputTokens: 80,
        }),
      ],
      mainModelOverride: "claude-haiku-4-5",
    });
    expect(observations.mainModel).toBe("claude-haiku-4-5");
    expect(observations.requests).toHaveLength(1);
  });

  test("drops non-2xx and zero-token records", () => {
    const observations = buildCacheObservations({
      records: [
        anthropicRecord({ at: "2026-07-30T00:00:01Z", inputTokens: 100 }),
        anthropicRecord({
          at: "2026-07-30T00:00:02Z",
          inputTokens: 500,
          statusCode: 429,
        }),
        {
          provider: "anthropic",
          model: "claude-sonnet-4-6",
          recorded_at: "2026-07-30T00:00:03Z",
          input_tokens: 0,
          output_tokens: 0,
          status_code: 200,
        },
      ],
    });
    expect(observations.requests).toHaveLength(1);
    expect(observations.skipped.nonSuccessStatus).toBe(1);
    expect(observations.skipped.zeroTokens).toBe(1);
  });
});

describe("computeCacheMetrics", () => {
  test("scores a well-cached conversation near optimal", () => {
    // GIVEN a cold request that writes the prefix and warm reads after it
    const observations = buildCacheObservations({
      records: [
        anthropicRecord({
          at: "2026-07-30T00:00:01Z",
          inputTokens: 10,
          cacheWrite: 9990,
        }),
        anthropicRecord({
          at: "2026-07-30T00:00:02Z",
          inputTokens: 20,
          cacheRead: 9990,
        }),
        anthropicRecord({
          at: "2026-07-30T00:00:03Z",
          inputTokens: 20,
          cacheRead: 10010,
        }),
      ],
    });

    const metrics = computeCacheMetrics(observations);
    const byName = Object.fromEntries(metrics.map((m) => [m.name, m.score]));

    expect(byName["first-request-write-coverage"]).toBeCloseTo(0.999, 3);
    expect(byName["steady-read-ratio"]!).toBeGreaterThan(0.99);
    expect(byName["cold-request-count"]).toBe(0);
    expect(byName["uncached-input-tokens"]).toBe(40);
  });

  test("flags a run where no breakpoint was ever written", () => {
    // GIVEN OpenAI explicit mode with no markers: every turn rebills the prefix
    const observations = buildCacheObservations({
      records: [
        openaiRecord({ at: "2026-07-30T00:00:01Z", inputTokens: 10000 }),
        openaiRecord({ at: "2026-07-30T00:00:02Z", inputTokens: 10020 }),
        openaiRecord({ at: "2026-07-30T00:00:03Z", inputTokens: 10040 }),
      ],
    });

    const metrics = computeCacheMetrics(observations);
    const byName = Object.fromEntries(metrics.map((m) => [m.name, m.score]));

    expect(byName["first-request-write-coverage"]).toBe(0);
    expect(byName["steady-read-ratio"]).toBe(0);
    expect(byName["cold-request-count"]).toBe(2);
    expect(byName["uncached-input-tokens"]).toBe(20060);
  });

  test("attaches the per-request breakdown to every metric", () => {
    const observations = buildCacheObservations({
      records: [
        anthropicRecord({
          at: "2026-07-30T00:00:01Z",
          inputTokens: 10,
          cacheWrite: 500,
        }),
        anthropicRecord({
          at: "2026-07-30T00:00:02Z",
          inputTokens: 20,
          cacheRead: 500,
        }),
      ],
    });

    for (const metric of computeCacheMetrics(observations)) {
      expect(metric.metadata?.requests).toEqual([
        {
          index: 1,
          model: "claude-sonnet-4-6",
          input: 10,
          cacheRead: 0,
          cacheWrite: 500,
          durationMs: 1200,
        },
        {
          index: 2,
          model: "claude-sonnet-4-6",
          input: 20,
          cacheRead: 500,
          cacheWrite: 0,
          durationMs: 1200,
        },
      ]);
    }
  });

  test("returns a scored-nothing result when no usage was recorded", () => {
    const metrics = computeCacheMetrics(
      buildCacheObservations({ records: [] }),
    );
    expect(metrics.map((m) => m.name)).toEqual([
      "first-request-write-coverage",
      "steady-read-ratio",
      "cold-request-count",
      "uncached-input-tokens",
    ]);
    for (const metric of metrics) {
      expect(metric.score).toBe(0);
    }
  });
});

describe("scenarios", () => {
  test("every scenario id matches its key and carries fixed turns", () => {
    for (const [id, scenario] of Object.entries(PROMPT_CACHE_SCENARIOS)) {
      expect(scenario.id).toBe(id);
      expect(scenario.turns.length).toBeGreaterThan(0);
      for (const turn of scenario.turns) {
        expect(turn.trim().length).toBeGreaterThan(0);
      }
    }
  });

  test("resolveScenario names the known ids when given an unknown one", () => {
    expect(() => resolveScenario("nope")).toThrow(/short-chat, tool-loop/);
  });
});
