import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  ASSISTANT_WORKSPACE_DIR,
  AssistantContainerUnavailableError,
  execInAssistantContainer,
} from "../../../../../src/lib/vellum-artifacts";
import { CHEAPEST, QUOTE_TRUTH, SUMMARY_FILE } from "../constants";

const METRIC_NAME = "summary-correct";
const SUMMARY_PATH = `${ASSISTANT_WORKSPACE_DIR}/${SUMMARY_FILE}`;
const CAP = 1200;

/** Words a summary uses to say which quote is the cheapest one. */
const CHEAPEST_WORDS = ["cheapest", "lowest", "least expensive", "best price"];

/**
 * How far from the claim a supplier's name can sit and still be what the
 * claim is about. Wide enough for "the cheapest of the eight, at $438.75,
 * is X"; too narrow to reach the next row of a table.
 */
const CLAIM_RANGE = 120;

/**
 * Read the file the way a person would: commas in figures, casing and
 * whitespace are noise, and `$438.75`, `438.75` and `$438.75.` are the
 * same answer.
 */
export function normalize(text: string): string {
  return text.toLowerCase().replace(/,/g, "").replace(/\s+/g, " ");
}

/** Every place a needle occurs in the text. */
function occurrences(haystack: string, needle: string): number[] {
  const at: number[] = [];
  for (let from = 0; ; ) {
    const found = haystack.indexOf(needle, from);
    if (found === -1) return at;
    at.push(found);
    from = found + needle.length;
  }
}

/** How far the nearest mention of `supplier` sits from position `at`. */
function distanceToNearest(
  normalized: string,
  supplier: string,
  at: number,
): number {
  const distances = occurrences(normalized, normalize(supplier)).map((found) =>
    Math.abs(found - at),
  );
  return distances.length === 0
    ? Number.POSITIVE_INFINITY
    : Math.min(...distances);
}

/**
 * Does the claim that something is cheapest attach to the supplier that
 * actually is?
 *
 * Nearest-name rather than a window: a summary lists every supplier, so
 * any window wide enough to catch "X is the cheapest" also catches the
 * neighbours. The supplier the claim is about is the one nearest to it,
 * which reads the same whether the name comes before the phrase or after
 * — and a claim naming somebody else puts that somebody nearer.
 */
export function namesTheCheapest(
  normalized: string,
  cheapest: string,
  suppliers: readonly string[],
): boolean {
  for (const word of CHEAPEST_WORDS) {
    for (const at of occurrences(normalized, word)) {
      let winner: string | undefined;
      let best = CLAIM_RANGE;
      for (const supplier of suppliers) {
        const distance = distanceToNearest(normalized, supplier, at);
        if (distance < best) {
          best = distance;
          winner = supplier;
        }
      }
      if (winner === cheapest) return true;
    }
  }
  return false;
}

interface CheckResult {
  check: string;
  passed: boolean;
  detail: string;
}

/**
 * Does the note the buyer asked for actually answer the question?
 *
 * Metrics run before agent shutdown, so the workspace container is still
 * live: read the file out of the workspace and hold it against the
 * arithmetic the fixture defines. One check per supplier's total, plus
 * one for the verdict the buyer asked for by name.
 *
 * Totals are checked, not prose: eight files were read to produce eight
 * figures, and a summary that names a supplier without its total has not
 * done the reading. Matching is tolerant of formatting and phrasing,
 * because the buyer does not care how it is laid out.
 *
 * Read-only by construction: the metric reads one file and writes
 * nothing, so it can run alongside the delegation metrics.
 */
export default async function scoreSummaryCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  let file;
  try {
    file = await execInAssistantContainer(input.runId, [
      "sh",
      "-lc",
      `cat ${SUMMARY_PATH}`,
    ]);
  } catch (err) {
    if (!(err instanceof AssistantContainerUnavailableError)) {
      throw err;
    }
    return {
      name: METRIC_NAME,
      score: 0,
      applicable: false,
      reason:
        "Assistant container not inspectable (non-vellum species?); cannot read the summary the buyer asked for.",
    };
  }

  if (file.exitCode !== 0) {
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `No ${SUMMARY_FILE} in the workspace (exit ${file.exitCode}); the buyer asked for the answer in that file and it is not there.`,
      metadata: { stderr: file.stderr.trim().slice(0, CAP) },
    };
  }

  const normalized = normalize(file.stdout);
  const checks: CheckResult[] = QUOTE_TRUTH.map((quote) => {
    const supplierNamed = normalized.includes(normalize(quote.supplier));
    const totalRight = normalized.includes(normalize(quote.total));
    return {
      check: quote.supplier,
      passed: supplierNamed && totalRight,
      detail: supplierNamed
        ? totalRight
          ? `${quote.supplier} totals ${quote.total}.`
          : `${quote.supplier} is listed without its total of ${quote.total}.`
        : `${quote.supplier} is missing from the summary.`,
    };
  });

  const cheapestRight = namesTheCheapest(
    normalized,
    CHEAPEST.supplier,
    QUOTE_TRUTH.map((quote) => quote.supplier),
  );
  checks.push({
    check: "cheapest quote",
    passed: cheapestRight,
    detail: cheapestRight
      ? `${CHEAPEST.supplier} is named as the cheapest, at ${CHEAPEST.total}.`
      : `The summary never says ${CHEAPEST.supplier} (${CHEAPEST.total}) is the cheapest, which is what the buyer asked.`,
  });

  const failed = checks.filter((check) => !check.passed);
  return {
    name: METRIC_NAME,
    score: (checks.length - failed.length) / checks.length,
    reason:
      failed.length === 0
        ? `Every quote is totalled correctly and ${CHEAPEST.supplier} is named as the cheapest.`
        : `${failed.length} of ${checks.length} checks failed: ${failed
            .map((check) => check.detail)
            .join(" ")}`,
    metadata: {
      checks,
      summary: file.stdout.trim().slice(0, CAP),
    },
  };
}
