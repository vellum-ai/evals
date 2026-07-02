/**
 * Deterministic (no-LLM) evaluators. TypeScript ports of the corresponding
 * functions in V2's `evaluation/qa_eval_metrics.py`:
 *
 * - `norm_phrase_set_match` — phrase-set membership (unordered)
 * - `norm_phrase_set_match_ordered` — phrase-set membership (ordered)
 * - `mc_choice_match` — single multiple-choice letter
 * - `mc_choice_set_match` — multi-select multiple-choice letters
 */

import {
  DEFAULT_SEPARATORS,
  escapeRegex,
  normalizePhrase,
  splitPhrases,
  type SplitOptions,
} from "./normalize";

export interface PhraseSetMatchOptions extends SplitOptions {
  requireNonEmpty?: boolean;
}

export function normPhraseSetMatch(
  prediction: unknown,
  answer: unknown,
  opts: PhraseSetMatchOptions = {},
): boolean {
  const requireNonEmpty = opts.requireNonEmpty ?? true;
  const normalizedPred = normalizePhrase(prediction, opts);
  const answerPhrases = splitPhrases(answer, {
    ...opts,
    separators: opts.separators ?? DEFAULT_SEPARATORS,
  });
  if (requireNonEmpty && (!normalizedPred || answerPhrases.length === 0)) {
    return false;
  }
  for (const phrase of new Set(answerPhrases)) {
    const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`);
    if (!pattern.test(normalizedPred)) return false;
  }
  return true;
}

export function normPhraseSetMatchOrdered(
  prediction: unknown,
  answer: unknown,
  opts: PhraseSetMatchOptions = {},
): boolean {
  const requireNonEmpty = opts.requireNonEmpty ?? true;
  const normalizedPred = normalizePhrase(prediction, opts);
  const answerPhrases = splitPhrases(answer, {
    ...opts,
    separators: opts.separators ?? DEFAULT_SEPARATORS,
  });
  if (requireNonEmpty && (!normalizedPred || answerPhrases.length === 0)) {
    return false;
  }
  let start = 0;
  for (const phrase of answerPhrases) {
    const pattern = new RegExp(`\\b${escapeRegex(phrase)}\\b`);
    const match = pattern.exec(normalizedPred.slice(start));
    if (!match) return false;
    start += match.index + match[0].length;
  }
  return true;
}

export interface McChoiceMatchOptions {
  stripChars?: string;
  requireNonEmpty?: boolean;
}

/**
 * The normalized choices behind an `mc_choice_match` decision, exposed so
 * the metric can record *why* a single-choice question scored 0/1 instead
 * of just the boolean. `extracted` is the letter pulled from the model's
 * answer (after `\boxed{}` / "choice"/"option" / strip-char normalization);
 * `expected` is the normalized gold letter. Either is `""` when the
 * corresponding input was null/undefined or normalized to nothing.
 */
export interface McChoiceMatchDetail {
  extracted: string;
  expected: string;
  matched: boolean;
}

export function mcChoiceMatchDetail(
  prediction: unknown,
  answer: unknown,
  opts: McChoiceMatchOptions = {},
): McChoiceMatchDetail {
  const requireNonEmpty = opts.requireNonEmpty ?? true;
  if (prediction === null || prediction === undefined) {
    return { extracted: "", expected: "", matched: false };
  }
  if (answer === null || answer === undefined) {
    return { extracted: "", expected: "", matched: false };
  }
  const predStr =
    typeof prediction === "string" ? prediction : String(prediction);
  const ansStr = typeof answer === "string" ? answer : String(answer);
  const stripChars = opts.stripChars ?? ".";

  const boxedMatch = predStr.toLowerCase().match(/\\boxed\{([^}]*)\}/);
  let candidate = boxedMatch ? boxedMatch[1] : predStr;
  candidate = candidate.replace(/\b(choice|option)\b/gi, "");
  for (const ch of stripChars) {
    candidate = candidate.split(ch).join("");
  }
  const extracted = candidate.trim().toUpperCase();
  const expected = ansStr.trim().toUpperCase();
  if (requireNonEmpty && (!extracted || !expected)) {
    return { extracted, expected, matched: false };
  }
  return { extracted, expected, matched: extracted === expected };
}

export function mcChoiceMatch(
  prediction: unknown,
  answer: unknown,
  opts: McChoiceMatchOptions = {},
): boolean {
  return mcChoiceMatchDetail(prediction, answer, opts).matched;
}

const MULTI_SELECT_FILLER_WORDS = new Set([
  "AND",
  "ANSWER",
  "ANSWERS",
  "CHOICE",
  "CHOICES",
  "FINAL",
  "LETTER",
  "LETTERS",
  "OPTION",
  "OPTIONS",
]);

export function extractMultiSelectLetters(text: unknown): string[] {
  if (text === null || text === undefined) return [];
  const s = typeof text === "string" ? text : String(text);
  const chunks = s.toUpperCase().match(/[A-Z]+/g) ?? [];
  const letters: string[] = [];
  for (const chunk of chunks) {
    if (MULTI_SELECT_FILLER_WORDS.has(chunk)) continue;
    for (const ch of chunk) letters.push(ch);
  }
  return letters;
}

export interface McChoiceSetMatchOptions {
  requireNonEmpty?: boolean;
}

/**
 * The normalized letter sets behind an `mc_choice_set_match` decision,
 * exposed so the metric can record which letters the model picked versus
 * the gold set. `extracted`/`expected` are de-duplicated and sorted for a
 * stable, readable record.
 */
export interface McChoiceSetMatchDetail {
  extracted: string[];
  expected: string[];
  matched: boolean;
}

export function mcChoiceSetMatchDetail(
  prediction: unknown,
  answer: unknown,
  opts: McChoiceSetMatchOptions = {},
): McChoiceSetMatchDetail {
  const requireNonEmpty = opts.requireNonEmpty ?? true;
  const predLetters = extractMultiSelectLetters(prediction);
  const ansLetters = extractMultiSelectLetters(answer);
  const predSet = new Set(predLetters);
  const ansSet = new Set(ansLetters);
  const extracted = [...predSet].sort();
  const expected = [...ansSet].sort();
  if (
    requireNonEmpty &&
    (predLetters.length === 0 || ansLetters.length === 0)
  ) {
    return { extracted, expected, matched: false };
  }
  let matched = predSet.size === ansSet.size;
  if (matched) {
    for (const letter of predSet) {
      if (!ansSet.has(letter)) {
        matched = false;
        break;
      }
    }
  }
  return { extracted, expected, matched };
}

export function mcChoiceSetMatch(
  prediction: unknown,
  answer: unknown,
  opts: McChoiceSetMatchOptions = {},
): boolean {
  return mcChoiceSetMatchDetail(prediction, answer, opts).matched;
}
