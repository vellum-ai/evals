/**
 * compare-data — pure policy layer behind `evals compare`.
 *
 * Consumes two schemaVersion-2 JSONL exports (the flat summary shape
 * `evals export --out *.jsonl` writes: a `metadata` row, a `session` row,
 * per-`test` rows, and per-`execution` rows) and joins them on
 * `(testId, profileId)` to produce per-key deltas/ratios for score, cost,
 * tokens, and runtime, plus per-profile aggregates and headline
 * cross-profile cost ratios ("vellum-default is 7.3x hermes-default").
 *
 * No I/O beyond parsing: callers hand in file contents as strings.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// Export row schemas (schemaVersion 2 — see src/commands/export.ts)
// ---------------------------------------------------------------------------

const MetadataRowSchema = z.object({
  type: z.literal("metadata"),
  schemaVersion: z.literal(2),
  exportedAt: z.string(),
  sessionId: z.string(),
});

const ExecutionRowSchema = z.object({
  type: z.literal("execution"),
  sessionId: z.string(),
  testId: z.string(),
  profileId: z.string(),
  run: z.object({
    runId: z.string(),
    status: z.string(),
    scoreTotal: z.number(),
    metricCount: z.number(),
    metrics: z.array(z.unknown()),
    assistantResponses: z.number(),
    runtimeMs: z.number().optional(),
    assistantEventCount: z.number(),
    simulatorMessageCount: z.number(),
    totalInputTokens: z.number().optional(),
    totalOutputTokens: z.number().optional(),
    totalCostUsd: z.number().optional(),
  }),
});

/**
 * Rows the comparison does not consume. Validated only for `type` so a
 * future additive change to the session/test payloads doesn't break compare.
 */
const OtherRowSchema = z.object({
  type: z.enum(["session", "test"]),
});

const ExportRowSchema = z.union([
  MetadataRowSchema,
  ExecutionRowSchema,
  OtherRowSchema,
]);

// ---------------------------------------------------------------------------
// Parsed export
// ---------------------------------------------------------------------------

export interface ExecutionEntry {
  testId: string;
  profileId: string;
  runId: string;
  status: string;
  scoreTotal: number;
  totalCostUsd?: number;
  totalInputTokens?: number;
  totalOutputTokens?: number;
  runtimeMs?: number;
}

export interface ParsedExport {
  sessionId: string;
  exportedAt: string;
  executions: ExecutionEntry[];
}

/** Join key for one execution. Ids never contain spaces (see AGENTS.md). */
const executionKey = (e: { testId: string; profileId: string }) =>
  `${e.testId} ${e.profileId}`;

/**
 * Parse one JSONL export. `label` names the file in error messages.
 * Throws on malformed JSON, schema violations, a missing/unsupported
 * metadata row, or duplicate `(testId, profileId)` keys.
 */
export function parseExportJsonl(text: string, label: string): ParsedExport {
  let metadata: z.infer<typeof MetadataRowSchema> | undefined;
  const executions: ExecutionEntry[] = [];
  const seen = new Set<string>();

  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch (err) {
      throw new Error(
        `${label}:${i + 1}: not valid JSON: ${(err as Error).message}`,
      );
    }

    const result = ExportRowSchema.safeParse(parsed);
    if (!result.success) {
      const issues = result.error.issues
        .map((issue) => `${issue.path.join(".") || "<root>"}: ${issue.message}`)
        .join("; ");
      throw new Error(
        `${label}:${i + 1}: not a schemaVersion-2 export row (${issues})`,
      );
    }

    const row = result.data;
    if (row.type === "metadata") {
      metadata = row;
    } else if (row.type === "execution") {
      const key = executionKey(row);
      if (seen.has(key)) {
        throw new Error(
          `${label}:${i + 1}: duplicate execution for test "${row.testId}" × profile "${row.profileId}"`,
        );
      }
      seen.add(key);
      executions.push({
        testId: row.testId,
        profileId: row.profileId,
        runId: row.run.runId,
        status: row.run.status,
        scoreTotal: row.run.scoreTotal,
        totalCostUsd: row.run.totalCostUsd,
        totalInputTokens: row.run.totalInputTokens,
        totalOutputTokens: row.run.totalOutputTokens,
        runtimeMs: row.run.runtimeMs,
      });
    }
  }

  if (!metadata) {
    throw new Error(
      `${label}: no schemaVersion-2 metadata row found — is this an ` +
        `\`evals export --out *.jsonl\` file?`,
    );
  }

  return {
    sessionId: metadata.sessionId,
    exportedAt: metadata.exportedAt,
    executions,
  };
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/** Where a join key was found: both exports, or only one side. */
export type Presence = "both" | "a-only" | "b-only";

/**
 * One numeric axis compared across the two sides. `delta` is `b - a` and
 * `ratio` is `b / a`; each is present only when the inputs make it
 * meaningful (both sides defined; a nonzero divisor for the ratio).
 */
export interface MetricComparison {
  a?: number;
  b?: number;
  delta?: number;
  ratio?: number;
}

/** Per-`(testId, profileId)` join row. */
export interface KeyComparison {
  testId: string;
  profileId: string;
  presence: Presence;
  statusA?: string;
  statusB?: string;
  score: MetricComparison;
  costUsd: MetricComparison;
  inputTokens: MetricComparison;
  outputTokens: MetricComparison;
  runtimeMs: MetricComparison;
}

/** Per-side aggregate over one profile's executions. */
export interface ProfileAggregate {
  executionCount: number;
  meanScore: number;
  sumCostUsd?: number;
  sumInputTokens?: number;
  sumOutputTokens?: number;
  sumRuntimeMs?: number;
}

/** Per-profile join row (aggregates on each side, plus deltas/ratios). */
export interface ProfileComparison {
  profileId: string;
  presence: Presence;
  aggregateA?: ProfileAggregate;
  aggregateB?: ProfileAggregate;
  meanScore: MetricComparison;
  sumCostUsd: MetricComparison;
  sumInputTokens: MetricComparison;
  sumOutputTokens: MetricComparison;
  sumRuntimeMs: MetricComparison;
}

/**
 * Cross-profile cost headline within one side, over the tests both profiles
 * ran on that side: "`profileId` is `costRatio`x `vsProfileId`". Oriented so
 * `costRatio >= 1` (the more expensive profile is the subject).
 */
export interface HeadlineCostRatio {
  side: "a" | "b";
  profileId: string;
  vsProfileId: string;
  sharedTestCount: number;
  costRatio: number;
}

export interface CompareResult {
  a: { sessionId: string; exportedAt: string };
  b: { sessionId: string; exportedAt: string };
  byTest: KeyComparison[];
  byProfile: ProfileComparison[];
  headlineCostRatios: HeadlineCostRatio[];
}

function compareValues(a?: number, b?: number): MetricComparison {
  const comparison: MetricComparison = {};
  if (a !== undefined) comparison.a = a;
  if (b !== undefined) comparison.b = b;
  if (a !== undefined && b !== undefined) {
    comparison.delta = b - a;
    if (a !== 0) comparison.ratio = b / a;
  }
  return comparison;
}

function presenceOf(hasA: boolean, hasB: boolean): Presence {
  if (hasA && hasB) return "both";
  return hasA ? "a-only" : "b-only";
}

function sumDefined(values: (number | undefined)[]): number | undefined {
  const defined = values.filter((v): v is number => v !== undefined);
  if (defined.length === 0) return undefined;
  return defined.reduce((acc, v) => acc + v, 0);
}

function aggregateProfile(entries: ExecutionEntry[]): ProfileAggregate {
  return {
    executionCount: entries.length,
    meanScore:
      entries.reduce((acc, e) => acc + e.scoreTotal, 0) / entries.length,
    sumCostUsd: sumDefined(entries.map((e) => e.totalCostUsd)),
    sumInputTokens: sumDefined(entries.map((e) => e.totalInputTokens)),
    sumOutputTokens: sumDefined(entries.map((e) => e.totalOutputTokens)),
    sumRuntimeMs: sumDefined(entries.map((e) => e.runtimeMs)),
  };
}

function groupByProfile(
  executions: ExecutionEntry[],
): Map<string, ExecutionEntry[]> {
  const groups = new Map<string, ExecutionEntry[]>();
  for (const entry of executions) {
    const group = groups.get(entry.profileId);
    if (group) group.push(entry);
    else groups.set(entry.profileId, [entry]);
  }
  return groups;
}

/**
 * Cross-profile cost ratios within one side. For every profile pair, the
 * costs are summed over the tests *both* profiles ran (so a profile that
 * skipped an expensive test isn't flattered), then oriented so the pricier
 * profile is the subject. Pairs with no shared costed tests are omitted.
 */
function headlineRatiosForSide(
  side: "a" | "b",
  groups: Map<string, ExecutionEntry[]>,
): HeadlineCostRatio[] {
  const profileIds = [...groups.keys()].sort();
  const ratios: HeadlineCostRatio[] = [];

  for (let i = 0; i < profileIds.length; i++) {
    for (let j = i + 1; j < profileIds.length; j++) {
      const left = groups.get(profileIds[i])!;
      const right = groups.get(profileIds[j])!;
      const rightByTest = new Map(right.map((e) => [e.testId, e]));

      let leftCost = 0;
      let rightCost = 0;
      let sharedTestCount = 0;
      for (const entry of left) {
        const other = rightByTest.get(entry.testId);
        if (
          !other ||
          entry.totalCostUsd === undefined ||
          other.totalCostUsd === undefined
        ) {
          continue;
        }
        leftCost += entry.totalCostUsd;
        rightCost += other.totalCostUsd;
        sharedTestCount++;
      }

      if (sharedTestCount === 0 || leftCost === 0 || rightCost === 0) continue;
      const [subject, subjectCost, object, objectCost] =
        leftCost >= rightCost
          ? [profileIds[i], leftCost, profileIds[j], rightCost]
          : [profileIds[j], rightCost, profileIds[i], leftCost];
      ratios.push({
        side,
        profileId: subject,
        vsProfileId: object,
        sharedTestCount,
        costRatio: subjectCost / objectCost,
      });
    }
  }

  return ratios;
}

/**
 * Join two parsed exports on `(testId, profileId)`. Keys present in only
 * one export are kept and flagged via `presence` rather than dropped.
 */
export function compareExports(
  a: ParsedExport,
  b: ParsedExport,
): CompareResult {
  const byKeyA = new Map(a.executions.map((e) => [executionKey(e), e]));
  const byKeyB = new Map(b.executions.map((e) => [executionKey(e), e]));

  const byTest: KeyComparison[] = [
    ...new Set([...byKeyA.keys(), ...byKeyB.keys()]),
  ]
    .sort()
    .map((key) => {
      const execA = byKeyA.get(key);
      const execB = byKeyB.get(key);
      const { testId, profileId } = (execA ?? execB)!;
      return {
        testId,
        profileId,
        presence: presenceOf(execA !== undefined, execB !== undefined),
        statusA: execA?.status,
        statusB: execB?.status,
        score: compareValues(execA?.scoreTotal, execB?.scoreTotal),
        costUsd: compareValues(execA?.totalCostUsd, execB?.totalCostUsd),
        inputTokens: compareValues(
          execA?.totalInputTokens,
          execB?.totalInputTokens,
        ),
        outputTokens: compareValues(
          execA?.totalOutputTokens,
          execB?.totalOutputTokens,
        ),
        runtimeMs: compareValues(execA?.runtimeMs, execB?.runtimeMs),
      };
    });

  const groupsA = groupByProfile(a.executions);
  const groupsB = groupByProfile(b.executions);
  const byProfile: ProfileComparison[] = [
    ...new Set([...groupsA.keys(), ...groupsB.keys()]),
  ]
    .sort()
    .map((profileId) => {
      const entriesA = groupsA.get(profileId);
      const entriesB = groupsB.get(profileId);
      const aggregateA = entriesA ? aggregateProfile(entriesA) : undefined;
      const aggregateB = entriesB ? aggregateProfile(entriesB) : undefined;
      return {
        profileId,
        presence: presenceOf(
          aggregateA !== undefined,
          aggregateB !== undefined,
        ),
        aggregateA,
        aggregateB,
        meanScore: compareValues(aggregateA?.meanScore, aggregateB?.meanScore),
        sumCostUsd: compareValues(
          aggregateA?.sumCostUsd,
          aggregateB?.sumCostUsd,
        ),
        sumInputTokens: compareValues(
          aggregateA?.sumInputTokens,
          aggregateB?.sumInputTokens,
        ),
        sumOutputTokens: compareValues(
          aggregateA?.sumOutputTokens,
          aggregateB?.sumOutputTokens,
        ),
        sumRuntimeMs: compareValues(
          aggregateA?.sumRuntimeMs,
          aggregateB?.sumRuntimeMs,
        ),
      };
    });

  return {
    a: { sessionId: a.sessionId, exportedAt: a.exportedAt },
    b: { sessionId: b.sessionId, exportedAt: b.exportedAt },
    byTest,
    byProfile,
    headlineCostRatios: [
      ...headlineRatiosForSide("a", groupsA),
      ...headlineRatiosForSide("b", groupsB),
    ],
  };
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export type CompareFormat = "table" | "md" | "json";
export type CompareAxis = "test" | "profile";

const fmtScore = (v: number) => v.toFixed(3);
const fmtCost = (v: number) => `$${v.toFixed(4)}`;
const fmtTokens = (v: number) => String(Math.round(v));
const fmtRuntime = (v: number) => `${(v / 1000).toFixed(1)}s`;

/** "0.82 → 0.91 (+0.09)" — or a one-sided/absent value. */
function cell(
  comparison: MetricComparison,
  fmt: (v: number) => string,
): string {
  const { a, b, delta } = comparison;
  if (a === undefined && b === undefined) return "—";
  if (a === undefined) return `— → ${fmt(b!)}`;
  if (b === undefined) return `${fmt(a)} → —`;
  const sign = delta! >= 0 ? "+" : "-";
  return `${fmt(a)} → ${fmt(b)} (${sign}${fmt(Math.abs(delta!))})`;
}

/** Like `cell`, but annotates the b/a ratio instead of the delta. */
function ratioCell(
  comparison: MetricComparison,
  fmt: (v: number) => string,
): string {
  const { a, b, ratio } = comparison;
  if (a === undefined && b === undefined) return "—";
  if (a === undefined) return `— → ${fmt(b!)}`;
  if (b === undefined) return `${fmt(a)} → —`;
  const suffix = ratio === undefined ? "" : ` (${ratio.toFixed(2)}x)`;
  return `${fmt(a)} → ${fmt(b)}${suffix}`;
}

function renderTable(header: string[], rows: string[][]): string {
  const widths = header.map((h, col) =>
    Math.max(h.length, ...rows.map((row) => row[col].length)),
  );
  const line = (cells: string[]) =>
    cells
      .map((c, col) => c.padEnd(widths[col]))
      .join("  ")
      .trimEnd();
  return [
    line(header),
    line(widths.map((w) => "-".repeat(w))),
    ...rows.map(line),
  ].join("\n");
}

function renderMarkdown(header: string[], rows: string[][]): string {
  const line = (cells: string[]) => `| ${cells.join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...rows.map(line)].join(
    "\n",
  );
}

function byTestRows(result: CompareResult): {
  header: string[];
  rows: string[][];
} {
  return {
    header: [
      "Test",
      "Profile",
      "Presence",
      "Score (Δ)",
      "Cost (×)",
      "Input tok",
      "Output tok",
      "Runtime",
    ],
    rows: result.byTest.map((row) => [
      row.testId,
      row.profileId,
      row.presence,
      cell(row.score, fmtScore),
      ratioCell(row.costUsd, fmtCost),
      cell(row.inputTokens, fmtTokens),
      cell(row.outputTokens, fmtTokens),
      cell(row.runtimeMs, fmtRuntime),
    ]),
  };
}

function byProfileRows(result: CompareResult): {
  header: string[];
  rows: string[][];
} {
  return {
    header: [
      "Profile",
      "Presence",
      "Runs (a/b)",
      "Mean score (Δ)",
      "Sum cost (×)",
      "Input tok",
      "Output tok",
      "Runtime",
    ],
    rows: result.byProfile.map((row) => [
      row.profileId,
      row.presence,
      `${row.aggregateA?.executionCount ?? 0}/${row.aggregateB?.executionCount ?? 0}`,
      cell(row.meanScore, fmtScore),
      ratioCell(row.sumCostUsd, fmtCost),
      cell(row.sumInputTokens, fmtTokens),
      cell(row.sumOutputTokens, fmtTokens),
      cell(row.sumRuntimeMs, fmtRuntime),
    ]),
  };
}

function headlineLines(result: CompareResult): string[] {
  // When both sides carry the same ratios (e.g. the same file compared
  // against itself), one statement of each headline is enough.
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const h of result.headlineCostRatios) {
    const key = `${h.profileId} ${h.vsProfileId} ${h.costRatio.toFixed(6)} ${h.sharedTestCount}`;
    if (seen.has(key)) continue;
    seen.add(key);
    lines.push(
      `${h.profileId} is ${h.costRatio.toFixed(1)}x ${h.vsProfileId} on cost ` +
        `(side ${h.side}, ${h.sharedTestCount} shared test${h.sharedTestCount === 1 ? "" : "s"})`,
    );
  }
  return lines;
}

/** Render a comparison for the CLI. `json` output round-trips `JSON.parse`. */
export function formatComparison(
  result: CompareResult,
  options: { format: CompareFormat; by: CompareAxis },
): string {
  if (options.format === "json") {
    return JSON.stringify(result, null, 2);
  }

  const { header, rows } =
    options.by === "profile" ? byProfileRows(result) : byTestRows(result);
  const table =
    options.format === "md"
      ? renderMarkdown(header, rows)
      : renderTable(header, rows);

  const sections = [
    `A: session ${result.a.sessionId} (exported ${result.a.exportedAt})`,
    `B: session ${result.b.sessionId} (exported ${result.b.exportedAt})`,
    "",
    table,
  ];
  const headlines = headlineLines(result);
  if (headlines.length > 0) {
    sections.push("", ...headlines);
  }
  return sections.join("\n");
}
