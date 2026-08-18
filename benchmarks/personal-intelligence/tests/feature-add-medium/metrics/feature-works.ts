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
  PROBE_GRAND_TOTAL,
  TRACKER_DIR,
} from "../constants";

const METRIC_NAME = "feature-works";
const TRACKER_PATH = `${ASSISTANT_WORKSPACE_DIR}/${TRACKER_DIR}`;
const DATA_FILE = `${TRACKER_PATH}/data/expenses.json`;

/**
 * Where the probes run: a copy of the whole project, not just of its data
 * file. Metrics run concurrently, so probe expenses must not reach the
 * data `nothing-broken` is reading. Copying the project (rather than
 * pointing the app at a copied data file through `EXPENSES_FILE`) is what
 * makes that hold whatever the run did to the code: the shipped storage
 * resolves its data file from the project root, so a copy carries its own
 * data with it, and a run that dropped the env override — which the user
 * never asked about — is isolated just the same.
 */
const PROBE_TRACKER = "/tmp/feature-works-medium-tracker";
const CAP = 400;

/** Description of the first probe expense, the marker of a probe write. */
const PROBE_DESCRIPTION = "coffee beans";

const CHECK_ADD = "add with a category";
const CHECK_NARROWED_MONTH = "month report narrowed to one category";
const CHECK_NARROWED_TOTAL = "total report narrowed to one category";
const CHECK_LEGACY = "uncategorized entries still counted";
const CHECK_LISTING = "category shown in the listing";

/** The checks whose verdict rests on the probe writes staying isolated. */
const PROBE_DERIVED_CHECKS = new Set([
  CHECK_ADD,
  CHECK_NARROWED_MONTH,
  CHECK_NARROWED_TOTAL,
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
 * expenses under different categories, then read them back the five ways
 * the user asked for. This asserts on executable state the transcript
 * can't spoof.
 *
 * Everything happens in a copy of the project, so the spending the user
 * keeps is untouched and `nothing-broken` can read it concurrently. The
 * live data file is still compared against a baseline afterwards and put
 * back if it moved: a run that hardcoded an absolute data path would
 * write through the copy, and the checks that rest on the probes cannot
 * be believed when it did.
 */
export default async function scoreFeatureWorks(
  input: MetricInput,
): Promise<MetricResult> {
  const checks: CheckResult[] = [];
  let liveDataUntouched = true;
  let liveFileRestored: boolean | undefined;
  try {
    const readLiveFile = (): Promise<ContainerExecResult> =>
      execInAssistantContainer(input.runId, ["sh", "-lc", `cat ${DATA_FILE}`]);

    const copy = await execInAssistantContainer(input.runId, [
      "sh",
      "-lc",
      `rm -rf ${PROBE_TRACKER} && cp -r ${TRACKER_PATH} ${PROBE_TRACKER}`,
    ]);
    if (copy.exitCode !== 0) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason: `Could not copy ${TRACKER_PATH} (exit ${copy.exitCode}); the project is no longer where it was, so the feature cannot be exercised without touching live state.`,
        metadata: { stderr: copy.stderr.trim().slice(0, CAP) },
      };
    }

    const baseline = await readLiveFile();
    if (baseline.exitCode !== 0) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason: `Could not read ${DATA_FILE} (exit ${baseline.exitCode}); without a baseline a run that writes outside its project cannot be told apart from one that does not.`,
        metadata: { stderr: baseline.stderr.trim().slice(0, CAP) },
      };
    }

    const inProbe = (command: string): Promise<ContainerExecResult> =>
      execInAssistantContainer(input.runId, [
        "sh",
        "-lc",
        `cd ${PROBE_TRACKER} && ${command}`,
      ]);

    const addFood = await inProbe(
      `bun run cli.ts add 2025-05-02 18.25 "${PROBE_DESCRIPTION}" ${PROBE_CATEGORY}`,
    );
    const addFun = await inProbe(
      'bun run cli.ts add 2025-05-03 30.00 "movie night" fun',
    );

    const afterAdds = await readLiveFile();
    liveDataUntouched =
      afterAdds.exitCode === 0 && afterAdds.stdout === baseline.stdout;
    if (!liveDataUntouched) {
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

    const narrowedMonth = await inProbe(
      `bun run cli.ts report month 2025-05 ${PROBE_CATEGORY}`,
    );
    const monthIgnoredFilter =
      narrowedMonth.stdout.includes(MAY_UNFILTERED_TOTAL);
    const narrowedMonthOk =
      narrowedMonth.exitCode === 0 &&
      narrowedMonth.stdout.includes(PROBE_CATEGORY_TOTAL) &&
      !monthIgnoredFilter;
    checks.push(
      record(
        CHECK_NARROWED_MONTH,
        narrowedMonthOk,
        narrowedMonthOk
          ? `A May report narrowed to ${PROBE_CATEGORY} totals ${PROBE_CATEGORY_TOTAL}.`
          : monthIgnoredFilter
            ? `The narrowed month report printed the whole month (${MAY_UNFILTERED_TOTAL}); the category was ignored.`
            : `The narrowed month report did not total ${PROBE_CATEGORY_TOTAL} (exit ${narrowedMonth.exitCode}).`,
        narrowedMonth,
      ),
    );

    // The user asked for the category on the end of any report, naming
    // `report total food` as well as the month one, so a run that
    // narrowed only the month has not finished the job.
    const narrowedTotal = await inProbe(
      `bun run cli.ts report total ${PROBE_CATEGORY}`,
    );
    const totalIgnoredFilter = narrowedTotal.stdout.includes(PROBE_GRAND_TOTAL);
    const narrowedTotalOk =
      narrowedTotal.exitCode === 0 &&
      narrowedTotal.stdout.includes(PROBE_CATEGORY_TOTAL) &&
      !totalIgnoredFilter;
    checks.push(
      record(
        CHECK_NARROWED_TOTAL,
        narrowedTotalOk,
        narrowedTotalOk
          ? `A total narrowed to ${PROBE_CATEGORY} totals ${PROBE_CATEGORY_TOTAL}.`
          : totalIgnoredFilter
            ? `The narrowed total printed every expense (${PROBE_GRAND_TOTAL}); the category was ignored.`
            : `The narrowed total did not come to ${PROBE_CATEGORY_TOTAL} (exit ${narrowedTotal.exitCode}); only the month report learned about categories.`,
        narrowedTotal,
      ),
    );

    const legacy = await inProbe("bun run cli.ts report month 2025-03");
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

    const list = await inProbe("bun run cli.ts list");
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

    if (!liveDataUntouched) {
      const detail =
        `The probes were filed in a copy of the project, but the spending the user keeps changed anyway, so the run writes to a hardcoded path outside its own project ` +
        `(${liveFileRestored === true ? "restored by this metric" : "NOT restored: the write-back failed"}); the category commands were exercised against data this metric cannot vouch for.`;
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
      liveDataUntouched,
      ...(liveFileRestored === undefined ? {} : { liveFileRestored }),
    },
  };
}
