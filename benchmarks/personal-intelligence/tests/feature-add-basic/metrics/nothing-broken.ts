import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  ASSISTANT_WORKSPACE_DIR,
  AssistantContainerUnavailableError,
  execInAssistantContainer,
} from "../../../../../src/lib/vellum-artifacts";
import {
  EXPECTED_OUTPUTS,
  readExpectedOutput,
  TRACKER_DIR,
  type ExpectedOutputName,
} from "../constants";

const METRIC_NAME = "nothing-broken";
const TRACKER_PATH = `${ASSISTANT_WORKSPACE_DIR}/${TRACKER_DIR}`;
const CAP = 400;

interface CheckResult {
  check: string;
  passed: boolean;
  exitCode: number;
  actual: string;
  expected?: string;
}

/**
 * Did the new year view cost the user anything they already had? The
 * three commands that shipped with the project print exactly what the
 * committed fixture prints, and the project's own tests still pass.
 *
 * Exact stdout matching is right for this case: the user asked for one
 * more report, so the existing commands have no reason to change shape.
 * Read-only by construction: every command reports or tests, none writes
 * the data file, so the metric can run alongside `feature-works`.
 */
export default async function scoreNothingBroken(
  input: MetricInput,
): Promise<MetricResult> {
  const checks: CheckResult[] = [];
  try {
    for (const [name, spec] of Object.entries(EXPECTED_OUTPUTS)) {
      const command = `bun run cli.ts ${spec.args.join(" ")}`;
      const run = await execInAssistantContainer(input.runId, [
        "sh",
        "-lc",
        `cd ${TRACKER_PATH} && ${command}`,
      ]);
      const actual = run.stdout.trim();
      const expected = readExpectedOutput(name as ExpectedOutputName);
      const passed = run.exitCode === 0 && actual === expected;
      checks.push({
        check: command,
        passed,
        exitCode: run.exitCode,
        actual: actual.slice(0, CAP),
        expected: passed ? undefined : expected.slice(0, CAP),
      });
    }

    const tests = await execInAssistantContainer(input.runId, [
      "sh",
      "-lc",
      `cd ${TRACKER_PATH} && bun test src`,
    ]);
    checks.push({
      check: "bun test src",
      passed: tests.exitCode === 0,
      exitCode: tests.exitCode,
      actual: `${tests.stdout}\n${tests.stderr}`.trim().slice(0, CAP),
    });
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
        ? `All ${checks.length} pre-existing commands and tests still behave exactly as before.`
        : `${failed.length} of ${checks.length} pre-existing checks regressed: ${failed
            .map((check) => check.check)
            .join(", ")}.`,
    metadata: { checks },
  };
}
