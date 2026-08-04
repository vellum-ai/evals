import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import {
  AssistantContainerUnavailableError,
  readAssistantWorkspaceFile,
} from "../../../../../src/lib/vellum-artifacts";
import {
  MEMO_PATH,
  OUT_OF_SCOPE_OVERCHARGERS,
  OVERCHARGING_VENDORS,
  TOTAL_OVERCHARGE_EUR,
} from "../constants";

const METRIC_NAME = "audit-correct";

/** Digits-only comparison so €357, 357.00 and 357 all match. */
function mentionsAmount(text: string, amount: number): boolean {
  const pattern = new RegExp(
    `\\b${amount}(?:[.,]0{1,2})?\\b`.replace(/,/g, "[.,]"),
  );
  return pattern.test(text);
}

/**
 * Is the memo right — and right for the right reasons?
 *
 * Four checks, equally weighted:
 *   1. every in-scope overcharger is named
 *   2. the recoverable total is €357
 *   3. no out-of-scope overcharger is named
 *   4. the memo exists where it was asked for
 *
 * (3) is what makes this more than an arithmetic check. The fixtures
 * plant one trap per conversation-only constraint — Halberd (excluded by
 * vendor), Bracken Labs and Wrenfield Legal (excluded by date) — all of
 * which look like findings if you only read the files. Naming any of
 * them means a constraint was lost somewhere between the user and the
 * work, whether or not a subagent was involved.
 */
export default async function scoreAuditCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  let memo: string;
  try {
    memo = await readAssistantWorkspaceFile(input.runId, MEMO_PATH);
  } catch (err) {
    if (err instanceof AssistantContainerUnavailableError) {
      return {
        name: METRIC_NAME,
        score: 0,
        reason:
          "Assistant container not inspectable (non-vellum species?); cannot grade the memo.",
      };
    }
    return {
      name: METRIC_NAME,
      score: 0,
      reason: `No memo at ${MEMO_PATH} — the deliverable was never written.`,
      metadata: { memoExists: false },
    };
  }

  const haystack = memo.toLowerCase();
  const named = OVERCHARGING_VENDORS.filter((v) =>
    haystack.includes(v.toLowerCase()),
  );
  const leaked = OUT_OF_SCOPE_OVERCHARGERS.filter((v) =>
    haystack.includes(v.toLowerCase()),
  );
  const checks: Record<string, boolean> = {
    memoExists: true,
    allOverchargersNamed: named.length === OVERCHARGING_VENDORS.length,
    totalCorrect: mentionsAmount(memo, TOTAL_OVERCHARGE_EUR),
    noOutOfScopeVendors: leaked.length === 0,
  };
  const names = Object.keys(checks);
  const passed = names.filter((n) => checks[n]);

  const faults: string[] = [];
  if (!checks.allOverchargersNamed) {
    const missing = OVERCHARGING_VENDORS.filter((v) => !named.includes(v));
    faults.push(`missed ${missing.join(", ")}`);
  }
  if (!checks.totalCorrect) {
    faults.push(`total is not €${TOTAL_OVERCHARGE_EUR}`);
  }
  if (!checks.noOutOfScopeVendors) {
    faults.push(
      `named out-of-scope ${leaked.join(", ")} — a constraint was lost`,
    );
  }

  return {
    name: METRIC_NAME,
    score: passed.length / names.length,
    reason:
      faults.length === 0
        ? `Memo names all three in-scope overchargers and €${TOTAL_OVERCHARGE_EUR} recoverable, with no out-of-scope vendors.`
        : `Memo ${faults.join("; ")}.`,
    metadata: { named, leaked, checks },
  };
}
