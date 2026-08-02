/**
 * Pure scoring for the prompt-cache benchmark.
 *
 * Everything here operates on the egress jail's recorded usage records
 * (`<runDir>/egress-usage.ndjson`, written by the mitmproxy addon).
 * That is wire truth, not events the assistant chose to emit. No I/O and
 * no clocks: the
 * only ordering input is each record's `recorded_at` stamp, so the same
 * NDJSON always scores identically.
 *
 * ## Provider-neutral token triple
 *
 * Providers disagree about whether cached tokens are counted inside the
 * input count, so raw fields are not comparable across profiles. Every
 * record is normalized to a `(direct, read, write)` triple where the three
 * buckets are disjoint and sum to the full prompt:
 *
 * - **Anthropic** reports `input_tokens` as the *uncached remainder*, with
 *   `cache_read_input_tokens` / `cache_creation_input_tokens` as separate
 *   non-overlapping buckets. The triple is those three fields verbatim.
 * - **The OpenAI family** (OpenAI Responses, Fireworks, OpenRouter) folds
 *   both cached subsets *into* the inclusive input count, so `direct` is
 *   the input count minus the read and write subsets. This mirrors
 *   `buildPricingUsage`'s `directInputTokens` in the assistant
 *   (`assistant/src/usage/pricing.ts`).
 *
 * ## Main-model filtering
 *
 * A turn's traffic is not all main-agent traffic: the assistant runs
 * auxiliary call sites (conversation title, reply suggestions) on a
 * cheaper model whose tiny prompts would swamp the ratios. The main model
 * is picked as the one accounting for the most prompt tokens across the
 * run, which is unambiguous for a benchmark whose whole point is a large
 * stable prefix. `EVALS_PROMPT_CACHE_MODEL` overrides the choice when a
 * run needs it pinned.
 */

import type { MetricResult } from "../../../src/lib/metrics.js";

/** Explicit prompt-cache markers observed on a request body. */
export interface RequestCacheMarkers {
  /** Anthropic: blocks carrying a `cache_control` breakpoint. */
  cacheControlBlocks: number;
  /** OpenAI: whether the request carried a `prompt_cache_key`. */
  promptCacheKey: boolean;
  /** OpenAI: `prompt_cache_options.mode`, or null when not sent. */
  promptCacheMode: string | null;
  /** OpenAI: content parts carrying a `prompt_cache_breakpoint` marker. */
  promptCacheBreakpoints: number;
}

/** One main-model request, normalized for scoring. */
export interface CacheRequestObservation {
  /** 1-based position within the main-model request series. */
  index: number;
  model: string;
  provider: string;
  recordedAt: string | null;
  requestPath: string | null;
  statusCode: number | null;
  durationMs: number | null;
  /** Prompt tokens billed at the base input rate (neither read nor written). */
  directInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
  /** Null when the request body was absent, truncated, or unparseable. */
  markers: RequestCacheMarkers | null;
  /** Whether the recorder capped the stored request body. */
  requestBodyTruncated: boolean;
}

/** Result of turning raw usage records into a scoreable series. */
export interface CacheObservations {
  /** The model whose requests were scored. */
  mainModel: string | null;
  /** Every model seen, with its request count and total prompt tokens. */
  modelTotals: Array<{
    model: string;
    requests: number;
    promptTokens: number;
  }>;
  /** Main-model requests in `recorded_at` order. */
  requests: CacheRequestObservation[];
  /** Records dropped before scoring, by reason. */
  skipped: {
    nonSuccessStatus: number;
    zeroTokens: number;
    otherModel: number;
  };
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function tokenField(
  record: Record<string, unknown>,
  snake: string,
  camel: string,
): number {
  return Math.max(readNumber(record[snake] ?? record[camel]) ?? 0, 0);
}

/**
 * Split one record's prompt into disjoint direct / read / write buckets.
 * See the module docstring for why the split is provider-dependent.
 */
export function normalizeTokens(record: Record<string, unknown>): {
  directInputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
  outputTokens: number;
} {
  const inputTokens = tokenField(record, "input_tokens", "inputTokens");
  const cacheReadTokens = tokenField(
    record,
    "cache_read_input_tokens",
    "cacheReadInputTokens",
  );
  const cacheWriteTokens = tokenField(
    record,
    "cache_creation_input_tokens",
    "cacheCreationInputTokens",
  );
  const outputTokens = tokenField(record, "output_tokens", "outputTokens");
  const provider = readString(record.provider)?.toLowerCase();
  const directInputTokens =
    provider === "anthropic"
      ? inputTokens
      : Math.max(inputTokens - cacheReadTokens - cacheWriteTokens, 0);
  return {
    directInputTokens,
    cacheReadTokens,
    cacheWriteTokens,
    outputTokens,
  };
}

/** Depth cap for the marker walk, so a pathological body can't recurse away. */
const MARKER_WALK_MAX_DEPTH = 12;

function countMarkerKeys(
  value: unknown,
  keys: { cacheControl: number; promptCacheBreakpoint: number },
  depth: number,
): void {
  if (depth > MARKER_WALK_MAX_DEPTH) return;
  if (Array.isArray(value)) {
    for (const entry of value) {
      countMarkerKeys(entry, keys, depth + 1);
    }
    return;
  }
  if (typeof value !== "object" || value === null) return;
  const record = value as Record<string, unknown>;
  if (record.cache_control !== undefined && record.cache_control !== null) {
    keys.cacheControl += 1;
  }
  if (
    record.prompt_cache_breakpoint !== undefined &&
    record.prompt_cache_breakpoint !== null
  ) {
    keys.promptCacheBreakpoint += 1;
  }
  for (const entry of Object.values(record)) {
    countMarkerKeys(entry, keys, depth + 1);
  }
}

/**
 * Read explicit cache-marker placement off a recorded request body.
 *
 * The recorder caps stored bodies (`RECORDING_MAX_PAYLOAD_CHARS`), so a
 * long prompt arrives as invalid JSON. Parse failure yields `null` rather
 * than a zeroed count, so "no markers" and "could not tell" stay
 * distinguishable in the artifact.
 *
 * Markers are counted by walking the whole body for `cache_control` /
 * `prompt_cache_breakpoint` keys instead of matching known paths, so a
 * marker on tools, on the system prompt, or on a message block all count
 * without this scorer tracking each provider's request schema.
 */
export function parseCacheMarkers(body: unknown): RequestCacheMarkers | null {
  if (typeof body !== "string" || body.length === 0) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;
  const counts = { cacheControl: 0, promptCacheBreakpoint: 0 };
  countMarkerKeys(parsed, counts, 0);
  const root = parsed as Record<string, unknown>;
  const options = root.prompt_cache_options;
  const promptCacheMode =
    typeof options === "object" && options !== null
      ? (readString((options as Record<string, unknown>).mode) ?? null)
      : null;
  return {
    cacheControlBlocks: counts.cacheControl,
    promptCacheKey: readString(root.prompt_cache_key) !== undefined,
    promptCacheMode,
    promptCacheBreakpoints: counts.promptCacheBreakpoint,
  };
}

function isSuccessStatus(record: Record<string, unknown>): boolean {
  const status = readNumber(record.status_code ?? record.statusCode);
  // A record with no status is still wire truth the addon parsed usage
  // out of, so absence is treated as success rather than dropped.
  if (status === undefined) return true;
  return status >= 200 && status < 300;
}

/**
 * Order records by `recorded_at`. Records without a stamp keep their
 * NDJSON order relative to everything else (stable sort, sorted key
 * falls back to the record's own position), so ordering never depends on
 * the wall clock at scoring time.
 */
function sortByRecordedAt(
  records: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return records
    .map((record, position) => ({ record, position }))
    .sort((a, b) => {
      const aAt = readString(a.record.recorded_at) ?? "";
      const bAt = readString(b.record.recorded_at) ?? "";
      if (aAt !== bAt) return aAt < bAt ? -1 : 1;
      return a.position - b.position;
    })
    .map(({ record }) => record);
}

/**
 * Select the model whose requests carry the run's main-agent prefix: the
 * one accounting for the most prompt tokens. Ties break on model name so
 * the choice never depends on map iteration order.
 */
function selectMainModel(
  totals: Map<string, { requests: number; promptTokens: number }>,
): string | null {
  let best: string | null = null;
  let bestTokens = -1;
  for (const [model, total] of [...totals.entries()].sort((a, b) =>
    a[0] < b[0] ? -1 : 1,
  )) {
    if (total.promptTokens > bestTokens) {
      best = model;
      bestTokens = total.promptTokens;
    }
  }
  return best;
}

export interface BuildCacheObservationsInput {
  records: Array<Record<string, unknown>>;
  /** Pin the scored model instead of inferring it from prompt-token share. */
  mainModelOverride?: string;
}

/** Turn raw recorded usage into the scoreable main-model request series. */
export function buildCacheObservations(
  input: BuildCacheObservationsInput,
): CacheObservations {
  const skipped = { nonSuccessStatus: 0, zeroTokens: 0, otherModel: 0 };
  const totals = new Map<string, { requests: number; promptTokens: number }>();

  const scoreable: Array<{
    record: Record<string, unknown>;
    model: string;
    tokens: ReturnType<typeof normalizeTokens>;
  }> = [];

  for (const record of sortByRecordedAt(input.records)) {
    if (!isSuccessStatus(record)) {
      skipped.nonSuccessStatus += 1;
      continue;
    }
    const tokens = normalizeTokens(record);
    const promptTokens =
      tokens.directInputTokens +
      tokens.cacheReadTokens +
      tokens.cacheWriteTokens;
    if (promptTokens === 0 && tokens.outputTokens === 0) {
      skipped.zeroTokens += 1;
      continue;
    }
    const model = readString(record.model) ?? "unknown";
    const total = totals.get(model) ?? { requests: 0, promptTokens: 0 };
    total.requests += 1;
    total.promptTokens += promptTokens;
    totals.set(model, total);
    scoreable.push({ record, model, tokens });
  }

  const mainModel = input.mainModelOverride ?? selectMainModel(totals);

  const requests: CacheRequestObservation[] = [];
  for (const entry of scoreable) {
    if (mainModel === null || entry.model !== mainModel) {
      skipped.otherModel += 1;
      continue;
    }
    const { record, tokens } = entry;
    requests.push({
      index: requests.length + 1,
      model: entry.model,
      provider: readString(record.provider) ?? "unknown",
      recordedAt: readString(record.recorded_at) ?? null,
      requestPath: readString(record.request_path) ?? null,
      statusCode: readNumber(record.status_code) ?? null,
      durationMs: readNumber(record.duration_ms) ?? null,
      ...tokens,
      markers: parseCacheMarkers(record.request_body),
      requestBodyTruncated: record.request_body_truncated === true,
    });
  }

  return {
    mainModel,
    modelTotals: [...totals.entries()]
      .map(([model, total]) => ({ model, ...total }))
      .sort((a, b) => (a.model < b.model ? -1 : 1)),
    requests,
    skipped,
  };
}

/** Compact per-request row attached to every metric's metadata. */
interface RequestBreakdownRow {
  index: number;
  model: string;
  input: number;
  cacheRead: number;
  cacheWrite: number;
  durationMs: number | null;
}

function breakdown(observations: CacheObservations): RequestBreakdownRow[] {
  return observations.requests.map((request) => ({
    index: request.index,
    model: request.model,
    input: request.directInputTokens,
    cacheRead: request.cacheReadTokens,
    cacheWrite: request.cacheWriteTokens,
    durationMs: request.durationMs,
  }));
}

/**
 * Score cache behavior across the run's main-model requests.
 *
 * - `first-request-write-coverage` (higher is better, optimal ~1.0): the
 *   share of the first request's prompt that was written to the cache. A
 *   correct implementation writes the entire stable prefix on the cold
 *   request; 0 means no breakpoint was placed at all, and every later
 *   request re-bills the whole prefix.
 * - `steady-read-ratio` (higher is better): the share of prompt tokens
 *   served from cache across requests 2..N. Short turns on a large stable
 *   prefix should read nearly everything.
 * - `cold-request-count` (lower is better, optimal 0): requests after the
 *   first that read nothing from cache. Each one is a full-prefix rebill.
 * - `uncached-input-tokens` (lower is better): base-rate prompt tokens
 *   across requests 2..N. Only the per-turn delta should land here; a
 *   large number means the prefix is being re-billed.
 */
export function computeCacheMetrics(
  observations: CacheObservations,
): MetricResult[] {
  const requests = observations.requests;
  const rows = breakdown(observations);
  const shared = {
    mainModel: observations.mainModel,
    requestCount: requests.length,
    modelTotals: observations.modelTotals,
    skipped: observations.skipped,
    requests: rows,
  };

  if (requests.length === 0) {
    const reason = "No main-model requests were recorded for this run";
    return [
      {
        name: "first-request-write-coverage",
        score: 0,
        reason,
        unit: "fraction",
        metadata: shared,
      },
      {
        name: "steady-read-ratio",
        score: 0,
        reason,
        unit: "fraction",
        metadata: shared,
      },
      {
        name: "cold-request-count",
        score: 0,
        reason,
        unit: "raw",
        metadata: shared,
      },
      {
        name: "uncached-input-tokens",
        score: 0,
        reason,
        unit: "raw",
        metadata: shared,
      },
    ];
  }

  const first = requests[0]!;
  const firstCacheable = first.directInputTokens + first.cacheWriteTokens;
  const firstWriteCoverage =
    firstCacheable > 0 ? first.cacheWriteTokens / firstCacheable : 0;

  const steady = requests.slice(1);
  const steadyRead = steady.reduce((sum, r) => sum + r.cacheReadTokens, 0);
  const steadyWrite = steady.reduce((sum, r) => sum + r.cacheWriteTokens, 0);
  const steadyDirect = steady.reduce((sum, r) => sum + r.directInputTokens, 0);
  const steadyPrompt = steadyRead + steadyWrite + steadyDirect;
  const steadyReadRatio = steadyPrompt > 0 ? steadyRead / steadyPrompt : 0;
  const coldRequests = steady.filter((r) => r.cacheReadTokens === 0);

  return [
    {
      name: "first-request-write-coverage",
      score: firstWriteCoverage,
      reason:
        firstCacheable > 0
          ? `Request 1 wrote ${first.cacheWriteTokens} of ${firstCacheable} cacheable prompt tokens`
          : "Request 1 carried no cacheable prompt tokens",
      unit: "fraction",
      metadata: {
        ...shared,
        firstRequestCacheWriteTokens: first.cacheWriteTokens,
        firstRequestDirectInputTokens: first.directInputTokens,
        firstRequestMarkers: first.markers,
      },
    },
    {
      name: "steady-read-ratio",
      score: steadyReadRatio,
      reason:
        steady.length > 0
          ? `Cache read ${steadyRead} of ${steadyPrompt} prompt tokens across requests 2..${requests.length}`
          : "Only one main-model request was recorded, so there is no steady state to score",
      unit: "fraction",
      metadata: {
        ...shared,
        steadyReadTokens: steadyRead,
        steadyWriteTokens: steadyWrite,
        steadyDirectInputTokens: steadyDirect,
      },
    },
    {
      name: "cold-request-count",
      score: coldRequests.length,
      reason: `${coldRequests.length} of ${steady.length} requests after the first read nothing from cache`,
      unit: "raw",
      metadata: {
        ...shared,
        coldRequestIndexes: coldRequests.map((r) => r.index),
      },
    },
    {
      name: "uncached-input-tokens",
      score: steadyDirect,
      reason: `${steadyDirect} base-rate prompt tokens across requests 2..${requests.length}`,
      unit: "raw",
      metadata: { ...shared, steadyDirectInputTokens: steadyDirect },
    },
  ];
}
