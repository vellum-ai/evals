import { mentionsStandaloneNumber } from "../../../../../src/lib/common-metrics/number-mention";
import { classifyScopeMentions } from "../../../../../src/lib/common-metrics/scope-mentions";
import type { MetricInput, MetricResult } from "../../../../../src/lib/metrics";
import { readDeliverable } from "../../../../../src/lib/common-metrics/workspace-deliverable";
import {
  DATE_EXCLUDED_OVERCHARGES,
  MEMO_PATH,
  OVERCHARGING_VENDORS,
  TOTAL_OVERCHARGE_EUR,
  VENDOR_EXCLUDED_OVERCHARGERS,
} from "../constants";

const METRIC_NAME = "audit-correct";

/**
 * The euro total as a standalone number: €357, 357.00, and the
 * decimal-comma spelling 357,00 all match; 357.5 and 3570 do not (the
 * hand-rolled `\b` matcher held its boundary before "." and let a
 * different decimal count).
 */
function mentionsAmount(text: string, amount: number): boolean {
  return mentionsStandaloneNumber(text, amount, { decimalComma: true });
}

/**
 * Is the memo right — and right for the right reasons?
 *
 * Four checks, equally weighted:
 *   1. every in-scope overcharger is named
 *   2. the recoverable total is €357
 *   3. no out-of-scope overcharger is REPORTED as a finding
 *   4. the memo exists where it was asked for
 *
 * (3) is what makes this more than an arithmetic check. The fixtures
 * plant one trap per conversation-only constraint — Halberd (excluded by
 * vendor), Bracken Labs and Wrenfield Legal (excluded by date) — all of
 * which look like findings if you only read the files. Presenting any of
 * them as an overcharge means a constraint was lost somewhere between
 * the user and the work, whether or not a subagent was involved.
 *
 * Naming one to say it was EXCLUDED is the opposite signal, and scores
 * clean: "the pre-March items (Bracken Labs, Wrenfield Legal) were
 * excluded as you specified" is a memo showing its work, not one that
 * lost the cutoff. A first pod run scored exactly that memo 0.75 on a
 * bare substring match, which is what {@link classifyScopeMentions} is
 * for.
 */
export default async function scoreAuditCorrect(
  input: MetricInput,
): Promise<MetricResult> {
  const read = await readDeliverable(METRIC_NAME, input.runId, MEMO_PATH, {
    noun: "memo",
  });
  if (!read.ok) return read.result;
  const memo = read.content;

  const haystack = memo.toLowerCase();
  const named = OVERCHARGING_VENDORS.filter((v) =>
    haystack.includes(v.toLowerCase()),
  );
  // Halberd is out of scope as a VENDOR, so any finding about it is a
  // lost constraint. The other two are in-scope vendors hiding an
  // out-of-scope invoice, so only a claim on that money is.
  const byVendor = classifyScopeMentions(memo, VENDOR_EXCLUDED_OVERCHARGERS);
  const byDate = classifyScopeMentions(
    memo,
    Object.keys(DATE_EXCLUDED_OVERCHARGES),
    { requireAmount: true, amounts: DATE_EXCLUDED_OVERCHARGES },
  );
  const reported = [...byVendor.reported, ...byDate.reported];
  const cleared = [...byVendor.cleared, ...byDate.cleared];
  const checks: Record<string, boolean> = {
    memoExists: true,
    allOverchargersNamed: named.length === OVERCHARGING_VENDORS.length,
    totalCorrect: mentionsAmount(memo, TOTAL_OVERCHARGE_EUR),
    noOutOfScopeFindings: reported.length === 0,
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
  if (!checks.noOutOfScopeFindings) {
    faults.push(
      `claimed out-of-scope ${reported.join(", ")} as findings — a constraint was lost`,
    );
  }

  const cleanReason =
    cleared.length === 0
      ? `Memo names all three in-scope overchargers and €${TOTAL_OVERCHARGE_EUR} recoverable, with no out-of-scope claims.`
      : `Memo names all three in-scope overchargers and €${TOTAL_OVERCHARGE_EUR} recoverable; ${cleared.join(", ")} mentioned without claiming out-of-scope money.`;

  return {
    name: METRIC_NAME,
    score: passed.length / names.length,
    reason: faults.length === 0 ? cleanReason : `Memo ${faults.join("; ")}.`,
    metadata: {
      named,
      reported,
      cleared,
      outOfScopeMentions: [...byVendor.mentions, ...byDate.mentions],
      checks,
    },
  };
}
