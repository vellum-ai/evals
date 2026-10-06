/**
 * The wide arm of the vendor-questionnaire fixture: the same
 * questionnaires, but twenty-four of them.
 *
 * Eight documents at a hundred and thirty lines is a heavy read that
 * still fits in one pass. Twenty-four is about four thousand lines,
 * which is the case the assistant's own post-fix guidance names as
 * worth delegating: an investigation whose raw output would flood the
 * parent context. If a fan-out is going to happen anywhere in an
 * offline sandbox, it happens here.
 *
 * The extra vendors are derived deterministically from the eight
 * hand-written ones, so the answer key stays generated rather than
 * transcribed.
 */

import { VENDORS, type VendorFacts } from "./vendors";

/**
 * The name each derived cohort carries. Distinct enough that a briefing
 * naming one is unambiguous evidence of a per-vendor fan-out.
 */
const COHORTS = [
  { suffix: "Systems", slug: "systems" },
  { suffix: "Networks", slug: "networks" },
] as const;

/**
 * Rotate the facts by cohort so the derived vendors are not eight
 * answers repeated three times: cohort N takes vendor (i + N) modulo
 * eight's answers, which keeps the same overall mix of clean and flagged
 * vendors without making the pattern guessable from the file order.
 */
function derive(
  base: VendorFacts,
  facts: VendorFacts,
  cohort: (typeof COHORTS)[number],
): VendorFacts {
  return {
    ...facts,
    slug: `${base.slug}-${cohort.slug}`,
    vendor: `${base.vendor} ${cohort.suffix}`,
    product: base.product,
  };
}

/** Twenty-four questionnaires: the original eight, then two derived cohorts. */
export const WIDE_VENDORS: VendorFacts[] = [
  ...VENDORS,
  ...COHORTS.flatMap((cohort, cohortIndex) =>
    VENDORS.map((base, index) =>
      derive(base, VENDORS[(index + cohortIndex + 1) % VENDORS.length], cohort),
    ),
  ),
];
