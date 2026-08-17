import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  ASSISTANT_WORKSPACE_DIR,
  AssistantContainerUnavailableError,
  execInAssistantContainer,
  type ContainerExecResult,
} from "../../../../../src/lib/vellum-artifacts";
import { GRAND_TOTAL, MARCH_2025_TOTAL, TRACKER_DIR } from "../constants";

const METRIC_NAME = "nothing-broken";
const TRACKER_PATH = `${ASSISTANT_WORKSPACE_DIR}/${TRACKER_DIR}`;
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
 * Did categories cost the user anything they already had? The checks are
 * totals and exit codes, not exact output: the feature the user asked for
 * legitimately reformats the listing (they want the category in it) and
 * may reformat the reports around a category column, so byte-matching
 * committed output would score good work as a regression. What must
 * survive is the arithmetic over entries saved before categories existed,
 * and the project's own tests.
 *
 * Read-only by construction: every command reports, lists, or tests, none
 * writes the data file, so the metric can run alongside `feature-works`
 * (which works on a copy for the same reason).
 */
export default async function scoreNothingBroken(
  input: MetricInput,
): Promise<MetricResult> {
  const checks: CheckResult[] = [];
  try {
    const inTracker = (command: string): Promise<ContainerExecResult> =>
      execInAssistantContainer(input.runId, [
        "sh",
        "-lc",
        `cd ${TRACKER_PATH} && ${command}`,
      ]);

    const month = await inTracker("bun run cli.ts report month 2025-03");
    const monthOk =
      month.exitCode === 0 && month.stdout.includes(MARCH_2025_TOTAL);
    checks.push(
      record(
        "report month 2025-03",
        monthOk,
        monthOk
          ? `March still totals ${MARCH_2025_TOTAL}.`
          : `March no longer totals ${MARCH_2025_TOTAL} (exit ${month.exitCode}).`,
        month,
      ),
    );

    const total = await inTracker("bun run cli.ts report total");
    const totalOk = total.exitCode === 0 && total.stdout.includes(GRAND_TOTAL);
    checks.push(
      record(
        "report total",
        totalOk,
        totalOk
          ? `Every expense still totals ${GRAND_TOTAL}.`
          : `The grand total is no longer ${GRAND_TOTAL} (exit ${total.exitCode}).`,
        total,
      ),
    );

    const list = await inTracker("bun run cli.ts list");
    const listOk = list.exitCode === 0 && list.stdout.trim() !== "";
    checks.push(
      record(
        "list",
        listOk,
        listOk
          ? "The listing still runs and prints the expenses."
          : `The listing printed nothing usable (exit ${list.exitCode}).`,
        list,
      ),
    );

    const tests = await inTracker("bun test src");
    checks.push(
      record(
        "bun test src",
        tests.exitCode === 0,
        tests.exitCode === 0
          ? "The project's own tests still pass."
          : `The project's own tests fail (exit ${tests.exitCode}).`,
        tests,
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
        "Assistant container not inspectable (non-vellum species?); cannot re-run the pre-existing commands and tests.",
    };
  }

  const failed = checks.filter((check) => !check.passed);
  return {
    name: METRIC_NAME,
    score: (checks.length - failed.length) / checks.length,
    reason:
      failed.length === 0
        ? `All ${checks.length} pre-existing behaviors survived the change.`
        : `${failed.length} of ${checks.length} pre-existing checks regressed: ${failed
            .map((check) => check.detail)
            .join(" ")}`,
    metadata: { checks },
  };
}
