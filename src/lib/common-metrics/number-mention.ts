/**
 * Standalone-number matching for answer-grading metrics. Consolidates
 * the hand-rolled variants the coding cases grew (`mentionsAmount`,
 * `mentionsNumber`, `mentionsCount`) — more than one of which had a real
 * bug in the trailing-decimal guard: `(?![\d:])` let 47 match inside
 * "47.5", and a `\b` boundary holds before "." so 357 matched "357.5".
 */

/**
 * Whether `text` mentions `value` as a standalone number.
 *
 *   - Separator tolerance: `20270`, `20,270`, and `20 270` all match
 *     20270.
 *   - Decimal guard: a longer number containing the value does not count
 *     (`202709`, `120270`), nor does a different decimal (`20270.5`,
 *     `3.47` for 47) — but an exact-zeros tail is still the same value,
 *     so `20270.00` matches.
 *   - Decimal values: a non-integer `value` (11250.775) requires its
 *     exact fraction — `11250.775` and `11,250.775` match, `11250` and
 *     `11250.7756` do not.
 *   - Decimal-comma guard (opt-in via `decimalComma`, for €-style
 *     amounts): `357,00` matches 357 like `357.00` does, and `357,5`
 *     is a different decimal, not a mention of 357.
 *   - Clock-time guard (opt-in via `clockTime`): digits attached through
 *     a colon on either side do not count — `00:14:03` must not read as
 *     a mention of 14 — while prose like "count:14" still matches
 *     (the guard requires a digit on the far side of the colon).
 */
export function mentionsStandaloneNumber(
  text: string,
  value: number,
  opts?: { clockTime?: boolean; decimalComma?: boolean },
): boolean {
  const [intPart, fracPart] = String(value).split(".");
  const spaced = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, "[,\\s]?");
  const point = opts?.decimalComma ? "[.,]" : "\\.";
  const tail =
    fracPart === undefined
      ? `(?:${point}0{1,2})?(?!${point}?\\d)`
      : `${point}${fracPart}(?!\\d)`;
  const clockBefore = opts?.clockTime ? "(?<!\\d:)" : "";
  const clockAfter = opts?.clockTime ? "(?!:\\d)" : "";
  return new RegExp(
    `(?<![\\d.])${clockBefore}${spaced}${tail}${clockAfter}`,
  ).test(text);
}
