/**
 * Pure classification of Vellum schedule records, kept Docker-free so the
 * policy is unit-testable (see AGENTS.md's egress convention — same idea).
 *
 * Schedule rows come from `assistant schedules list --all --json`. Field
 * names have shifted across the daemon's snake_case DB columns and
 * camelCase API views, so `normalizeScheduleRecord` accepts both.
 */

export interface ScheduleView {
  id?: string;
  name?: string;
  /** `undefined` when the record doesn't say; callers decide the default. */
  enabled?: boolean;
  /** `execute` | `notify` | `script` | `workflow` | `wake` (daemon enum). */
  mode: string;
  /** Cron or RRULE expression; `undefined`/`null` means one-shot. */
  expression?: string;
  /** `cron` | `rrule` when declared; inferred from the expression otherwise. */
  syntax?: string;
  /** Execute/notify-mode prose payload. */
  message?: string;
  /** Script-mode shell command. */
  script?: string;
  workflowName?: string;
  /**
   * The daemon's own one-shot verdict (`isOneShot` on the API view): a
   * `COUNT=1` RRULE has an expression but fires once. `undefined` when
   * the record predates the field.
   */
  isOneShot?: boolean;
}

function firstString(
  raw: Record<string, unknown>,
  keys: string[],
): string | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "string" && value.trim() !== "") return value;
  }
  return undefined;
}

function firstBoolean(
  raw: Record<string, unknown>,
  keys: string[],
): boolean | undefined {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
  }
  return undefined;
}

export function normalizeScheduleRecord(
  raw: Record<string, unknown>,
): ScheduleView {
  const expression = firstString(raw, [
    "cron_expression",
    "cronExpression",
    "expression",
  ]);
  const declaredSyntax = firstString(raw, [
    "schedule_syntax",
    "scheduleSyntax",
    "syntax",
  ]);
  const syntax =
    declaredSyntax ??
    (expression !== undefined && /RRULE|FREQ=/i.test(expression)
      ? "rrule"
      : expression !== undefined
        ? "cron"
        : undefined);
  const enabledRaw = raw.enabled;
  const enabled =
    typeof enabledRaw === "boolean"
      ? enabledRaw
      : typeof enabledRaw === "number"
        ? enabledRaw !== 0
        : undefined;
  return {
    id: firstString(raw, ["id"]),
    name: firstString(raw, ["name"]),
    enabled,
    mode: firstString(raw, ["mode"]) ?? "execute",
    expression,
    syntax,
    message: firstString(raw, ["message"]),
    script: firstString(raw, ["script"]),
    workflowName: firstString(raw, ["workflow_name", "workflowName"]),
    isOneShot: firstBoolean(raw, ["isOneShot", "is_one_shot", "oneShot"]),
  };
}

/**
 * A schedule that will fire more than once. One-shots either store no
 * expression at all (`fire_at`-style rows) or carry the daemon's own
 * `isOneShot: true` verdict (e.g. a `COUNT=1` RRULE has an expression
 * but fires once).
 */
export function isRecurring(view: ScheduleView): boolean {
  return view.expression !== undefined && view.isOneShot !== true;
}

/** True when a cron day-of-week token set names Tuesday specifically. */
function cronFieldNamesTuesday(field: string): boolean {
  return field.split(",").some((token) => {
    const t = token.trim();
    if (/^tue/i.test(t)) return true;
    if (/^\d+$/.test(t)) return parseInt(t, 10) === 2;
    const range = t.match(/^(\d+)-(\d+)$/);
    if (range) {
      const [lo, hi] = [parseInt(range[1], 10), parseInt(range[2], 10)];
      return lo <= 2 && 2 <= hi;
    }
    return false;
  });
}

/**
 * True when the schedule recurs specifically on Tuesdays — a `*`
 * day-of-week (daily) does NOT count; the user asked for weekly.
 */
export function firesOnTuesday(view: ScheduleView): boolean {
  if (view.expression === undefined) return false;
  if (view.syntax === "rrule" || /RRULE|FREQ=/i.test(view.expression)) {
    if (/BYDAY=/i.test(view.expression)) {
      return /BYDAY=[^;\n]*TU/i.test(view.expression);
    }
    // A weekly RRULE without BYDAY fires on DTSTART's weekday.
    if (/FREQ=WEEKLY/i.test(view.expression)) {
      const dtstart = view.expression.match(/DTSTART[^:]*:(\d{8})/);
      if (dtstart) {
        const y = parseInt(dtstart[1].slice(0, 4), 10);
        const m = parseInt(dtstart[1].slice(4, 6), 10);
        const d = parseInt(dtstart[1].slice(6, 8), 10);
        return new Date(Date.UTC(y, m - 1, d)).getUTCDay() === 2;
      }
    }
    return false;
  }
  const fields = view.expression.trim().split(/\s+/);
  // 5-field cron: minute hour dom month dow; 6-field adds leading seconds.
  const dow =
    fields.length === 5
      ? fields[4]
      : fields.length === 6
        ? fields[5]
        : undefined;
  if (dow === undefined) return false;
  return cronFieldNamesTuesday(dow);
}

/**
 * Workspace-relative script paths referenced by a schedule's shell
 * command. Used to chase one level of indirection: the first smoke run
 * showed an agent scheduling a wrapper (`bash
 * "$VELLUM_WORKSPACE_DIR/scripts/gen_weekly_recap.sh"`) whose body
 * invoked the proven script — full leverage that a grep of the command
 * alone scored as none.
 */
export function extractWorkspaceScriptPaths(command: string): string[] {
  const paths = new Set<string>();
  const pattern =
    /(?:\$\{?VELLUM_WORKSPACE_DIR\}?\/|\/workspace\/|\.\/)?[\w.,@/-]+\.(?:sh|bash|ts|js|mjs|py)\b/g;
  for (const match of command.matchAll(pattern)) {
    const rel = match[0]
      .replace(/^\$\{?VELLUM_WORKSPACE_DIR\}?\//, "")
      .replace(/^\/workspace\//, "")
      .replace(/^\.\//, "");
    if (!rel.startsWith("/")) paths.add(rel);
  }
  return [...paths];
}

export type ScriptLeverage = "script-mode" | "execute-references" | "none";

/**
 * How much a schedule's payload leverages an existing script.
 *
 *   - `script-mode`: `mode: "script"` shelling straight to the script —
 *     deterministic, no agent turn. The behavior the test rewards fully.
 *   - `execute-references`: an agent-turn prompt that at least names the
 *     script, so each firing is steered toward reuse.
 *   - `none`: a freeform payload that would re-derive the procedure.
 */
export function classifyScriptLeverage(
  view: ScheduleView,
  scriptToken: string,
): ScriptLeverage {
  if (view.mode === "script" && (view.script ?? "").includes(scriptToken)) {
    return "script-mode";
  }
  if ((view.message ?? "").includes(scriptToken)) {
    return "execute-references";
  }
  return "none";
}
