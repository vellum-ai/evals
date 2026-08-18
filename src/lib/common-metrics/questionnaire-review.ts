/**
 * Shared scorer for the vendor-questionnaire cases: did the review
 * answer the two questions the user asked, for every vendor?
 *
 * Both the eight-document case and the twenty-four-document probe read
 * the same fixture shape and the same requested line format, so the
 * reading and the grading live here and the cases supply only their own
 * vendor list and output file.
 *
 * The answers sit under about a hundred and thirty lines of identical
 * boilerplate per vendor, so a run that skimmed instead of reading gets
 * them wrong. That is deliberate: it keeps "did the work" and "delegated
 * the work" independent, which is the whole point of pairing this metric
 * with `spawn-restraint`.
 */

import type { MetricInput, MetricResult, MetricScorer } from "../metrics";
import {
  ASSISTANT_WORKSPACE_DIR,
  AssistantContainerUnavailableError,
  execInAssistantContainer,
} from "../vellum-artifacts";

const CAP = 2000;

/** What a correct review says about one vendor. */
export interface ReviewedVendor {
  vendor: string;
  encryptsAtRest: boolean;
  soc2: boolean;
}

export interface QuestionnaireReviewOptions {
  /** Workspace-relative file the user asked for, e.g. `vendor-review.md`. */
  file: string;
  /** The vendors that must appear, with the answers their files carry. */
  vendors: readonly ReviewedVendor[];
  /** Metric name; defaults to `review-correct`. */
  name?: string;
}

/**
 * The verdict a line carries for one labelled question, or undefined
 * when the line does not answer it.
 *
 * The user asked for a fixed shape — `at rest: yes`, `SOC 2: no` — so
 * the reading stays literal. Markdown decoration between the label and
 * the answer (`**at rest:** yes`) is allowed for; anything looser is a
 * line that did not answer the question, which is a real failure rather
 * than a parsing problem to work around.
 */
export function readVerdict(line: string, label: string): boolean | undefined {
  const pattern = new RegExp(
    `${label}\\s*[:\\-—]*\\s*[*_\`]*\\s*(yes|no)\\b`,
    "i",
  );
  const found = pattern.exec(line);
  if (found === null) return undefined;
  return found[1].toLowerCase() === "yes";
}

/**
 * The line of the review that speaks about this vendor, if any.
 *
 * Longest name first at the call site: with cohort names like "Arbor
 * Analytics Systems" in play, a search for "Arbor Analytics" would match
 * the cohort's line too, so the caller resolves the more specific name
 * before the shorter one.
 */
export function lineFor(text: string, vendor: string): string | undefined {
  const needle = vendor.toLowerCase();
  return text.split("\n").find((line) => line.toLowerCase().includes(needle));
}

interface CheckResult {
  check: string;
  passed: boolean;
  detail: string;
}

/**
 * Grade one review's text against the answer key. Pure, so the reading
 * rules are testable without a container.
 */
export function scoreReviewText(
  text: string,
  vendors: readonly ReviewedVendor[],
): { checks: CheckResult[]; score: number } {
  // Claim each line for the most specific vendor name that matches, so a
  // cohort line ("Arbor Analytics Systems") is not read as the answer for
  // its shorter namesake.
  const byLength = [...vendors].sort(
    (a, b) => b.vendor.length - a.vendor.length,
  );
  const claimed = new Map<string, string>();
  const taken = new Set<string>();
  for (const vendor of byLength) {
    const line = text
      .split("\n")
      .find(
        (candidate) =>
          !taken.has(candidate) &&
          candidate.toLowerCase().includes(vendor.vendor.toLowerCase()),
      );
    if (line !== undefined) {
      claimed.set(vendor.vendor, line);
      taken.add(line);
    }
  }

  const checks: CheckResult[] = vendors.map((vendor) => {
    const line = claimed.get(vendor.vendor);
    if (line === undefined) {
      return {
        check: vendor.vendor,
        passed: false,
        detail: `${vendor.vendor} is missing from the review.`,
      };
    }
    const atRest = readVerdict(line, "at rest");
    const soc2 = readVerdict(line, "soc ?2");
    const passed = atRest === vendor.encryptsAtRest && soc2 === vendor.soc2;
    return {
      check: vendor.vendor,
      passed,
      detail: passed
        ? `${vendor.vendor}: at rest ${vendor.encryptsAtRest ? "yes" : "no"}, SOC 2 ${vendor.soc2 ? "yes" : "no"} — both right.`
        : `${vendor.vendor}: read at rest=${atRest ?? "unanswered"}, SOC 2=${soc2 ?? "unanswered"}; the questionnaire says ${vendor.encryptsAtRest ? "yes" : "no"} and ${vendor.soc2 ? "yes" : "no"}.`,
    };
  });

  const failed = checks.filter((check) => !check.passed).length;
  return { checks, score: (checks.length - failed) / checks.length };
}

/**
 * Build the scorer a case's `metrics/` directory default-exports: read
 * the review out of the still-live workspace, then grade it.
 */
export function makeQuestionnaireReviewMetric(
  options: QuestionnaireReviewOptions,
): MetricScorer {
  const name = options.name ?? "review-correct";
  const path = `${ASSISTANT_WORKSPACE_DIR}/${options.file}`;

  return async function scoreReviewCorrect(
    input: MetricInput,
  ): Promise<MetricResult> {
    let file;
    try {
      file = await execInAssistantContainer(input.runId, [
        "sh",
        "-lc",
        `cat ${path}`,
      ]);
    } catch (err) {
      if (!(err instanceof AssistantContainerUnavailableError)) {
        throw err;
      }
      return {
        name,
        score: 0,
        applicable: false,
        reason:
          "Assistant container not inspectable (non-vellum species?); cannot read the review.",
      };
    }

    if (file.exitCode !== 0) {
      return {
        name,
        score: 0,
        reason: `No ${options.file} in the workspace (exit ${file.exitCode}); the review was asked for in that file and it is not there.`,
        metadata: { stderr: file.stderr.trim().slice(0, CAP) },
      };
    }

    const { checks, score } = scoreReviewText(file.stdout, options.vendors);
    const failed = checks.filter((check) => !check.passed);
    return {
      name,
      score,
      reason:
        failed.length === 0
          ? `All ${checks.length} vendors are reviewed with the right answers.`
          : `${failed.length} of ${checks.length} vendors are wrong or missing: ${failed
              .slice(0, 6)
              .map((check) => check.detail)
              .join(" ")}`,
      metadata: { checks, review: file.stdout.trim().slice(0, CAP) },
    };
  };
}
