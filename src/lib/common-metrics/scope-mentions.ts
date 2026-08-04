/**
 * Shared policy for "did the deliverable REPORT an out-of-scope item, or
 * merely mention it?"
 *
 * A substring search cannot tell the two apart, and the difference is the
 * whole measurement. Two pod runs of contractor-invoice-audit-brief each
 * scored a fully correct memo 0.75 on a bare `includes()`, for two
 * different reasons:
 *
 *   "the pre-March items (Bracken Labs, Wrenfield Legal) were excluded
 *    as you specified"          — naming them to prove the cutoff held
 *
 *   "Wrenfield Legal's in-scope invoice (2026-03-27) was at agreed rate
 *    and is clean."             — a correct finding about an IN-scope
 *                                 invoice belonging to a vendor whose
 *                                 OTHER invoice is out of scope
 *
 * Both are memos showing their work. So a mention is read as a finding
 * only when nothing clears it, and three things clear it:
 *
 *   1. exclusion framing in context — the mention's own line, the prose
 *      lead-in above the list or table it sits in, or the nearest
 *      heading above it. That covers an inline aside, a bulleted
 *      "Excluded from the total:" block, and a dedicated section.
 *   2. all-clear framing on its own line — "clean", "at agreed rate",
 *      "billed correctly". A memo saying a vendor owes nothing is not
 *      claiming that it does.
 *   3. under {@link ScopeMentionOptions.requireAmount}, the absence of
 *      any monetary claim on the line. Use this for names that are only
 *      PARTLY out of scope, where discussing the name is legitimate and
 *      only asserting the excluded money is the error.
 *
 * This is deliberately generous: framing is easier to fake than
 * arithmetic. It is not the only check standing between a dropped
 * constraint and a passing score — an audit that actually counted an
 * out-of-scope amount also lands on the wrong total, and the total is
 * scored separately.
 */

/**
 * Language that frames a nearby mention as excluded rather than found.
 *
 * Includes the exclusion *rationales* from this suite's scenarios
 * ("separate retainer", "pre-renewal") alongside the generic verbs,
 * because memos tend to give the reason rather than repeat the word.
 */
const EXCLUSION_CUE = new RegExp(
  [
    "exclud\\w*", // excluded, excluding, exclusion
    "omitt?\\w*", // omit, omitted, omitting
    "skipp?\\w*", // skip, skipped, skipping
    "ignor\\w*",
    "disregard\\w*",
    "left out",
    "leaving out",
    "not counted",
    "not included",
    "not in the total",
    "does not count",
    "doesn't count",
    "not in scope",
    "out of scope",
    "out-of-scope",
    "outside (?:the )?scope",
    "not recoverable",
    "separate retainer",
    "retainer",
    "pre-?renewal",
    "pre-?march",
    "before the renewal",
    "prior to the renewal",
    "as you (?:specified|asked|instructed|requested)",
    "per your (?:instruction|instructions|request)",
    "for reference only",
    "reference only",
    "informational",
  ].join("|"),
  "i",
);

/**
 * Language asserting there is nothing to recover. Checked on the
 * mention's own line only — unlike an exclusion, an all-clear is a
 * per-row verdict and does not govern the rows beneath it.
 */
const CLEAN_CUE = new RegExp(
  [
    "\\bclean\\b",
    "\\bclear\\b",
    "no overcharge\\w*",
    "not overcharg\\w*",
    "no excess",
    "no discrepanc\\w*",
    "no variance",
    "at (?:the )?agreed rate",
    "at rate",
    "matches (?:the )?agreed",
    "within (?:the )?agreed",
    "billed correctly",
    "charged correctly",
    "correctly billed",
    "as agreed",
    "nothing owed",
    "nothing to recover",
  ].join("|"),
  "i",
);

/** A currency-marked amount: €1,020 · 1.020 EUR · EUR 168. */
const MONEY =
  /(?:€|£|\$|\beur\b|\busd\b|\bgbp\b|\beuros?\b)\s*-?\d[\d.,]*|-?\d[\d.,]*\s*(?:€|£|\$|\beur\b|\busd\b|\bgbp\b|\beuros?\b)/i;

/** A bullet, a numbered item, or a table row — a line that belongs to a block. */
const BLOCK_ROW = /^\s*(?:[-*+]\s|\d+[.)]\s|\|)/;

/** A markdown heading, or a bold-only line used as one. */
const HEADING = /^\s*(?:#{1,6}\s|\*\*[^*]+\*\*\s*:?\s*$)/;

/** How far above a mention to look for the lead-in that governs its block. */
const LEAD_IN_LOOKBACK = 6;

export interface ScopeMentionOptions {
  /**
   * Only count a mention as a finding when its line asserts money.
   *
   * For names that are wholly out of scope, leave this off: any mention
   * presented as a finding is an error. Turn it on for names that are
   * only partly out of scope — a vendor with both an in-scope and an
   * out-of-scope invoice — where the name may legitimately appear and
   * only the excluded amount must not.
   */
  requireAmount?: boolean;
  /**
   * Per-name amounts that count as a monetary claim even when written
   * without a currency marker, e.g. a bare `400` in a table cell whose
   * € lives in the header. Only consulted when `requireAmount` is set.
   */
  amounts?: Readonly<Record<string, number>>;
}

/** One occurrence of a watched name, and how its context reads. */
export interface ScopeMention {
  /** The watched name, as supplied by the caller. */
  name: string;
  /** The line it appeared on, trimmed. */
  line: string;
  /** 1-indexed, for pointing a human at the deliverable. */
  lineNumber: number;
  /** True when this mention reads as a claim against the name. */
  finding: boolean;
  /** Why it is not a finding, or null when it is one. */
  clearedBy: string | null;
}

export interface ScopeMentionReport {
  /** Names presented as findings — at least one uncleared mention. */
  reported: string[];
  /** Names present, but every mention cleared. */
  cleared: string[];
  /** Every occurrence found, in name order then document order. */
  mentions: ScopeMention[];
}

function matchCue(cue: RegExp, line: string | null | undefined): string | null {
  if (line === null || line === undefined) return null;
  const match = cue.exec(line);
  return match ? match[0] : null;
}

/**
 * The prose line a block hangs off — "Excluded from the recovery total:"
 * above a bulleted list. Skips blank lines and the block's own rows;
 * returns null when the mention is not inside a block or the lead-in is
 * further away than {@link LEAD_IN_LOOKBACK}.
 */
function leadInAbove(lines: string[], index: number): string | null {
  for (let i = index - 1; i >= 0 && index - i <= LEAD_IN_LOOKBACK; i -= 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "" || BLOCK_ROW.test(line)) continue;
    return line;
  }
  return null;
}

function nearestHeadingAbove(lines: string[], index: number): string | null {
  for (let i = index - 1; i >= 0; i -= 1) {
    const line = lines[i] ?? "";
    if (HEADING.test(line)) return line;
  }
  return null;
}

/** True when `line` asserts an amount — currency-marked, or a known one. */
function assertsAmount(line: string, amount: number | undefined): boolean {
  if (MONEY.test(line)) return true;
  if (amount === undefined) return false;
  // Thousands separators optional and either convention: 1020 · 1,020 · 1.020
  const digits = String(amount);
  const grouped = digits.replace(/\B(?=(\d{3})+(?!\d))/g, "[.,]?");
  return new RegExp(`(?<![\\d.,])${grouped}(?![\\d.,]*\\d)`).test(line);
}

/** Why the mention on `index` is not a finding, or null if it is one. */
function clearingCue(
  lines: string[],
  index: number,
  amount: number | undefined,
  requireAmount: boolean,
): string | null {
  const line = lines[index] ?? "";
  const excluded =
    matchCue(EXCLUSION_CUE, line) ??
    matchCue(EXCLUSION_CUE, leadInAbove(lines, index)) ??
    matchCue(EXCLUSION_CUE, nearestHeadingAbove(lines, index));
  if (excluded) return excluded;

  const clean = matchCue(CLEAN_CUE, line);
  if (clean) return clean;

  if (requireAmount && !assertsAmount(line, amount)) return "no amount claimed";

  return null;
}

/**
 * Split `names` by how `text` treats them: reported as findings, or
 * cleared. Names absent from `text` appear in neither list. Matching is
 * case-insensitive and substring-based, so callers should pass
 * distinctive names.
 */
export function classifyScopeMentions(
  text: string,
  names: readonly string[],
  options: ScopeMentionOptions = {},
): ScopeMentionReport {
  const { requireAmount = false, amounts } = options;
  const lines = text.split(/\r?\n/);
  const mentions: ScopeMention[] = [];

  for (const name of names) {
    const needle = name.toLowerCase();
    const amount = amounts?.[name];
    lines.forEach((line, index) => {
      if (!line.toLowerCase().includes(needle)) return;
      const clearedBy = clearingCue(lines, index, amount, requireAmount);
      mentions.push({
        name,
        line: line.trim(),
        lineNumber: index + 1,
        finding: clearedBy === null,
        clearedBy,
      });
    });
  }

  const reported = names.filter((name) =>
    mentions.some((m) => m.name === name && m.finding),
  );
  const cleared = names.filter(
    (name) => !reported.includes(name) && mentions.some((m) => m.name === name),
  );

  return { reported: [...reported], cleared: [...cleared], mentions };
}
