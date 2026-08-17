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
 * Pointing the commands at another file is pre-existing storage behavior
 * covered by the project's own tests, so a run that breaks the override
 * fails `nothing-broken` on those tests anyway.
 */
const COPY_FILE = "/tmp/feature-works-medium.json";
const ENV = `EXPENSES_FILE=${COPY_FILE}`;
const CAP = 400;

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
 */
export default async function scoreFeatureWorks(
  input: MetricInput,
): Promise<MetricResult> {
  const checks: CheckResult[] = [];
  try {
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

    const inTracker = (command: string): Promise<ContainerExecResult> =>
      execInAssistantContainer(input.runId, [
        "sh",
        "-lc",
        `cd ${TRACKER_PATH} && ${ENV} ${command}`,
      ]);

    const addFood = await inTracker(
      `bun run cli.ts add 2025-05-02 18.25 "coffee beans" ${PROBE_CATEGORY}`,
    );
    const addFun = await inTracker(
      'bun run cli.ts add 2025-05-03 30.00 "movie night" fun',
    );
    const addsAccepted = addFood.exitCode === 0 && addFun.exitCode === 0;
    checks.push(
      record(
        "add with a category",
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
        "report narrowed to one category",
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
        "uncategorized entries still counted",
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
        "category shown in the listing",
        listOk,
        listOk
          ? `The listing shows the ${PROBE_CATEGORY} category.`
          : `The listing never mentions ${PROBE_CATEGORY} (exit ${list.exitCode}).`,
        list,
      ),
    );
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
    metadata: { checks },
  };
}
