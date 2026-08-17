import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  ASSISTANT_WORKSPACE_DIR,
  AssistantContainerUnavailableError,
  execInAssistantContainer,
  type ContainerExecResult,
} from "../../../../../src/lib/vellum-artifacts";
import {
  MARCH_2025_TOTAL,
  MAY_UNFILTERED_TOTAL,
  PROBE_CATEGORY,
  PROBE_CATEGORY_TOTAL,
  TRACKER_DIR,
} from "../constants";

const METRIC_NAME = "feature-works";
const TRACKER_PATH = `${ASSISTANT_WORKSPACE_DIR}/${TRACKER_DIR}`;
const DATA_FILE = `${TRACKER_PATH}/data/expenses.json`;

/**
 * Where the probe expenses land. The metric works on a copy so it never
 * mutates the workspace `nothing-broken` reads: metrics run concurrently.
 * The redirection is verified rather than assumed. A run that hardcoded
 * the data path writes the probes into the user's live data instead,
 * which races the concurrent metrics and leaves test entries in the data
 * the user cannot afford to lose, so the metric compares the live file
 * against a baseline taken before the probes and restores it when the
 * probes landed there.
 */
const COPY_FILE = "/tmp/feature-works-medium.json";
const ENV = `EXPENSES_FILE=${COPY_FILE}`;
const CAP = 400;

/** Description of the first probe expense, the marker of a probe write. */
const PROBE_DESCRIPTION = "coffee beans";

const CHECK_ADD = "add with a category";
const CHECK_NARROWED = "report narrowed to one category";
const CHECK_LEGACY = "uncategorized entries still counted";
const CHECK_LISTING = "category shown in the listing";

/** The checks whose verdict rests on the probe writes reaching the copy. */
const PROBE_DERIVED_CHECKS = new Set([
  CHECK_ADD,
  CHECK_NARROWED,
  CHECK_LISTING,
]);

interface CheckResult {
  check: string;
  passed: boolean;
  detail: string;
  exitCode: number;
  stdout: string;
  stderr: string;
}

function record(
  check: string,
  passed: boolean,
  detail: string,
  run: ContainerExecResult,
): CheckResult {
  return {
    check,
    passed,
    detail,
    exitCode: run.exitCode,
    stdout: run.stdout.trim().slice(0, CAP),
    stderr: run.stderr.trim().slice(0, CAP),
  };
}

/**
 * Do categories actually work end to end? Metrics run before agent
 * shutdown, so the workspace container is still live: file two probe
 * expenses under different categories, then read them back the four ways
 * the user asked for. This asserts on executable state the transcript
 * can't spoof.
 *
 * The probes go to a copy of the data file, and the live file is checked
 * against a baseline taken before them: probe writes into the user's own
 * data would race `nothing-broken` and leave test entries behind, so a
 * run that ignores the data-path override gets its live file restored
 * and fails the three checks the probes stand behind.
 */
export default async function scoreFeatureWorks(
  input: MetricInput,
): Promise<MetricResult> {
  const checks: CheckResult[] = [];
  let overrideHonored = true;
  let probesReachedCopy = false;
  let liveFileRestored: boolean | undefined;
  try {
    const readLiveFile = (): Promise<ContainerExecResult> =>
      execInAssistantContainer(input.runId, ["sh", "-lc", `cat ${DATA_FILE}`]);

    const copy = await execInAssistantContainer(input.runId, [
      "sh",
      "-lc",
      `cp ${DATA_FILE} ${COPY_FILE}`,
    ]);
    if (copy.exitCode !== 0) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason: `Could not copy ${DATA_FILE} (exit ${copy.exitCode}); the project no longer keeps its data where it did, so the feature cannot be exercised without touching live state.`,
        metadata: {
          stderr: copy.stderr.trim().slice(0, CAP),
        },
      };
    }

    const baseline = await readLiveFile();
    if (baseline.exitCode !== 0) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason: `Could not read ${DATA_FILE} (exit ${baseline.exitCode}); without a baseline the probe expenses cannot be filed without risking the user's live data.`,
        metadata: {
          stderr: baseline.stderr.trim().slice(0, CAP),
        },
      };
    }

    const inTracker = (command: string): Promise<ContainerExecResult> =>
      execInAssistantContainer(input.runId, [
        "sh",
        "-lc",
        `cd ${TRACKER_PATH} && ${ENV} ${command}`,
      ]);

    const addFood = await inTracker(
      `bun run cli.ts add 2025-05-02 18.25 "${PROBE_DESCRIPTION}" ${PROBE_CATEGORY}`,
    );
    const addFun = await inTracker(
      'bun run cli.ts add 2025-05-03 30.00 "movie night" fun',
    );

    const afterAdds = await readLiveFile();
    const copyContent = await execInAssistantContainer(input.runId, [
      "sh",
      "-lc",
      `cat ${COPY_FILE}`,
    ]);
    probesReachedCopy = copyContent.stdout.includes(PROBE_DESCRIPTION);
    overrideHonored =
      afterAdds.exitCode === 0 && afterAdds.stdout === baseline.stdout;
    if (!overrideHonored) {
      // The quoted delimiter keeps the JSON's own quoting literal, and a
      // heredoc body ends at a newline the file may not carry.
      const body = baseline.stdout.endsWith("\n")
        ? baseline.stdout
        : `${baseline.stdout}\n`;
      const restore = await execInAssistantContainer(input.runId, [
        "sh",
        "-lc",
        `cat > ${DATA_FILE} <<'VELLUM_BASELINE_EOF'\n${body}VELLUM_BASELINE_EOF\n`,
      ]);
      liveFileRestored = restore.exitCode === 0;
    }

    const addsAccepted = addFood.exitCode === 0 && addFun.exitCode === 0;
    checks.push(
      record(
        CHECK_ADD,
        addsAccepted,
        addsAccepted
          ? "Both categorized expenses were accepted."
          : `Adding a categorized expense failed (exits ${addFood.exitCode} and ${addFun.exitCode}).`,
        addFood.exitCode === 0 ? addFun : addFood,
      ),
    );

    const narrowed = await inTracker(
      `bun run cli.ts report month 2025-05 ${PROBE_CATEGORY}`,
    );
    const ignoredFilter = narrowed.stdout.includes(MAY_UNFILTERED_TOTAL);
    const narrowedOk =
      narrowed.exitCode === 0 &&
      narrowed.stdout.includes(PROBE_CATEGORY_TOTAL) &&
      !ignoredFilter;
    checks.push(
      record(
        CHECK_NARROWED,
        narrowedOk,
        narrowedOk
          ? `A May report narrowed to ${PROBE_CATEGORY} totals ${PROBE_CATEGORY_TOTAL}.`
          : ignoredFilter
            ? `The narrowed report printed the whole month (${MAY_UNFILTERED_TOTAL}); the category was ignored.`
            : `The narrowed report did not total ${PROBE_CATEGORY_TOTAL} (exit ${narrowed.exitCode}).`,
        narrowed,
      ),
    );

    const legacy = await inTracker("bun run cli.ts report month 2025-03");
    const legacyOk =
      legacy.exitCode === 0 && legacy.stdout.includes(MARCH_2025_TOTAL);
    checks.push(
      record(
        CHECK_LEGACY,
        legacyOk,
        legacyOk
          ? `March still totals ${MARCH_2025_TOTAL} alongside the categorized entries.`
          : `March no longer totals ${MARCH_2025_TOTAL} (exit ${legacy.exitCode}); entries saved without a category were dropped or miscounted.`,
        legacy,
      ),
    );

    const list = await inTracker("bun run cli.ts list");
    const listOk = list.exitCode === 0 && list.stdout.includes(PROBE_CATEGORY);
    checks.push(
      record(
        CHECK_LISTING,
        listOk,
        listOk
          ? `The listing shows the ${PROBE_CATEGORY} category.`
          : `The listing never mentions ${PROBE_CATEGORY} (exit ${list.exitCode}).`,
        list,
      ),
    );

    if (!overrideHonored) {
      const detail =
        `The data-path override was not honored, so the probe expenses landed in the user's live data instead of the copy ` +
        `(${liveFileRestored === true ? "restored by this metric" : "NOT restored: the write-back failed"}); the category commands were exercised against the wrong file.`;
      for (const check of checks) {
        if (!PROBE_DERIVED_CHECKS.has(check.check)) {
          continue;
        }
        check.passed = false;
        check.detail = detail;
      }
    }
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) {
      throw err;
    }
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot exercise the category commands.",
    };
  }

  const failed = checks.filter((check) => !check.passed);
  return {
    name: METRIC_NAME,
    score: (checks.length - failed.length) / checks.length,
    reason:
      failed.length === 0
        ? `Categories work across all ${checks.length} checks.`
        : `${failed.length} of ${checks.length} category checks failed: ${failed
            .map((check) => check.detail)
            .join(" ")}`,
    metadata: {
      checks,
      overrideHonored,
      probesReachedCopy,
      ...(liveFileRestored === undefined ? {} : { liveFileRestored }),
    },
  };
}
